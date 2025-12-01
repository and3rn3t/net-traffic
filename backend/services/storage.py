"""
Database storage service using SQLite
"""
import aiosqlite
import json
import logging
import asyncio
from typing import List, Optional
from datetime import datetime, timedelta

from models.types import NetworkFlow, Device, Threat
from utils.migrations import run_migrations

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self, db_path: str = "netinsight.db"):
        self.db_path = db_path
        self.db: Optional[aiosqlite.Connection] = None
        self._connection_lock = asyncio.Lock()
        self._max_retries = 3
        self._retry_delay = 1.0  # seconds

    async def initialize(self):
        """Initialize database and create tables"""
        await self._ensure_connection()
        await self._create_tables()
        # Run migrations to handle schema updates
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
                FOREIGN KEY (device_id) REFERENCES devices(id)
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

    async def cleanup_old_data(self, days: int = 30):
        """Clean up old flows and threats older than specified days"""
        cutoff_time = int(
            (datetime.now() - timedelta(days=days)).timestamp() * 1000
        )

        # Delete old flows
        cursor = await self._execute_with_retry(
            "DELETE FROM flows WHERE timestamp < ?", (cutoff_time,)
        )
        flows_deleted = cursor.rowcount

        # Delete old threats
        cursor = await self._execute_with_retry(
            "DELETE FROM threats WHERE timestamp < ? AND dismissed = 1",
            (cutoff_time,)
        )
        threats_deleted = cursor.rowcount

        await self._ensure_connection()
        await self.db.commit()

        logger.info(
            f"Cleanup completed: {flows_deleted} flows, "
            f"{threats_deleted} dismissed threats deleted"
        )

        return {
            "flows_deleted": flows_deleted,
            "threats_deleted": threats_deleted,
            "cutoff_timestamp": cutoff_time
        }

    async def get_database_stats(self) -> dict:
        """Get database statistics"""
        await self._ensure_connection()
        stats = {}

        # Count flows
        async with self.db.execute("SELECT COUNT(*) FROM flows") as cursor:
            row = await cursor.fetchone()
            stats["total_flows"] = row[0] if row else 0

        # Count devices
        async with self.db.execute("SELECT COUNT(*) FROM devices") as cursor:
            row = await cursor.fetchone()
            stats["total_devices"] = row[0] if row else 0

        # Count threats
        async with self.db.execute("SELECT COUNT(*) FROM threats") as cursor:
            row = await cursor.fetchone()
            stats["total_threats"] = row[0] if row else 0

        # Get oldest and newest flow timestamps
        async with self.db.execute(
            "SELECT MIN(timestamp), MAX(timestamp) FROM flows"
        ) as cursor:
            row = await cursor.fetchone()
            stats["oldest_flow"] = row[0] if row and row[0] else None
            stats["newest_flow"] = row[1] if row and row[1] else None

        # Get database size (approximate)
        async with self.db.execute(
            "SELECT page_count * page_size as size FROM pragma_page_count(), "
            "pragma_page_size()"
        ) as cursor:
            row = await cursor.fetchone()
            stats["database_size_bytes"] = row[0] if row else 0

        return stats

    async def close(self):
        """Close database connection"""
        if self.db:
            await self.db.close()
            logger.info("Database connection closed")

    # Device methods
    async def get_devices(self) -> List[Device]:
        """Get all devices"""
        async with self.db.execute("SELECT * FROM devices ORDER BY last_seen DESC") as cursor:
            rows = await cursor.fetchall()
            return [self._row_to_device(row) for row in rows]

    async def get_device(self, device_id: str) -> Optional[Device]:
        """Get device by ID"""
        async with self.db.execute("SELECT * FROM devices WHERE id = ?", (device_id,)) as cursor:
            row = await cursor.fetchone()
            return self._row_to_device(row) if row else None

    async def get_device_by_mac(self, mac: str) -> Optional[Device]:
        """Get device by MAC address"""
        async with self.db.execute("SELECT * FROM devices WHERE mac = ?", (mac,)) as cursor:
            row = await cursor.fetchone()
            return self._row_to_device(row) if row else None

    async def upsert_device(self, device: Device):
        """Insert or update device"""
        # Convert applications list to comma-separated string
        applications_str = ",".join(device.applications) if device.applications else None

        await self._execute_with_retry("""
            INSERT OR REPLACE INTO devices
            (id, name, ip, mac, type, vendor, os, first_seen, last_seen, bytes_total,
             connections_count, threat_score, behavioral, notes, ipv6_support, avg_rtt,
             connection_quality, applications)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            device.id, device.name, device.ip, device.mac, device.type, device.vendor,
            device.os, device.firstSeen, device.lastSeen, device.bytesTotal, device.connectionsCount,
            device.threatScore, json.dumps(device.behavioral), device.notes,
            1 if device.ipv6Support else 0, device.avgRtt, device.connectionQuality, applications_str
        ))
        await self._ensure_connection()
        await self.db.commit()

    async def count_devices(self) -> int:
        """Count total devices"""
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
             application, user_agent, http_method, url, dns_query_type, dns_response_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            flow.id, flow.timestamp, flow.sourceIp, flow.sourcePort, flow.destIp,
            flow.destPort, flow.protocol, flow.bytesIn, flow.bytesOut,
            flow.packetsIn, flow.packetsOut, flow.duration, flow.status,
            flow.country, flow.city, flow.asn, flow.domain, flow.sni, flow.threatLevel, flow.deviceId,
            tcp_flags_str, flow.ttl, flow.connectionState, flow.rtt, flow.retransmissions, flow.jitter,
            flow.application, flow.userAgent, flow.httpMethod, flow.url, flow.dnsQueryType, flow.dnsResponseCode
        ))
        await self._ensure_connection()
        await self.db.commit()

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

        async with self.db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [self._row_to_flow(row) for row in rows]

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
        async with self.db.execute("SELECT * FROM flows WHERE id = ?", (flow_id,)) as cursor:
            row = await cursor.fetchone()
            return self._row_to_flow(row) if row else None

    async def count_flows(self) -> int:
        """Count total flows"""
        async with self.db.execute("SELECT COUNT(*) FROM flows") as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0

    # Threat methods
    async def add_threat(self, threat: Threat):
        """Add threat"""
        await self._execute_with_retry("""
            INSERT OR REPLACE INTO threats
            (id, timestamp, type, severity, device_id, flow_id, description, recommendation, dismissed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            threat.id, threat.timestamp, threat.type, threat.severity,
            threat.deviceId, threat.flowId, threat.description,
            threat.recommendation, 1 if threat.dismissed else 0
        ))
        await self._ensure_connection()
        await self.db.commit()

    async def get_threats(self, active_only: bool = True) -> List[Threat]:
        """Get threats"""
        query = "SELECT * FROM threats"
        if active_only:
            query += " WHERE dismissed = 0"
        query += " ORDER BY timestamp DESC"

        async with self.db.execute(query) as cursor:
            rows = await cursor.fetchall()
            return [self._row_to_threat(row) for row in rows]

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

        async with self.db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [self._row_to_threat(row) for row in rows]

    async def get_threat(self, threat_id: str) -> Optional[Threat]:
        """Get a specific threat by ID"""
        query = "SELECT * FROM threats WHERE id = ?"
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

    # Helper methods
    def _row_to_device(self, row) -> Device:
        """Convert database row to Device model"""
        # Parse applications from comma-separated string
        applications = None
        if row["applications"]:
            applications = [a.strip() for a in row["applications"].split(",") if a.strip()]

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
            notes=row.get("notes"),  # Handle missing notes field for existing databases
            ipv6Support=bool(row["ipv6_support"]) if row["ipv6_support"] is not None else None,
            avgRtt=row["avg_rtt"],
            connectionQuality=row["connection_quality"],
            applications=applications
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
            dnsResponseCode=row["dns_response_code"]
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
            dismissed=bool(row["dismissed"])
        )

