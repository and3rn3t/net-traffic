"""Device repository: CRUD + search over the `devices` table."""
import json
from typing import List, Optional

from models.types import Device
from services.storage.base import Repository


class DeviceRepository(Repository):
    async def get_devices(self) -> List[Device]:
        """Get all devices"""
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute("SELECT * FROM devices ORDER BY last_seen DESC") as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_device(row) for row in rows]
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute("SELECT * FROM devices ORDER BY last_seen DESC") as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_device(row) for row in rows]

    async def get_device(self, device_id: str) -> Optional[Device]:
        """Get device by ID"""
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute("SELECT * FROM devices WHERE id = ?", (device_id,)) as cursor:
                    row = await cursor.fetchone()
                    return self._row_to_device(row) if row else None
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute("SELECT * FROM devices WHERE id = ?", (device_id,)) as cursor:
                row = await cursor.fetchone()
                return self._row_to_device(row) if row else None

    async def get_device_by_mac(self, mac: str) -> Optional[Device]:
        """Get device by MAC address"""
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute("SELECT * FROM devices WHERE mac = ?", (mac,)) as cursor:
                    row = await cursor.fetchone()
                    return self._row_to_device(row) if row else None
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute("SELECT * FROM devices WHERE mac = ?", (mac,)) as cursor:
                row = await cursor.fetchone()
                return self._row_to_device(row) if row else None

    async def upsert_device(self, device: Device):
        """Insert or update device"""
        # Convert applications list to comma-separated string
        applications_str = ",".join(device.applications) if device.applications else None
        tags_str = json.dumps(device.tags) if device.tags else None

        await self.base._execute_with_retry("""
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
        await self.base._ensure_connection()
        await self.base.db.commit()

    async def count_devices(self) -> int:
        """Count total devices"""
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute("SELECT COUNT(*) FROM devices") as cursor:
                    row = await cursor.fetchone()
                    return row[0] if row else 0
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute("SELECT COUNT(*) FROM devices") as cursor:
                row = await cursor.fetchone()
                return row[0] if row else 0

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

        async with self.base.db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [self._row_to_device(row) for row in rows]

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
