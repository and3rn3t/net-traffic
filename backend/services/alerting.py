"""
Alert rule evaluation service.

Evaluates user-configured AlertRule conditions against finalized
NetworkFlow objects on the packet-capture hot path. Rules are cached in
memory (refreshed on every CRUD operation) so per-flow evaluation never
needs a database round trip.
"""
import logging
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

from models.alerts import AlertRule, TriggeredAlert
from models.types import NetworkFlow
from services.storage import StorageService

logger = logging.getLogger(__name__)


class AlertingService:
    def __init__(self, storage: StorageService, on_alert_triggered: Optional[Callable] = None):
        self.storage = storage
        self.on_alert_triggered = on_alert_triggered
        self._rules_cache: List[AlertRule] = []
        # f"{rule_id}:{device_id}" -> monotonic seconds of last trigger, used
        # to enforce each rule's cooldown before re-alerting for the same device.
        self._last_triggered: Dict[str, float] = {}

    async def refresh_cache(self) -> None:
        """Reload enabled rules from storage. Call after any rule CRUD operation."""
        self._rules_cache = await self.storage.get_alert_rules(enabled_only=True)

    async def evaluate_flow(self, flow: NetworkFlow) -> None:
        """Check a finalized flow against all cached rules, triggering alerts as needed.

        Never raises - a broken rule must not interrupt flow finalization.
        """
        if not self._rules_cache:
            return
        for rule in self._rules_cache:
            try:
                value = self._extract_value(flow, rule.metric)
                if value is None:
                    continue
                if not self._matches(rule, value):
                    continue
                if self._in_cooldown(rule, flow.deviceId):
                    continue
                await self._trigger(rule, flow, value)
            except Exception:
                logger.exception(f"Error evaluating alert rule {rule.id} ({rule.metric})")

    def _extract_value(self, flow: NetworkFlow, metric: str) -> Any:
        return {
            "rtt": flow.rtt,
            "retransmissions": flow.retransmissions,
            "jitter": flow.jitter,
            "country": flow.country,
            "application": flow.application,
            "sni": flow.sni,
            "tcp_flags": flow.tcpFlags,
            "threat_level": flow.threatLevel,
        }.get(metric)

    def _matches(self, rule: AlertRule, value: Any) -> bool:
        op = rule.operator
        try:
            if op in ("gt", "gte", "lt", "lte") and rule.threshold is not None:
                numeric_value = float(value)
                if op == "gt":
                    return numeric_value > rule.threshold
                if op == "gte":
                    return numeric_value >= rule.threshold
                if op == "lt":
                    return numeric_value < rule.threshold
                return numeric_value <= rule.threshold

            if op == "eq":
                if rule.threshold is not None:
                    return float(value) == rule.threshold
                if rule.values:
                    return value in rule.values

            if op == "in" and rule.values:
                if isinstance(value, list):
                    return any(v in rule.values for v in value)
                return value in rule.values

            if op == "contains" and rule.values:
                if isinstance(value, list):
                    return any(needle in v for v in value for needle in rule.values)
                return any(needle in str(value) for needle in rule.values)
        except (TypeError, ValueError):
            return False
        return False

    def _in_cooldown(self, rule: AlertRule, device_id: str) -> bool:
        key = f"{rule.id}:{device_id}"
        last = self._last_triggered.get(key)
        if last is None:
            return False
        return (time.monotonic() - last) < rule.cooldownMinutes * 60

    async def _trigger(self, rule: AlertRule, flow: NetworkFlow, value: Any) -> None:
        self._last_triggered[f"{rule.id}:{flow.deviceId}"] = time.monotonic()

        alert = TriggeredAlert(
            id=str(uuid.uuid4()),
            ruleId=rule.id,
            ruleName=rule.name,
            timestamp=int(time.time() * 1000),
            severity=rule.severity,
            deviceId=flow.deviceId,
            flowId=flow.id,
            metric=rule.metric,
            value=str(value),
            description=f"'{rule.name}' triggered: {rule.metric} {rule.operator} (value={value})",
            acknowledged=False,
        )
        try:
            await self.storage.add_triggered_alert(alert)
        except Exception:
            logger.exception("Failed to persist triggered alert")
            return

        if self.on_alert_triggered:
            try:
                await self.on_alert_triggered(alert)
            except Exception:
                logger.exception("Failed to notify triggered alert")
