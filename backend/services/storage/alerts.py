"""Alert repository: configurable alert rules + their triggered-alert history."""
import json
from typing import List, Optional

from models.alerts import AlertRule, TriggeredAlert
from services.storage.base import Repository


class AlertRepository(Repository):
    # Alert rule methods
    async def add_alert_rule(self, rule: AlertRule):
        """Save a new configurable alert rule"""
        await self.base._execute_with_retry("""
            INSERT INTO alert_rules
            (id, user_id, name, enabled, metric, operator, threshold, values_json,
             severity, cooldown_minutes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rule.id, rule.userId, rule.name, 1 if rule.enabled else 0, rule.metric,
            rule.operator, rule.threshold, json.dumps(rule.values) if rule.values else None,
            rule.severity, rule.cooldownMinutes, rule.createdAt, rule.updatedAt
        ))
        await self.base._ensure_connection()
        await self.base.db.commit()

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

        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_alert_rule(row) for row in rows]
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_alert_rule(row) for row in rows]

    async def get_alert_rule(self, rule_id: str) -> Optional[AlertRule]:
        """Get a specific alert rule by ID"""
        query = "SELECT * FROM alert_rules WHERE id = ?"
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query, (rule_id,)) as cursor:
                    row = await cursor.fetchone()
                    return self._row_to_alert_rule(row) if row else None
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query, (rule_id,)) as cursor:
                row = await cursor.fetchone()
                return self._row_to_alert_rule(row) if row else None

    async def update_alert_rule(self, rule: AlertRule):
        """Update an existing alert rule"""
        await self.base._execute_with_retry("""
            UPDATE alert_rules SET
                name = ?, enabled = ?, metric = ?, operator = ?, threshold = ?,
                values_json = ?, severity = ?, cooldown_minutes = ?, updated_at = ?
            WHERE id = ?
        """, (
            rule.name, 1 if rule.enabled else 0, rule.metric, rule.operator, rule.threshold,
            json.dumps(rule.values) if rule.values else None, rule.severity,
            rule.cooldownMinutes, rule.updatedAt, rule.id
        ))
        await self.base._ensure_connection()
        await self.base.db.commit()

    async def delete_alert_rule(self, rule_id: str, user_id: str) -> bool:
        """Delete an alert rule, scoped to its owner"""
        await self.base._ensure_connection()
        cursor = await self.base.db.execute(
            "DELETE FROM alert_rules WHERE id = ? AND user_id = ?", (rule_id, user_id)
        )
        await self.base.db.commit()
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
        await self.base._execute_with_retry("""
            INSERT INTO triggered_alerts
            (id, rule_id, rule_name, timestamp, severity, device_id, flow_id,
             metric, value, description, acknowledged)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            alert.id, alert.ruleId, alert.ruleName, alert.timestamp, alert.severity,
            alert.deviceId, alert.flowId, alert.metric, alert.value, alert.description,
            1 if alert.acknowledged else 0
        ))
        await self.base._ensure_connection()
        await self.base.db.commit()

    async def get_triggered_alerts(self, limit: int = 100, acknowledged: Optional[bool] = None) -> List[TriggeredAlert]:
        """List triggered alerts, most recent first, optionally filtered by acknowledged state"""
        query = "SELECT * FROM triggered_alerts"
        params: list = []
        if acknowledged is not None:
            query += " WHERE acknowledged = ?"
            params.append(1 if acknowledged else 0)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_triggered_alert(row) for row in rows]
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_triggered_alert(row) for row in rows]

    async def acknowledge_triggered_alert(self, alert_id: str) -> bool:
        """Mark a triggered alert as acknowledged"""
        await self.base._ensure_connection()
        cursor = await self.base.db.execute(
            "UPDATE triggered_alerts SET acknowledged = 1 WHERE id = ?", (alert_id,)
        )
        await self.base.db.commit()
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
