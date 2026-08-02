"""
Database storage service using SQLite
"""
import aiosqlite
import json
import logging
import asyncio
import os
import time
from functools import wraps
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from models.types import NetworkFlow, Device, Threat, FilterPreset
from models.alerts import AlertRule, TriggeredAlert
from models.baseline import DeviceBaseline
from utils.config import config
from utils.migrations import run_migrations
from utils.constants import THREAT_DEDUP_WINDOW_MINUTES
from services.db_pool import DatabasePool

logger = logging.getLogger(__name__)


def log_slow_query(label: str):
    """Decorator for StorageService async methods: logs a WARN (with duration
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


class StorageService:
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
            except Exception as e:
                # Other errors - don't retry
                raise

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
        """Close database connection"""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")
        elif self.db:
            await self.db.close()
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

    # Device methods
    async def get_devices(self) -> List[Device]:
        """Get all devices"""
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute("SELECT * FROM devices ORDER BY last_seen DESC") as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_device(row) for row in rows]
        else:
            await self._ensure_connection()
            async with self.db.execute("SELECT * FROM devices ORDER BY last_seen DESC") as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_device(row) for row in rows]

    async def get_device(self, device_id: str) -> Optional[Device]:
        """Get device by ID"""
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute("SELECT * FROM devices WHERE id = ?", (device_id,)) as cursor:
                    row = await cursor.fetchone()
                    return self._row_to_device(row) if row else None
        else:
            await self._ensure_connection()
            async with self.db.execute("SELECT * FROM devices WHERE id = ?", (device_id,)) as cursor:
                row = await cursor.fetchone()
                return self._row_to_device(row) if row else None

    async def get_device_by_mac(self, mac: str) -> Optional[Device]:
        """Get device by MAC address"""
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute("SELECT * FROM devices WHERE mac = ?", (mac,)) as cursor:
                    row = await cursor.fetchone()
                    return self._row_to_device(row) if row else None
        else:
            await self._ensure_connection()
            async with self.db.execute("SELECT * FROM devices WHERE mac = ?", (mac,)) as cursor:
                row = await cursor.fetchone()
                return self._row_to_device(row) if row else None

    async def upsert_device(self, device: Device):
        """Insert or update device"""
        # Convert applications list to comma-separated string
        applications_str = ",".join(device.applications) if device.applications else None
        tags_str = json.dumps(device.tags) if device.tags else None

        await self._execute_with_retry("""
            INSERT OR REPLACE INTO devices
            (id, name, ip, mac, type, vendor, os, first_seen, last_seen, bytes_total,
             connections_count, threat_score, behavioral, notes, ipv6_support, avg_rtt,
             connection_quality, applications, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            device.id, device.name, device.ip, device.mac, device.type, device.vendor,
            device.os, device.firstSeen, device.lastSeen, device.bytesTotal, device.connectionsCount,
            device.threatScore, json.dumps(device.behavioral), device.notes,
            1 if device.ipv6Support else 0, device.avgRtt, device.connectionQuality, applications_str, tags_str
        ))
        await self._ensure_connection()
        await self.db.commit()

    async def count_devices(self) -> int:
        """Count total devices"""
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute("SELECT COUNT(*) FROM devices") as cursor:
                    row = await cursor.fetchone()
                    return row[0] if row else 0
        else:
            await self._ensure_connection()
            async with self.db.execute("SELECT COUNT(*) FROM devices") as cursor:
                row = await cursor.fetchone()
                return row[0] if row else 0

    # Flow methods
    async def add_flow(self, flow: NetworkFlow):
        """Add network flow"""
        # Convert TCP flags list to comma-separated string
        tcp_flags_str = ",".join(flow.tcpFlags) if flow.tcpFlags else None

        await self._execute_with_retry("""
            INSERT OR REPLACE INTO flows
            (id, timestamp, source_ip, source_port, dest_ip, dest_port, protocol,
             bytes_in, bytes_out, packets_in, packets_out, duration, status,
             country, city, asn, domain, sni, threat_level, device_id,
             tcp_flags, ttl, connection_state, rtt, retransmissions, jitter,
             application, user_agent, http_method, url, dns_query_type, dns_response_code,
             http_host, http_status_code, dns_query_name, dns_answers, tls_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            flow.id, flow.timestamp, flow.sourceIp, flow.sourcePort, flow.destIp,
            flow.destPort, flow.protocol, flow.bytesIn, flow.bytesOut,
            flow.packetsIn, flow.packetsOut, flow.duration, flow.status,
            flow.country, flow.city, flow.asn, flow.domain, flow.sni, flow.threatLevel, flow.deviceId,
            tcp_flags_str, flow.ttl, flow.connectionState, flow.rtt, flow.retransmissions, flow.jitter,
            flow.application, flow.userAgent, flow.httpMethod, flow.url, flow.dnsQueryType, flow.dnsResponseCode,
            flow.httpHost, flow.httpStatusCode, flow.dnsQueryName,
            ",".join(flow.dnsAnswers) if flow.dnsAnswers else None, flow.tlsVersion
        ))
        await self._ensure_connection()
        await self.db.commit()

    async def add_flows_batch(self, flows: List[NetworkFlow]):
        """Insert multiple flows in a single transaction (Pi optimization: fewer commits/fsyncs)."""
        if not flows:
            return

        query = """
            INSERT OR REPLACE INTO flows
            (id, timestamp, source_ip, source_port, dest_ip, dest_port, protocol,
             bytes_in, bytes_out, packets_in, packets_out, duration, status,
             country, city, asn, domain, sni, threat_level, device_id,
             tcp_flags, ttl, connection_state, rtt, retransmissions, jitter,
             application, user_agent, http_method, url, dns_query_type, dns_response_code,
             http_host, http_status_code, dns_query_name, dns_answers, tls_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = [
            (
                flow.id, flow.timestamp, flow.sourceIp, flow.sourcePort, flow.destIp,
                flow.destPort, flow.protocol, flow.bytesIn, flow.bytesOut,
                flow.packetsIn, flow.packetsOut, flow.duration, flow.status,
                flow.country, flow.city, flow.asn, flow.domain, flow.sni, flow.threatLevel, flow.deviceId,
                ",".join(flow.tcpFlags) if flow.tcpFlags else None, flow.ttl, flow.connectionState,
                flow.rtt, flow.retransmissions, flow.jitter,
                flow.application, flow.userAgent, flow.httpMethod, flow.url,
                flow.dnsQueryType, flow.dnsResponseCode,
                flow.httpHost, flow.httpStatusCode, flow.dnsQueryName,
                ",".join(flow.dnsAnswers) if flow.dnsAnswers else None, flow.tlsVersion
            )
            for flow in flows
        ]

        if self.pool:
            async with self.pool.acquire() as conn:
                await conn.executemany(query, params)
                await conn.commit()
        else:
            await self._ensure_connection()
            await self.db.executemany(query, params)
            await self.db.commit()

    @log_slow_query("get_flows")
    async def get_flows(self, limit: int = 100, device_id: Optional[str] = None,
                       status: Optional[str] = None, protocol: Optional[str] = None,
                       start_time: Optional[int] = None, end_time: Optional[int] = None,
                       source_ip: Optional[str] = None, dest_ip: Optional[str] = None,
                       threat_level: Optional[str] = None, min_bytes: Optional[int] = None,
                       offset: int = 0,
                       # New enhanced filters
                       country: Optional[str] = None,
                       city: Optional[str] = None,
                       application: Optional[str] = None,
                       min_rtt: Optional[int] = None,
                       max_rtt: Optional[int] = None,
                       max_jitter: Optional[float] = None,
                       max_retransmissions: Optional[int] = None,
                       sni: Optional[str] = None,
                       connection_state: Optional[str] = None) -> List[NetworkFlow]:
        """Get flows with advanced filters including enhanced data fields"""
        query = "SELECT * FROM flows WHERE 1=1"
        params = []

        if device_id:
            query += " AND device_id = ?"
            params.append(device_id)

        if status:
            query += " AND status = ?"
            params.append(status)

        if protocol:
            query += " AND protocol = ?"
            params.append(protocol)

        if start_time:
            query += " AND timestamp >= ?"
            params.append(start_time)

        if end_time:
            query += " AND timestamp <= ?"
            params.append(end_time)

        if source_ip:
            query += " AND source_ip = ?"
            params.append(source_ip)

        if dest_ip:
            query += " AND dest_ip = ?"
            params.append(dest_ip)

        if threat_level:
            query += " AND threat_level = ?"
            params.append(threat_level)

        if min_bytes:
            query += " AND (bytes_in + bytes_out) >= ?"
            params.append(min_bytes)

        # New enhanced filters
        if country:
            query += " AND country = ?"
            params.append(country)

        if city:
            query += " AND city LIKE ?"
            params.append(f"%{city}%")

        if application:
            query += " AND application = ?"
            params.append(application)

        if min_rtt is not None:
            query += " AND rtt >= ?"
            params.append(min_rtt)

        if max_rtt is not None:
            query += " AND rtt <= ?"
            params.append(max_rtt)

        if max_jitter is not None:
            query += " AND jitter <= ?"
            params.append(max_jitter)

        if max_retransmissions is not None:
            query += " AND retransmissions <= ?"
            params.append(max_retransmissions)

        if sni:
            query += " AND sni LIKE ?"
            params.append(f"%{sni}%")

        if connection_state:
            query += " AND connection_state = ?"
            params.append(connection_state)

        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_flow(row) for row in rows]
        else:
            await self._ensure_connection()
            async with self.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_flow(row) for row in rows]

    async def _aggregate_fetchall(self, query: str, params=None):
        """Run a read-only aggregation query and return all rows.

        Fully consumes the cursor inside the pool context so the connection
        can be safely returned to the pool.
        """
        params = params or []
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    return await cursor.fetchall()
        await self._ensure_connection()
        async with self.db.execute(query, params) as cursor:
            return await cursor.fetchall()

    @log_slow_query("aggregate_geographic")
    async def aggregate_geographic(self, start_time: int) -> List[dict]:
        """Aggregate connections by country in SQL (avoids loading flows)."""
        rows = await self._aggregate_fetchall(
            """
            SELECT country,
                   COUNT(*) AS connections,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes,
                   SUM(CASE WHEN threat_level IN ('medium','high','critical')
                            THEN 1 ELSE 0 END) AS threats
            FROM flows
            WHERE timestamp >= ? AND country IS NOT NULL AND country <> ''
            GROUP BY country
            ORDER BY connections DESC
            """,
            (start_time,),
        )
        return [
            {
                "country": r["country"],
                "connections": r["connections"],
                "bytes": r["bytes"],
                "threats": r["threats"],
            }
            for r in rows
        ]

    @log_slow_query("aggregate_top_domains")
    async def aggregate_top_domains(
        self, start_time: int, limit: int = 20
    ) -> List[dict]:
        """Aggregate top domains by traffic in SQL."""
        rows = await self._aggregate_fetchall(
            """
            SELECT domain,
                   COUNT(*) AS connections,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes,
                   COUNT(DISTINCT device_id) AS unique_devices
            FROM flows
            WHERE timestamp >= ? AND domain IS NOT NULL AND domain <> ''
            GROUP BY domain
            ORDER BY bytes DESC
            LIMIT ?
            """,
            (start_time, limit),
        )
        return [
            {
                "domain": r["domain"],
                "connections": r["connections"],
                "bytes": r["bytes"],
                "unique_devices": r["unique_devices"],
            }
            for r in rows
        ]

    @log_slow_query("aggregate_top_devices")
    async def aggregate_top_devices(self, start_time: int) -> List[dict]:
        """Aggregate per-device traffic in SQL. Enrichment done by caller."""
        rows = await self._aggregate_fetchall(
            """
            SELECT device_id,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes,
                   COUNT(*) AS connections,
                   SUM(CASE WHEN threat_level IN ('medium','high','critical')
                            THEN 1 ELSE 0 END) AS threats
            FROM flows
            WHERE timestamp >= ?
            GROUP BY device_id
            """,
            (start_time,),
        )
        return [
            {
                "device_id": r["device_id"],
                "bytes": r["bytes"],
                "connections": r["connections"],
                "threats": r["threats"],
            }
            for r in rows
        ]

    @log_slow_query("aggregate_bandwidth_timeline")
    async def aggregate_bandwidth_timeline(
        self, start_time: int, interval_ms: int
    ) -> List[dict]:
        """Aggregate bandwidth into fixed time buckets in SQL."""
        rows = await self._aggregate_fetchall(
            """
            SELECT (timestamp / ?) * ? AS bucket,
                   COALESCE(SUM(bytes_in), 0) AS bytes_in,
                   COALESCE(SUM(bytes_out), 0) AS bytes_out,
                   COALESCE(SUM(packets_in + packets_out), 0) AS packets,
                   COUNT(*) AS connections
            FROM flows
            WHERE timestamp >= ?
            GROUP BY bucket
            ORDER BY bucket ASC
            """,
            (interval_ms, interval_ms, start_time),
        )
        return [
            {
                "timestamp": r["bucket"],
                "bytes_in": r["bytes_in"],
                "bytes_out": r["bytes_out"],
                "packets": r["packets"],
                "connections": r["connections"],
            }
            for r in rows
        ]

    @log_slow_query("aggregate_device_analytics")
    async def aggregate_device_analytics(
        self, device_id: str, start_time: int
    ) -> dict:
        """Aggregate per-device breakdowns in SQL for a single device."""
        summary_rows = await self._aggregate_fetchall(
            """
            SELECT COALESCE(SUM(bytes_in), 0) AS bytes_in,
                   COALESCE(SUM(bytes_out), 0) AS bytes_out,
                   COUNT(*) AS connections,
                   SUM(CASE WHEN threat_level IN ('medium','high','critical')
                            THEN 1 ELSE 0 END) AS threats
            FROM flows
            WHERE device_id = ? AND timestamp >= ?
            """,
            (device_id, start_time),
        )
        protocol_rows = await self._aggregate_fetchall(
            """
            SELECT protocol,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes,
                   COUNT(*) AS connections
            FROM flows
            WHERE device_id = ? AND timestamp >= ?
            GROUP BY protocol
            ORDER BY bytes DESC
            """,
            (device_id, start_time),
        )
        domain_rows = await self._aggregate_fetchall(
            """
            SELECT domain, COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes
            FROM flows
            WHERE device_id = ? AND timestamp >= ?
                  AND domain IS NOT NULL AND domain <> ''
            GROUP BY domain
            ORDER BY bytes DESC
            LIMIT 10
            """,
            (device_id, start_time),
        )
        port_rows = await self._aggregate_fetchall(
            """
            SELECT dest_port AS port, COUNT(*) AS connections
            FROM flows
            WHERE device_id = ? AND timestamp >= ?
            GROUP BY dest_port
            ORDER BY connections DESC
            LIMIT 10
            """,
            (device_id, start_time),
        )
        s = summary_rows[0] if summary_rows else None
        return {
            "summary": {
                "total_bytes_in": s["bytes_in"] if s else 0,
                "total_bytes_out": s["bytes_out"] if s else 0,
                "connections": s["connections"] if s else 0,
                "threats": s["threats"] if s else 0,
            },
            "protocols": [
                {
                    "protocol": r["protocol"],
                    "bytes": r["bytes"],
                    "connections": r["connections"],
                }
                for r in protocol_rows
            ],
            "top_domains": [
                {"domain": r["domain"], "bytes": r["bytes"]} for r in domain_rows
            ],
            "top_ports": [
                {"port": r["port"], "connections": r["connections"]}
                for r in port_rows
            ],
        }

    async def search_flows(self, query_text: str, limit: int = 50) -> List[NetworkFlow]:
        """Search flows by IP address or domain"""
        query = """
            SELECT * FROM flows
            WHERE source_ip LIKE ?
               OR dest_ip LIKE ?
               OR domain LIKE ?
            ORDER BY timestamp DESC
            LIMIT ?
        """
        search_pattern = f"%{query_text}%"
        params = [search_pattern, search_pattern, search_pattern, limit]

        async with self.db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [self._row_to_flow(row) for row in rows]

    async def search_devices(self, query_text: str, limit: int = 50) -> List[Device]:
        """Search devices by name, IP, or MAC"""
        query = """
            SELECT * FROM devices
            WHERE name LIKE ?
               OR ip LIKE ?
               OR mac LIKE ?
            ORDER BY last_seen DESC
            LIMIT ?
        """
        search_pattern = f"%{query_text}%"
        params = [search_pattern, search_pattern, search_pattern, limit]

        async with self.db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [self._row_to_device(row) for row in rows]

    async def get_flow(self, flow_id: str) -> Optional[NetworkFlow]:
        """Get flow by ID"""
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute("SELECT * FROM flows WHERE id = ?", (flow_id,)) as cursor:
                    row = await cursor.fetchone()
                    return self._row_to_flow(row) if row else None
        else:
            await self._ensure_connection()
            async with self.db.execute("SELECT * FROM flows WHERE id = ?", (flow_id,)) as cursor:
                row = await cursor.fetchone()
                return self._row_to_flow(row) if row else None

    async def count_flows(self) -> int:
        """Count total flows"""
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute("SELECT COUNT(*) FROM flows") as cursor:
                    row = await cursor.fetchone()
                    return row[0] if row else 0
        else:
            await self._ensure_connection()
            async with self.db.execute("SELECT COUNT(*) FROM flows") as cursor:
                row = await cursor.fetchone()
                return row[0] if row else 0

    # Threat methods
    async def add_threat(self, threat: Threat):
        """Add threat, or bump occurrence_count if the same type+device threat
        fired again recently (avoids tens of thousands of near-duplicate rows
        per day for repeat offenders like a chatty device tripping the same rule)."""
        dedup_window_ms = THREAT_DEDUP_WINDOW_MINUTES * 60 * 1000
        window_start = threat.timestamp - dedup_window_ms
        dedup_query = (
            "SELECT id FROM threats WHERE type = ? AND device_id = ? AND dismissed = 0 "
            "AND timestamp >= ? ORDER BY timestamp DESC LIMIT 1"
        )
        dedup_params = (threat.type, threat.deviceId, window_start)

        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(dedup_query, dedup_params) as cursor:
                    row = await cursor.fetchone()
        else:
            await self._ensure_connection()
            async with self.db.execute(dedup_query, dedup_params) as cursor:
                row = await cursor.fetchone()
        existing_id = row["id"] if row else None

        if existing_id:
            await self._execute_with_retry(
                "UPDATE threats SET timestamp = ?, description = ?, occurrence_count = occurrence_count + 1 "
                "WHERE id = ?",
                (threat.timestamp, threat.description, existing_id)
            )
        else:
            await self._execute_with_retry("""
                INSERT OR REPLACE INTO threats
                (id, timestamp, type, severity, device_id, flow_id, description, recommendation, dismissed, occurrence_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                threat.id, threat.timestamp, threat.type, threat.severity,
                threat.deviceId, threat.flowId, threat.description,
                threat.recommendation, 1 if threat.dismissed else 0, threat.occurrenceCount
            ))
        await self._ensure_connection()
        await self.db.commit()

    @log_slow_query("get_threats")
    async def get_threats(self, active_only: bool = True, limit: int = 200) -> List[Threat]:
        """Get threats, most recent first"""
        query = "SELECT * FROM threats"
        if active_only:
            query += " WHERE dismissed = 0"
        query += " ORDER BY timestamp DESC LIMIT ?"
        params = (limit,)

        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_threat(row) for row in rows]
        else:
            await self._ensure_connection()
            async with self.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_threat(row) for row in rows]

    @log_slow_query("aggregate_threat_stats")
    async def aggregate_threat_stats(self) -> dict:
        """Aggregate threat totals in SQL (avoids loading every threat row into memory)."""
        rows = await self._aggregate_fetchall(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN dismissed = 0 THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN dismissed = 0 AND severity = 'critical' THEN 1 ELSE 0 END) AS critical_active
            FROM threats
            """
        )
        r = rows[0] if rows else None
        return {
            "total": (r["total"] or 0) if r else 0,
            "active": (r["active"] or 0) if r else 0,
            "critical_active": (r["critical_active"] or 0) if r else 0,
        }

    @log_slow_query("aggregate_threat_counts_by_hour")
    async def aggregate_threat_counts_by_hour(self, start_time: int) -> dict[int, int]:
        """Aggregate threat counts bucketed by hour in SQL (avoids loading every threat row)."""
        hour_ms = 60 * 60 * 1000
        rows = await self._aggregate_fetchall(
            """
            SELECT (timestamp / ?) * ? AS bucket, COUNT(*) AS count
            FROM threats
            WHERE timestamp >= ?
            GROUP BY bucket
            """,
            (hour_ms, hour_ms, start_time),
        )
        return {r["bucket"]: r["count"] for r in rows}

    async def search_threats(
        self, query_text: str, limit: int = 50, active_only: bool = False
    ) -> List[Threat]:
        """Search threats by type, description, or severity using database queries"""
        search_pattern = f"%{query_text}%"

        # Build query with search conditions
        where_clauses = [
            "type LIKE ?",
            "description LIKE ?",
            "severity LIKE ?"
        ]
        params = [search_pattern, search_pattern, search_pattern]

        # Add dismissed filter if needed
        if active_only:
            where_clauses.append("dismissed = 0")

        query = f"""
            SELECT * FROM threats
            WHERE ({' OR '.join(where_clauses[:3])})
            {'AND dismissed = 0' if active_only else ''}
            ORDER BY timestamp DESC
            LIMIT ?
        """
        params.append(limit)

        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_threat(row) for row in rows]
        else:
            await self._ensure_connection()
            async with self.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_threat(row) for row in rows]

    async def get_threat(self, threat_id: str) -> Optional[Threat]:
        """Get a specific threat by ID"""
        query = "SELECT * FROM threats WHERE id = ?"
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, (threat_id,)) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        return self._row_to_threat(row)
                    return None
        else:
            await self._ensure_connection()
            async with self.db.execute(query, (threat_id,)) as cursor:
                row = await cursor.fetchone()
                if row:
                    return self._row_to_threat(row)
                return None

    async def upsert_threat(self, threat: Threat):
        """Update or insert a threat"""
        query = """
            INSERT OR REPLACE INTO threats
            (id, timestamp, type, severity, device_id, flow_id, description, recommendation, dismissed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        await self._execute_with_retry(query, (
            threat.id,
            threat.timestamp,
            threat.type,
            threat.severity,
            threat.deviceId,
            threat.flowId,
            threat.description,
            threat.recommendation,
            1 if threat.dismissed else 0
        ))
        await self._ensure_connection()
        await self.db.commit()

    async def dismiss_threat(self, threat_id: str) -> bool:
        """Dismiss a threat"""
        cursor = await self.db.execute(
            "UPDATE threats SET dismissed = 1 WHERE id = ?", (threat_id,)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def get_total_bytes_since(self, since_ms: int) -> int:
        """Sum bytes_in + bytes_out across all flows with timestamp >= since_ms"""
        query = "SELECT COALESCE(SUM(bytes_in + bytes_out), 0) FROM flows WHERE timestamp >= ?"
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, (since_ms,)) as cursor:
                    row = await cursor.fetchone()
                    return int(row[0]) if row else 0
        else:
            await self._ensure_connection()
            async with self.db.execute(query, (since_ms,)) as cursor:
                row = await cursor.fetchone()
                return int(row[0]) if row else 0

    # Filter preset methods
    async def add_filter_preset(self, preset: FilterPreset):
        """Save a new flow filter preset"""
        await self._execute_with_retry("""
            INSERT INTO filter_presets (id, user_id, name, filters, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            preset.id, preset.userId, preset.name, json.dumps(preset.filters), preset.createdAt
        ))
        await self._ensure_connection()
        await self.db.commit()

    async def get_filter_presets(self, user_id: str) -> List[FilterPreset]:
        """List a user's saved filter presets"""
        query = "SELECT * FROM filter_presets WHERE user_id = ? ORDER BY created_at DESC"
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, (user_id,)) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_filter_preset(row) for row in rows]
        else:
            await self._ensure_connection()
            async with self.db.execute(query, (user_id,)) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_filter_preset(row) for row in rows]

    async def delete_filter_preset(self, preset_id: str, user_id: str) -> bool:
        """Delete a filter preset, scoped to its owner"""
        await self._ensure_connection()
        cursor = await self.db.execute(
            "DELETE FROM filter_presets WHERE id = ? AND user_id = ?", (preset_id, user_id)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    def _row_to_filter_preset(self, row) -> FilterPreset:
        """Convert database row to FilterPreset model"""
        return FilterPreset(
            id=row["id"],
            userId=row["user_id"],
            name=row["name"],
            filters=json.loads(row["filters"]),
            createdAt=row["created_at"],
        )

    # Alert rule methods
    async def add_alert_rule(self, rule: AlertRule):
        """Save a new configurable alert rule"""
        await self._execute_with_retry("""
            INSERT INTO alert_rules
            (id, user_id, name, enabled, metric, operator, threshold, values_json,
             severity, cooldown_minutes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rule.id, rule.userId, rule.name, 1 if rule.enabled else 0, rule.metric,
            rule.operator, rule.threshold, json.dumps(rule.values) if rule.values else None,
            rule.severity, rule.cooldownMinutes, rule.createdAt, rule.updatedAt
        ))
        await self._ensure_connection()
        await self.db.commit()

    async def get_alert_rules(self, user_id: Optional[str] = None, enabled_only: bool = False) -> List[AlertRule]:
        """List alert rules, optionally scoped to a user and/or filtered to enabled ones"""
        query = "SELECT * FROM alert_rules"
        clauses = []
        params: list = []
        if user_id is not None:
            clauses.append("user_id = ?")
            params.append(user_id)
        if enabled_only:
            clauses.append("enabled = 1")
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY created_at DESC"

        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_alert_rule(row) for row in rows]
        else:
            await self._ensure_connection()
            async with self.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_alert_rule(row) for row in rows]

    async def get_alert_rule(self, rule_id: str) -> Optional[AlertRule]:
        """Get a specific alert rule by ID"""
        query = "SELECT * FROM alert_rules WHERE id = ?"
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, (rule_id,)) as cursor:
                    row = await cursor.fetchone()
                    return self._row_to_alert_rule(row) if row else None
        else:
            await self._ensure_connection()
            async with self.db.execute(query, (rule_id,)) as cursor:
                row = await cursor.fetchone()
                return self._row_to_alert_rule(row) if row else None

    async def update_alert_rule(self, rule: AlertRule):
        """Update an existing alert rule"""
        await self._execute_with_retry("""
            UPDATE alert_rules SET
                name = ?, enabled = ?, metric = ?, operator = ?, threshold = ?,
                values_json = ?, severity = ?, cooldown_minutes = ?, updated_at = ?
            WHERE id = ?
        """, (
            rule.name, 1 if rule.enabled else 0, rule.metric, rule.operator, rule.threshold,
            json.dumps(rule.values) if rule.values else None, rule.severity,
            rule.cooldownMinutes, rule.updatedAt, rule.id
        ))
        await self._ensure_connection()
        await self.db.commit()

    async def delete_alert_rule(self, rule_id: str, user_id: str) -> bool:
        """Delete an alert rule, scoped to its owner"""
        await self._ensure_connection()
        cursor = await self.db.execute(
            "DELETE FROM alert_rules WHERE id = ? AND user_id = ?", (rule_id, user_id)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    def _row_to_alert_rule(self, row) -> AlertRule:
        """Convert database row to AlertRule model"""
        return AlertRule(
            id=row["id"],
            userId=row["user_id"],
            name=row["name"],
            enabled=bool(row["enabled"]),
            metric=row["metric"],
            operator=row["operator"],
            threshold=row["threshold"],
            values=json.loads(row["values_json"]) if row["values_json"] else None,
            severity=row["severity"],
            cooldownMinutes=row["cooldown_minutes"],
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
        )

    # Triggered alert methods
    async def add_triggered_alert(self, alert: TriggeredAlert):
        """Persist a triggered alert"""
        await self._execute_with_retry("""
            INSERT INTO triggered_alerts
            (id, rule_id, rule_name, timestamp, severity, device_id, flow_id,
             metric, value, description, acknowledged)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            alert.id, alert.ruleId, alert.ruleName, alert.timestamp, alert.severity,
            alert.deviceId, alert.flowId, alert.metric, alert.value, alert.description,
            1 if alert.acknowledged else 0
        ))
        await self._ensure_connection()
        await self.db.commit()

    async def get_triggered_alerts(self, limit: int = 100, acknowledged: Optional[bool] = None) -> List[TriggeredAlert]:
        """List triggered alerts, most recent first, optionally filtered by acknowledged state"""
        query = "SELECT * FROM triggered_alerts"
        params: list = []
        if acknowledged is not None:
            query += " WHERE acknowledged = ?"
            params.append(1 if acknowledged else 0)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_triggered_alert(row) for row in rows]
        else:
            await self._ensure_connection()
            async with self.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_triggered_alert(row) for row in rows]

    async def acknowledge_triggered_alert(self, alert_id: str) -> bool:
        """Mark a triggered alert as acknowledged"""
        await self._ensure_connection()
        cursor = await self.db.execute(
            "UPDATE triggered_alerts SET acknowledged = 1 WHERE id = ?", (alert_id,)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    def _row_to_triggered_alert(self, row) -> TriggeredAlert:
        """Convert database row to TriggeredAlert model"""
        return TriggeredAlert(
            id=row["id"],
            ruleId=row["rule_id"],
            ruleName=row["rule_name"],
            timestamp=row["timestamp"],
            severity=row["severity"],
            deviceId=row["device_id"],
            flowId=row["flow_id"],
            metric=row["metric"],
            value=row["value"],
            description=row["description"],
            acknowledged=bool(row["acknowledged"]),
        )

    # Device baseline methods (predictive anomaly detection)
    @log_slow_query("get_device_flow_aggregates")
    async def get_device_flow_aggregates(self, start_time: int, end_time: int) -> List[dict]:
        """Aggregate flow activity per device over [start_time, end_time) for baseline learning.

        Uses SQL-level aggregation (not per-flow Python loops) since this only
        runs periodically (hourly), not on the packet-capture hot path.
        """
        query = """
            SELECT
                device_id,
                SUM(bytes_in + bytes_out) AS bytes_total,
                COUNT(*) AS connections,
                AVG(rtt) AS avg_rtt,
                AVG(jitter) AS avg_jitter,
                SUM(COALESCE(retransmissions, 0)) AS total_retransmissions,
                SUM(packets_in + packets_out) AS total_packets
            FROM flows
            WHERE timestamp >= ? AND timestamp < ?
            GROUP BY device_id
        """
        params = (start_time, end_time)

        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [dict(row) for row in rows]
        else:
            await self._ensure_connection()
            async with self.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    async def upsert_device_baseline(self, baseline: DeviceBaseline):
        """Insert or update a device's learned behavioral baseline"""
        await self._execute_with_retry("""
            INSERT OR REPLACE INTO device_baselines
            (device_id, bytes_total_mean, bytes_total_stddev, connections_mean,
             connections_stddev, avg_rtt_mean, avg_rtt_stddev, avg_jitter_mean,
             avg_jitter_stddev, retransmission_rate_mean, retransmission_rate_stddev,
             sample_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            baseline.deviceId, baseline.bytesTotalMean, baseline.bytesTotalStdDev,
            baseline.connectionsMean, baseline.connectionsStdDev, baseline.avgRttMean,
            baseline.avgRttStdDev, baseline.avgJitterMean, baseline.avgJitterStdDev,
            baseline.retransmissionRateMean, baseline.retransmissionRateStdDev,
            baseline.sampleCount, baseline.updatedAt
        ))
        await self._ensure_connection()
        await self.db.commit()

    async def get_device_baseline(self, device_id: str) -> Optional[DeviceBaseline]:
        """Get a single device's learned baseline"""
        query = "SELECT * FROM device_baselines WHERE device_id = ?"
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query, (device_id,)) as cursor:
                    row = await cursor.fetchone()
                    return self._row_to_device_baseline(row) if row else None
        else:
            await self._ensure_connection()
            async with self.db.execute(query, (device_id,)) as cursor:
                row = await cursor.fetchone()
                return self._row_to_device_baseline(row) if row else None

    async def get_all_device_baselines(self) -> List[DeviceBaseline]:
        """Get all learned device baselines"""
        query = "SELECT * FROM device_baselines"
        if self.pool:
            async with self.pool.acquire() as conn:
                async with conn.execute(query) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_device_baseline(row) for row in rows]
        else:
            await self._ensure_connection()
            async with self.db.execute(query) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_device_baseline(row) for row in rows]

    def _row_to_device_baseline(self, row) -> DeviceBaseline:
        """Convert database row to DeviceBaseline model"""
        return DeviceBaseline(
            deviceId=row["device_id"],
            bytesTotalMean=row["bytes_total_mean"],
            bytesTotalStdDev=row["bytes_total_stddev"],
            connectionsMean=row["connections_mean"],
            connectionsStdDev=row["connections_stddev"],
            avgRttMean=row["avg_rtt_mean"],
            avgRttStdDev=row["avg_rtt_stddev"],
            avgJitterMean=row["avg_jitter_mean"],
            avgJitterStdDev=row["avg_jitter_stddev"],
            retransmissionRateMean=row["retransmission_rate_mean"],
            retransmissionRateStdDev=row["retransmission_rate_stddev"],
            sampleCount=row["sample_count"],
            updatedAt=row["updated_at"],
        )

    # Helper methods
    def _row_to_device(self, row) -> Device:
        """Convert database row to Device model"""
        # Parse applications from comma-separated string
        applications = None
        if row["applications"]:
            applications = [a.strip() for a in row["applications"].split(",") if a.strip()]

        # Handle missing notes/tags fields (for backward compatibility with older databases)
        try:
            notes = row["notes"]
        except (KeyError, IndexError):
            notes = None

        tags = None
        try:
            if row["tags"]:
                tags = json.loads(row["tags"])
        except (KeyError, IndexError):
            tags = None

        return Device(
            id=row["id"],
            name=row["name"],
            ip=row["ip"],
            mac=row["mac"],
            type=row["type"],
            vendor=row["vendor"],
            os=row["os"],
            firstSeen=row["first_seen"],
            lastSeen=row["last_seen"],
            bytesTotal=row["bytes_total"],
            connectionsCount=row["connections_count"],
            threatScore=row["threat_score"],
            behavioral=json.loads(row["behavioral"]),
            notes=notes,
            ipv6Support=bool(row["ipv6_support"]) if row["ipv6_support"] is not None else None,
            avgRtt=row["avg_rtt"],
            connectionQuality=row["connection_quality"],
            applications=applications,
            tags=tags
        )

    def _row_to_flow(self, row) -> NetworkFlow:
        """Convert database row to NetworkFlow model"""
        # Parse TCP flags from comma-separated string
        tcp_flags = None
        if row["tcp_flags"]:
            tcp_flags = [f.strip() for f in row["tcp_flags"].split(",") if f.strip()]

        return NetworkFlow(
            id=row["id"],
            timestamp=row["timestamp"],
            sourceIp=row["source_ip"],
            sourcePort=row["source_port"],
            destIp=row["dest_ip"],
            destPort=row["dest_port"],
            protocol=row["protocol"],
            bytesIn=row["bytes_in"],
            bytesOut=row["bytes_out"],
            packetsIn=row["packets_in"],
            packetsOut=row["packets_out"],
            duration=row["duration"],
            status=row["status"],
            country=row["country"],
            city=row["city"],
            asn=row["asn"],
            domain=row["domain"],
            sni=row["sni"],
            threatLevel=row["threat_level"],
            deviceId=row["device_id"],
            tcpFlags=tcp_flags,
            ttl=row["ttl"],
            connectionState=row["connection_state"],
            rtt=row["rtt"],
            retransmissions=row["retransmissions"],
            jitter=row["jitter"],
            application=row["application"],
            userAgent=row["user_agent"],
            httpMethod=row["http_method"],
            url=row["url"],
            dnsQueryType=row["dns_query_type"],
            dnsResponseCode=row["dns_response_code"],
            httpHost=row["http_host"],
            httpStatusCode=row["http_status_code"],
            dnsQueryName=row["dns_query_name"],
            dnsAnswers=(
                [a.strip() for a in row["dns_answers"].split(",") if a.strip()]
                if row["dns_answers"] else None
            ),
            tlsVersion=row["tls_version"]
        )

    def _row_to_threat(self, row) -> Threat:
        """Convert database row to Threat model"""
        return Threat(
            id=row["id"],
            timestamp=row["timestamp"],
            type=row["type"],
            severity=row["severity"],
            deviceId=row["device_id"],
            flowId=row["flow_id"],
            description=row["description"],
            recommendation=row["recommendation"],
            dismissed=bool(row["dismissed"]),
            occurrenceCount=row["occurrence_count"] if "occurrence_count" in row.keys() else 1
        )

