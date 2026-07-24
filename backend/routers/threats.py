"""Threat endpoints."""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException

import state
from models.auth import User
from models.types import Threat
from utils.auth_dependencies import require_operator_or_admin
from utils.constants import ErrorMessages
from utils.error_handler import handle_endpoint_error_call
from utils.validators import ThreatIdPath

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["threats"])


@router.get("/threats", response_model=List[Threat])
async def get_threats(active_only: bool = True):
    """Get threat alerts."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    return await state.storage.get_threats(active_only=active_only)


@router.post("/threats/{threat_id}/dismiss")
async def dismiss_threat(
    threat_id: str = ThreatIdPath(),
    current_user: User = Depends(require_operator_or_admin),
):
    """Dismiss a threat alert — requires operator or admin role."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    threat = await handle_endpoint_error_call(
        lambda: state.storage.get_threat(threat_id), f"Failed to retrieve threat {threat_id}"
    )
    if not threat:
        raise HTTPException(status_code=404, detail=ErrorMessages.THREAT_NOT_FOUND)
    threat.dismissed = True
    await handle_endpoint_error_call(
        lambda: state.storage.upsert_threat(threat), f"Failed to dismiss threat {threat_id}"
    )
    try:
        await state.on_threat_update(threat)
    except Exception as e:
        logger.warning(f"Failed to notify WebSocket clients: {e}")
    return {"status": "dismissed", "threat_id": threat_id}
