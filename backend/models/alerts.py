"""
Configurable alert rule models.

An AlertRule expresses a single condition over a finalized NetworkFlow's
fields (e.g. "rtt gt 500"). When a flow matches an enabled rule, a
TriggeredAlert is recorded and broadcast to WebSocket clients.
"""
from typing import List, Optional

from pydantic import BaseModel, Field

# Metrics evaluated against numeric NetworkFlow fields.
NUMERIC_METRICS = ("rtt", "retransmissions", "jitter")
# Metrics evaluated against string/list NetworkFlow fields.
STRING_METRICS = ("country", "application", "sni", "tcp_flags", "threat_level")
ALL_METRICS = NUMERIC_METRICS + STRING_METRICS

NUMERIC_OPERATORS = ("gt", "gte", "lt", "lte", "eq")
STRING_OPERATORS = ("eq", "in", "contains")
ALL_OPERATORS = tuple(sorted(set(NUMERIC_OPERATORS) | set(STRING_OPERATORS)))

SEVERITIES = ("low", "medium", "high", "critical")


class AlertRule(BaseModel):
    id: str
    userId: str
    name: str
    enabled: bool = True
    metric: str  # one of ALL_METRICS
    operator: str  # one of ALL_OPERATORS
    threshold: Optional[float] = None  # required for NUMERIC_METRICS
    values: Optional[List[str]] = None  # required for STRING_METRICS
    severity: str = "medium"  # one of SEVERITIES
    cooldownMinutes: int = 15
    createdAt: int
    updatedAt: int


class AlertRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    metric: str
    operator: str
    threshold: Optional[float] = None
    values: Optional[List[str]] = None
    severity: str = "medium"
    cooldownMinutes: int = Field(default=15, ge=0, le=1440)
    enabled: bool = True


class AlertRuleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    metric: Optional[str] = None
    operator: Optional[str] = None
    threshold: Optional[float] = None
    values: Optional[List[str]] = None
    severity: Optional[str] = None
    cooldownMinutes: Optional[int] = Field(default=None, ge=0, le=1440)
    enabled: Optional[bool] = None


class TriggeredAlert(BaseModel):
    id: str
    ruleId: str
    ruleName: str
    timestamp: int
    severity: str
    deviceId: str
    flowId: str
    metric: str
    value: str
    description: str
    acknowledged: bool = False


def validate_rule_fields(metric: str, operator: str, threshold: Optional[float], values: Optional[List[str]]) -> Optional[str]:
    """Return an error message if the metric/operator/threshold/values combination is invalid, else None."""
    if metric not in ALL_METRICS:
        return f"Unknown metric '{metric}'. Must be one of: {', '.join(ALL_METRICS)}"
    if operator not in ALL_OPERATORS:
        return f"Unknown operator '{operator}'. Must be one of: {', '.join(ALL_OPERATORS)}"

    if metric in NUMERIC_METRICS:
        if operator not in NUMERIC_OPERATORS:
            return f"Metric '{metric}' requires one of these operators: {', '.join(NUMERIC_OPERATORS)}"
        if threshold is None:
            return f"Metric '{metric}' requires a numeric 'threshold' value"
    else:
        if operator not in STRING_OPERATORS:
            return f"Metric '{metric}' requires one of these operators: {', '.join(STRING_OPERATORS)}"
        if not values:
            return f"Metric '{metric}' requires a non-empty 'values' list"

    return None
