"""
Database storage service using SQLite
"""
import aiosqlite
import json
import logging
from typing import List, Optional
from datetime import datetime, timedelta
import os

from models.types import NetworkFlow, Device, Threat, AnalyticsData

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self, db_path: str = "netinsight.db"):
        self.db_path = db_path
        self.db: Optional[aiosqlite.Connection] = None

    async def initialize(self):
        """Initialize database and create tables"""
        self.db = await aiosqlite.connect(self.db_path)
        self.db.row_factory = aiosqlite.Row

        await self._create_tables()
        logger.info(f"Database initialized: {self.db_path}")

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
                first_seen INTEGER NOT NULL,
                last_seen INTEGER NOT NULL,
                bytes_total INTEGER NOT NULL DEFAULT 0,
                connections_count INTEGER NOT NULL DEFAULT 0,
                threat_score REAL NOT NULL DEFAULT 0,
                behavioral TEXT NOT NULL DEFAULT '{}',
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
                domain TEXT,
                threat_level TEXT NOT NULL,
                device_id TEXT NOT NULL,
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

        # Create indexes
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_flows_timestamp ON flows(timestamp DESC)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_flows_device ON flows(device_id)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_flows_status ON flows(status)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_threats_dismissed ON threats(dismissed)
        """)

        await self.db.commit()

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
        await self.db.execute("""
            INSERT OR REPLACE INTO devices
            (id, name, ip, mac, type, vendor, first_seen, last_seen, bytes_total,
             connections_count, threat_score, behavioral)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            device.id, device.name, device.ip, device.mac, device.type, device.vendor,
            device.firstSeen, device.lastSeen, device.bytesTotal, device.connectionsCount,
            device.threatScore, json.dumps(device.behavioral)
        ))
        await self.db.commit()

    async def count_devices(self) -> int:
        """Count total devices"""
        async with self.db.execute("SELECT COUNT(*) FROM devices") as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0

    # Flow methods
    async def add_flow(self, flow: NetworkFlow):
        """Add network flow"""
        await self.db.execute("""
            INSERT OR REPLACE INTO flows
            (id, timestamp, source_ip, source_port, dest_ip, dest_port, protocol,
             bytes_in, bytes_out, packets_in, packets_out, duration, status,
             country, domain, threat_level, device_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            flow.id, flow.timestamp, flow.sourceIp, flow.sourcePort, flow.destIp,
            flow.destPort, flow.protocol, flow.bytesIn, flow.bytesOut,
            flow.packetsIn, flow.packetsOut, flow.duration, flow.status,
            flow.country, flow.domain, flow.threatLevel, flow.deviceId
        ))
        await self.db.commit()

    async def get_flows(self, limit: int = 100, device_id: Optional[str] = None,
                       status: Optional[str] = None) -> List[NetworkFlow]:
        """Get flows with filters"""
        query = "SELECT * FROM flows WHERE 1=1"
        params = []

        if device_id:
            query += " AND device_id = ?"
            params.append(device_id)

        if status:
            query += " AND status = ?"
            params.append(status)

        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        async with self.db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [self._row_to_flow(row) for row in rows]

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
        await self.db.execute("""
            INSERT OR REPLACE INTO threats
            (id, timestamp, type, severity, device_id, flow_id, description, recommendation, dismissed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            threat.id, threat.timestamp, threat.type, threat.severity,
            threat.deviceId, threat.flowId, threat.description,
            threat.recommendation, 1 if threat.dismissed else 0
        ))
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
        return Device(
            id=row["id"],
            name=row["name"],
            ip=row["ip"],
            mac=row["mac"],
            type=row["type"],
            vendor=row["vendor"],
            firstSeen=row["first_seen"],
            lastSeen=row["last_seen"],
            bytesTotal=row["bytes_total"],
            connectionsCount=row["connections_count"],
            threatScore=row["threat_score"],
            behavioral=json.loads(row["behavioral"])
        )

    def _row_to_flow(self, row) -> NetworkFlow:
        """Convert database row to NetworkFlow model"""
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
            domain=row["domain"],
            threatLevel=row["threat_level"],
            deviceId=row["device_id"]
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

