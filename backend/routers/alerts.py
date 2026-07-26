"""Configurable alert rule and triggered-alert endpoints."""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

import state
from models.alerts import (
    AlertRule, AlertRuleCreate, AlertRuleUpdate, TriggeredAlert, validate_rule_fields,
)
from models.auth import User
from utils.auth_dependencies import get_current_active_user
from utils.constants import ErrorMessages
from utils.error_handler import handle_endpoint_error_call

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/alerts", tags=["alerts"])

MAX_RULES_PER_USER = 50


def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


@router.post("/rules", response_model=AlertRule, status_code=status.HTTP_201_CREATED)
async def create_alert_rule(
    rule_create: AlertRuleCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Create a new configurable alert rule for the current user."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    if not state.alerting_service:
        raise HTTPException(status_code=503, detail="Alerting service not available")

    error = validate_rule_fields(
        rule_create.metric, rule_create.operator, rule_create.threshold, rule_create.values
    )
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    existing = await state.storage.get_alert_rules(current_user.id)
    if len(existing) >= MAX_RULES_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum of {MAX_RULES_PER_USER} alert rules reached",
        )

    now = _now_ms()
    rule = AlertRule(
        id=str(uuid.uuid4()),
        userId=current_user.id,
        name=rule_create.name,
        enabled=rule_create.enabled,
        metric=rule_create.metric,
        operator=rule_create.operator,
        threshold=rule_create.threshold,
        values=rule_create.values,
        severity=rule_create.severity,
        cooldownMinutes=rule_create.cooldownMinutes,
        createdAt=now,
        updatedAt=now,
    )
    await handle_endpoint_error_call(
        lambda: state.storage.add_alert_rule(rule), "Failed to save alert rule"
    )
    await state.alerting_service.refresh_cache()
    return rule


@router.get("/rules", response_model=List[AlertRule])
async def list_alert_rules(current_user: User = Depends(get_current_active_user)):
    """List the current user's configurable alert rules."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    return await handle_endpoint_error_call(
        lambda: state.storage.get_alert_rules(current_user.id), "Failed to retrieve alert rules"
    )


@router.patch("/rules/{rule_id}", response_model=AlertRule)
async def update_alert_rule(
    rule_id: str,
    rule_update: AlertRuleUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Update one of the current user's alert rules."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    if not state.alerting_service:
        raise HTTPException(status_code=503, detail="Alerting service not available")

    rule = await handle_endpoint_error_call(
        lambda: state.storage.get_alert_rule(rule_id), f"Failed to retrieve alert rule {rule_id}"
    )
    if not rule or rule.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")

    updated = rule.model_copy(
        update={k: v for k, v in rule_update.model_dump(exclude_unset=True).items()}
    )
    error = validate_rule_fields(updated.metric, updated.operator, updated.threshold, updated.values)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    updated.updatedAt = _now_ms()
    await handle_endpoint_error_call(
        lambda: state.storage.update_alert_rule(updated), f"Failed to update alert rule {rule_id}"
    )
    await state.alerting_service.refresh_cache()
    return updated


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_rule(
    rule_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Delete one of the current user's alert rules."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    if not state.alerting_service:
        raise HTTPException(status_code=503, detail="Alerting service not available")

    deleted = await handle_endpoint_error_call(
        lambda: state.storage.delete_alert_rule(rule_id, current_user.id),
        "Failed to delete alert rule",
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")
    await state.alerting_service.refresh_cache()
    return None


@router.get("/triggered", response_model=List[TriggeredAlert])
async def list_triggered_alerts(
    limit: int = Query(default=100, ge=1, le=500),
    acknowledged: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
):
    """List triggered alerts, most recent first."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    return await handle_endpoint_error_call(
        lambda: state.storage.get_triggered_alerts(limit=limit, acknowledged=acknowledged),
        "Failed to retrieve triggered alerts",
    )


@router.post("/triggered/{alert_id}/acknowledge")
async def acknowledge_triggered_alert(
    alert_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Acknowledge a triggered alert."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    acknowledged = await handle_endpoint_error_call(
        lambda: state.storage.acknowledge_triggered_alert(alert_id),
        f"Failed to acknowledge alert {alert_id}",
    )
    if not acknowledged:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Triggered alert not found")
    return {"status": "acknowledged", "alert_id": alert_id}
