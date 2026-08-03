"""Threat repository: CRUD, dedup, search, and hourly aggregates over the `threats` table."""
from typing import List, Optional

from models.types import Threat
from utils.constants import THREAT_DEDUP_WINDOW_MINUTES
from services.storage.base import Repository, log_slow_query


class ThreatRepository(Repository):
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

        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(dedup_query, dedup_params) as cursor:
                    row = await cursor.fetchone()
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(dedup_query, dedup_params) as cursor:
                row = await cursor.fetchone()
        existing_id = row["id"] if row else None

        if existing_id:
            await self.base._execute_with_retry(
                "UPDATE threats SET timestamp = ?, description = ?, occurrence_count = occurrence_count + 1 "
                "WHERE id = ?",
                (threat.timestamp, threat.description, existing_id)
            )
        else:
            await self.base._execute_with_retry("""
                INSERT OR REPLACE INTO threats
                (id, timestamp, type, severity, device_id, flow_id, description, recommendation, dismissed, occurrence_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                threat.id, threat.timestamp, threat.type, threat.severity,
                threat.deviceId, threat.flowId, threat.description,
                threat.recommendation, 1 if threat.dismissed else 0, threat.occurrenceCount
            ))
        await self.base._ensure_connection()
        await self.base.db.commit()

    @log_slow_query("get_threats")
    async def get_threats(self, active_only: bool = True, limit: int = 200) -> List[Threat]:
        """Get threats, most recent first"""
        query = "SELECT * FROM threats"
        if active_only:
            query += " WHERE dismissed = 0"
        query += " ORDER BY timestamp DESC LIMIT ?"
        params = (limit,)

        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_threat(row) for row in rows]
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_threat(row) for row in rows]

    @log_slow_query("aggregate_threat_stats")
    async def aggregate_threat_stats(self) -> dict:
        """Aggregate threat totals in SQL (avoids loading every threat row into memory)."""
        rows = await self.base._aggregate_fetchall(
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
        rows = await self.base._aggregate_fetchall(
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

        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_threat(row) for row in rows]
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_threat(row) for row in rows]

    async def get_threat(self, threat_id: str) -> Optional[Threat]:
        """Get a specific threat by ID"""
        query = "SELECT * FROM threats WHERE id = ?"
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query, (threat_id,)) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        return self._row_to_threat(row)
                    return None
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query, (threat_id,)) as cursor:
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
        await self.base._execute_with_retry(query, (
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
        await self.base._ensure_connection()
        await self.base.db.commit()

    async def dismiss_threat(self, threat_id: str) -> bool:
        """Dismiss a threat"""
        cursor = await self.base.db.execute(
            "UPDATE threats SET dismissed = 1 WHERE id = ?", (threat_id,)
        )
        await self.base.db.commit()
        return cursor.rowcount > 0

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
