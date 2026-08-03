"""
Core connection/pool infrastructure shared by all per-domain storage repositories.
"""
import aiosqlite
import logging
import asyncio
import os
import time
from functools import wraps
from typing import Optional
from datetime import datetime, timedelta, timezone

from utils.config import config
from utils.migrations import run_migrations
from services.db_pool import DatabasePool

logger = logging.getLogger(__name__)


def log_slow_query(label: str):
    """Decorator for storage async methods: logs a WARN (with duration
    and row count) when a query is slow or returns an unexpectedly large
    result set - the two symptoms behind past DB performance incidents."""
    def decorator(func):
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            start = time.monotonic()
            result = await func(self, *args, **kwargs)
            duration_ms = (time.monotonic() - start) * 1000
            row_count = len(result) if isinstance(result, (list, tuple)) else None
            self._record_query_timing(label, duration_ms, row_count)
            return result
        return wrapper
    return decorator


class StorageBase:
    """Owns the DB connection/pool lifecycle and helpers shared across
    per-domain repositories (retry logic, table creation, maintenance,
    query-timing stats). `StorageService` extends this directly; repository
    classes hold a reference to an instance of this via `self.base`."""

    def __init__(self, db_path: str = "netinsight.db", use_pool: bool = True):
        self.db_path = db_path
        self.use_pool = use_pool

        # Slow/large-query counters surfaced via get_pool_stats() -> /api/health/db-pool
        self._query_stats: dict = {
            "slow_query_count": 0,
            "last_slow_query": None,
        }

        # Legacy single connection (for backward compatibility)
        self.db: Optional[aiosqlite.Connection] = None
        self._connection_lock = asyncio.Lock()
        self._max_retries = 3
        self._retry_delay = 1.0  # seconds

        # Connection pool (new approach)
        self.pool: Optional[DatabasePool] = None

    async def initialize(self):
        """Initialize database and create tables"""
        if self.use_pool:
            # Initialize connection pool
            self.pool = DatabasePool(
                db_path=self.db_path,
                max_connections=5,
                enable_wal=True
            )
            await self.pool.initialize()

            # Use first connection from pool for setup
            async with self.pool.acquire() as conn:
                self.db = conn  # Temporary assignment for migrations
                await self._create_tables()
                await run_migrations(self.db)
                self.db = None  # Clear temporary assignment

            logger.info(f"Database initialized with connection pool: {self.db_path}")
        else:
            # Legacy single connection mode
            await self._ensure_connection()
            await self._create_tables()
            await run_migrations(self.db)
            logger.info(f"Database initialized: {self.db_path}")

    async def _ensure_connection(self):
        """Ensure database connection is active, reconnect if needed"""
        async with self._connection_lock:
            if self.db is not None:
                # Check if connection is still alive
                try:
                    await asyncio.wait_for(
                        self.db.execute("SELECT 1"),
                        timeout=1.0
                    )
                    return  # Connection is healthy
                except Exception as e:
                    logger.warning(f"Database connection check failed: {e}")
                    # Connection is dead, close it
                    try:
                        await self.db.close()
                    except Exception:
                        pass
                    self.db = None

            # Connect or reconnect
            if self.db is None:
                await self._connect_with_retry()

    async def _connect_with_retry(self):
        """Connect to database with retry logic"""
        for attempt in range(self._max_retries):
            try:
                self.db = await asyncio.wait_for(
                    aiosqlite.connect(self.db_path, timeout=5.0),
                    timeout=5.0
                )
                self.db.row_factory = aiosqlite.Row

                # Optimize SQLite for Raspberry Pi 5
                await self._optimize_sqlite()

                logger.info(f"Database connected: {self.db_path}")
                return
            except Exception as e:
                if attempt < self._max_retries - 1:
                    delay = self._retry_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(
                        f"Database connection attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {delay}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        f"Failed to connect to database after "
                        f"{self._max_retries} attempts: {e}"
                    )
                    raise

    async def _execute_with_retry(self, query: str, params=None):
        """Execute query with automatic reconnection on failure"""
        # Use connection pool if available
        if self.pool:
            # Pool handles retry logic internally
            if params:
                async with self.pool.acquire() as conn:
                    return await conn.execute(query, params)
            else:
                async with self.pool.acquire() as conn:
                    return await conn.execute(query)

        # Legacy single connection mode with retry
        for attempt in range(self._max_retries):
            try:
                await self._ensure_connection()
                if params:
                    return await self.db.execute(query, params)
                else:
                    return await self.db.execute(query)
            except (aiosqlite.OperationalError, aiosqlite.DatabaseError) as e:
                error_str = str(e).lower()
                # Check if it's a connection-related error
                if any(keyword in error_str for keyword in [
                    'closed', 'lost', 'unable to open', 'database is locked'
                ]):
                    logger.warning(f"Database error (attempt {attempt + 1}): {e}")
                    # Close connection and retry
                    async with self._connection_lock:
                        if self.db:
                            try:
                                await self.db.close()
                            except Exception:
                                pass
                            self.db = None

                    if attempt < self._max_retries - 1:
                        await asyncio.sleep(self._retry_delay * (2 ** attempt))
                        continue
                    else:
                        logger.error(f"Database operation failed after retries: {e}")
                        raise
                else:
                    # Not a connection error, don't retry
                    raise
            except Exception:
                # Other errors - don't retry
                raise

    async def _aggregate_fetchall(self, query: str, params=None):
        """Run a read-only aggregation query and return all rows.

        Fully consumes the cursor inside the pool context so the connection
        can be safely returned to the pool. Shared by any repository's
        aggregate_* methods (not domain-specific despite living here).
        """
        params = params or []
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    return await cursor.fetchall()
        await self._ensure_connection()
        async with self.db.execute(query, params) as cursor:
            return await cursor.fetchall()

    async def _create_tables(self):
        """Create database tables"""
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                ip TEXT NOT NULL,
                mac TEXT NOT NULL,
                type TEXT NOT NULL,
                vendor TEXT NOT NULL,
                os TEXT,
                first_seen INTEGER NOT NULL,
                last_seen INTEGER NOT NULL,
                bytes_total INTEGER NOT NULL DEFAULT 0,
                connections_count INTEGER NOT NULL DEFAULT 0,
                threat_score REAL NOT NULL DEFAULT 0,
                behavioral TEXT NOT NULL DEFAULT '{}',
                notes TEXT,
                ipv6_support INTEGER DEFAULT 0,
                avg_rtt REAL,
                connection_quality TEXT,
                applications TEXT,
                tags TEXT,
                UNIQUE(mac)
            )
        """)

        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS flows (
                id TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                source_ip TEXT NOT NULL,
                source_port INTEGER NOT NULL,
                dest_ip TEXT NOT NULL,
                dest_port INTEGER NOT NULL,
                protocol TEXT NOT NULL,
                bytes_in INTEGER NOT NULL,
                bytes_out INTEGER NOT NULL,
                packets_in INTEGER NOT NULL,
                packets_out INTEGER NOT NULL,
                duration INTEGER NOT NULL,
                status TEXT NOT NULL,
                country TEXT,
                city TEXT,
                asn INTEGER,
                domain TEXT,
                sni TEXT,
                threat_level TEXT NOT NULL,
                device_id TEXT NOT NULL,
                tcp_flags TEXT,
                ttl INTEGER,
                connection_state TEXT,
                rtt INTEGER,
                retransmissions INTEGER,
                jitter REAL,
                application TEXT,
                user_agent TEXT,
                http_method TEXT,
                url TEXT,
                dns_query_type TEXT,
                dns_response_code TEXT,
                http_host TEXT,
                http_status_code INTEGER,
                dns_query_name TEXT,
                dns_answers TEXT,
                tls_version TEXT,
                FOREIGN KEY (device_id) REFERENCES devices(id)
            )
        """)

        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS filter_presets (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                filters TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)

        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_filter_presets_user_id
            ON filter_presets(user_id)
        """)

        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS alert_rules (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                metric TEXT NOT NULL,
                operator TEXT NOT NULL,
                threshold REAL,
                values_json TEXT,
                severity TEXT NOT NULL DEFAULT 'medium',
                cooldown_minutes INTEGER NOT NULL DEFAULT 15,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)

        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id
            ON alert_rules(user_id)
        """)

        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS triggered_alerts (
                id TEXT PRIMARY KEY,
                rule_id TEXT NOT NULL,
                rule_name TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                severity TEXT NOT NULL,
                device_id TEXT NOT NULL,
                flow_id TEXT NOT NULL,
                metric TEXT NOT NULL,
                value TEXT NOT NULL,
                description TEXT NOT NULL,
                acknowledged INTEGER NOT NULL DEFAULT 0
            )
        """)

        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_triggered_alerts_timestamp
            ON triggered_alerts(timestamp DESC)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_triggered_alerts_acknowledged
            ON triggered_alerts(acknowledged)
        """)

        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS device_baselines (
                device_id TEXT PRIMARY KEY,
                bytes_total_mean REAL NOT NULL DEFAULT 0,
                bytes_total_stddev REAL NOT NULL DEFAULT 0,
                connections_mean REAL NOT NULL DEFAULT 0,
                connections_stddev REAL NOT NULL DEFAULT 0,
                avg_rtt_mean REAL NOT NULL DEFAULT 0,
                avg_rtt_stddev REAL NOT NULL DEFAULT 0,
                avg_jitter_mean REAL NOT NULL DEFAULT 0,
                avg_jitter_stddev REAL NOT NULL DEFAULT 0,
                retransmission_rate_mean REAL NOT NULL DEFAULT 0,
                retransmission_rate_stddev REAL NOT NULL DEFAULT 0,
                sample_count INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL DEFAULT 0
            )
        """)

        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS threats (
                id TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                type TEXT NOT NULL,
                severity TEXT NOT NULL,
                device_id TEXT NOT NULL,
                flow_id TEXT NOT NULL,
                description TEXT NOT NULL,
                recommendation TEXT NOT NULL,
                dismissed INTEGER NOT NULL DEFAULT 0,
                occurrence_count INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (device_id) REFERENCES devices(id),
                FOREIGN KEY (flow_id) REFERENCES flows(id)
            )
        """)

        # Create indexes for performance optimization
        # Flow indexes
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_flows_timestamp
            ON flows(timestamp DESC)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_flows_device
            ON flows(device_id)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_flows_status
            ON flows(status)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_flows_source_ip
            ON flows(source_ip)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_flows_dest_ip
            ON flows(dest_ip)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_flows_domain
            ON flows(domain)
        """)
        # Composite index for aggregate_device_analytics/get_flows device+time-range queries
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_flows_device_timestamp
            ON flows(device_id, timestamp DESC)
        """)

        # Device indexes for search
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_devices_name
            ON devices(name)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_devices_ip
            ON devices(ip)
        """)

        # Threat indexes
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_threats_dismissed
            ON threats(dismissed)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_threats_timestamp
            ON threats(timestamp DESC)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_threats_type
            ON threats(type)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_threats_description
            ON threats(description)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_threats_severity
            ON threats(severity)
        """)
        # Composite index covering get_threats' "WHERE dismissed = 0 ORDER BY timestamp DESC"
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_threats_dismissed_timestamp
            ON threats(dismissed, timestamp DESC)
        """)
        # Covers the add_threat() dedup lookup, which runs on every threat creation
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_threats_dedup
            ON threats(type, device_id, dismissed, timestamp DESC)
        """)

        await self.db.commit()

    async def _optimize_sqlite(self):
        """Optimize SQLite settings for Raspberry Pi 5"""
        # Enable WAL mode for better concurrency (readers don't block writers)
        await self.db.execute("PRAGMA journal_mode=WAL")

        # Optimize for Pi's limited resources
        await self.db.execute("PRAGMA synchronous=NORMAL")  # Balance safety/performance
        await self.db.execute("PRAGMA cache_size=-32000")  # 32MB cache (adjust for Pi RAM)
        await self.db.execute("PRAGMA temp_store=MEMORY")  # Use RAM for temp tables
        await self.db.execute("PRAGMA mmap_size=268435456")  # 256MB memory-mapped I/O
        await self.db.execute("PRAGMA page_size=4096")  # Optimal page size
        await self.db.execute("PRAGMA optimize")  # Run query optimizer

        await self.db.commit()
        logger.debug("SQLite optimized for Raspberry Pi 5")

    async def _batched_delete(self, table: str, where_clause: str, params: tuple, batch_size: int = 50000) -> int:
        """Delete matching rows in bounded batches to avoid one long write transaction."""
        total_deleted = 0
        while True:
            cursor = await self._execute_with_retry(
                f"DELETE FROM {table} WHERE rowid IN "
                f"(SELECT rowid FROM {table} WHERE {where_clause} LIMIT ?)",
                params + (batch_size,)
            )
            deleted = cursor.rowcount
            total_deleted += deleted
            if not self.pool:
                await self.db.commit()
            if deleted < batch_size:
                break
        return total_deleted

    @log_slow_query("cleanup_old_data")
    async def cleanup_old_data(self, days: int = 30):
        """Clean up old flows, threats, and triggered alerts older than specified days"""
        cutoff_time = int(
            (datetime.now() - timedelta(days=days)).timestamp() * 1000
        )

        flows_deleted = await self._batched_delete("flows", "timestamp < ?", (cutoff_time,))
        # Threats are purged at the retention cutoff regardless of dismissed
        # state - undismissed threats past the window are stale noise, not
        # actionable, and were otherwise growing unbounded.
        threats_deleted = await self._batched_delete("threats", "timestamp < ?", (cutoff_time,))
        alerts_deleted = await self._batched_delete("triggered_alerts", "timestamp < ?", (cutoff_time,))

        # Fold the WAL back into the main DB and truncate it. Repeated deletes
        # (and normal capture writes) can otherwise let the -wal file grow
        # unbounded; a multi-GB WAL starves the connection pool and spikes
        # CPU/memory until requests time out.
        try:
            await self._execute_with_retry("PRAGMA wal_checkpoint(TRUNCATE)")
        except Exception as e:
            logger.warning(f"WAL checkpoint after cleanup failed: {e}")

        try:
            await self._execute_with_retry("PRAGMA optimize")
        except Exception as e:
            logger.warning(f"PRAGMA optimize after cleanup failed: {e}")

        logger.info(
            f"Cleanup completed: {flows_deleted} flows, {threats_deleted} threats, "
            f"{alerts_deleted} triggered alerts deleted"
        )

        return {
            "flows_deleted": flows_deleted,
            "threats_deleted": threats_deleted,
            "triggered_alerts_deleted": alerts_deleted,
            "cutoff_timestamp": cutoff_time
        }

    @log_slow_query("get_database_stats")
    async def get_database_stats(self) -> dict:
        """Get database statistics"""
        stats: dict = {}

        async def _fetchone(query: str):
            if self.pool:
                async with self.pool.acquire() as conn:
                    async with conn.execute(query) as cursor:
                        return await cursor.fetchone()
            await self._ensure_connection()
            async with self.db.execute(query) as cursor:
                return await cursor.fetchone()

        row = await _fetchone("SELECT COUNT(*) FROM flows")
        stats["total_flows"] = row[0] if row else 0

        row = await _fetchone("SELECT COUNT(*) FROM devices")
        stats["total_devices"] = row[0] if row else 0

        row = await _fetchone("SELECT COUNT(*) FROM threats")
        stats["total_threats"] = row[0] if row else 0

        row = await _fetchone("SELECT MIN(timestamp), MAX(timestamp) FROM flows")
        stats["oldest_flow"] = row[0] if row and row[0] else None
        stats["newest_flow"] = row[1] if row and row[1] else None

        row = await _fetchone(
            "SELECT page_count * page_size as size FROM pragma_page_count(), "
            "pragma_page_size()"
        )
        stats["database_size_bytes"] = row[0] if row else 0
        stats["wal_size_bytes"] = self.get_wal_size_bytes()

        return stats

    def get_wal_size_bytes(self) -> int:
        """Size of the -wal file; a large value means checkpointing isn't keeping up."""
        wal_path = f"{self.db_path}-wal"
        return os.path.getsize(wal_path) if os.path.exists(wal_path) else 0

    async def checkpoint_wal_if_needed(self, threshold_bytes: int) -> Optional[dict]:
        """Run a non-blocking PASSIVE WAL checkpoint if the -wal file exceeds threshold_bytes.

        PASSIVE (unlike the TRUNCATE checkpoint cleanup_old_data uses) never blocks
        writers, making it safe to call from a periodic background task.
        """
        before = self.get_wal_size_bytes()
        if before <= threshold_bytes:
            return None
        try:
            await self._execute_with_retry("PRAGMA wal_checkpoint(PASSIVE)")
        except Exception as e:
            logger.warning(f"Proactive WAL checkpoint failed: {e}")
            return None
        after = self.get_wal_size_bytes()
        return {"before_bytes": before, "after_bytes": after}

    def _record_query_timing(self, label: str, duration_ms: float, row_count: Optional[int] = None) -> None:
        """Track slow/large query occurrences and log a WARN for either."""
        is_slow = duration_ms > config.slow_query_ms
        is_large = row_count is not None and row_count > config.large_result_warn_rows
        if not (is_slow or is_large):
            return

        self._query_stats["slow_query_count"] += 1
        self._query_stats["last_slow_query"] = {
            "label": label,
            "duration_ms": round(duration_ms, 1),
            "row_count": row_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        logger.warning(
            f"Slow/large query '{label}': {duration_ms:.1f}ms"
            + (f", {row_count} rows" if row_count is not None else ""),
            extra={"query_label": label, "duration_ms": round(duration_ms, 1), "row_count": row_count},
        )

    async def close(self):
        """Close database connection(s)"""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")
        if self.db:
            # Several write methods call _ensure_connection() unconditionally
            # even in pool mode, opening a stray non-pooled connection - close
            # it too so its aiosqlite writer thread doesn't block process exit.
            await self.db.close()
            self.db = None
            logger.info("Database connection closed")

    def get_pool_stats(self) -> dict:
        """Get connection pool + slow-query statistics"""
        if self.pool:
            stats = self.pool.get_stats()
        else:
            stats = {
                "pool_enabled": False,
                "message": "Connection pooling not enabled"
            }
        stats["query_stats"] = self._query_stats
        return stats


class Repository:
    """Shared base for per-domain repositories: holds a reference to the
    StorageBase instance that owns the actual connection/pool, and forwards
    query-timing so `@log_slow_query`-decorated repo methods work the same
    as when they lived directly on StorageService."""

    def __init__(self, base: StorageBase):
        self.base = base

    def _record_query_timing(self, label: str, duration_ms: float, row_count: Optional[int] = None) -> None:
        self.base._record_query_timing(label, duration_ms, row_count)
