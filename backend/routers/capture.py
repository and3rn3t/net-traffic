"""Packet capture control endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

import state
from models.auth import User
from utils.auth_dependencies import get_current_user_optional
from utils.constants import ErrorMessages

router = APIRouter(prefix="/api/capture", tags=["capture"])


@router.post("/start")
async def start_capture(current_user: Optional[User] = Depends(get_current_user_optional)):
    """Start packet capture — optional authentication for testing."""
    if not state.packet_capture:
        raise HTTPException(status_code=503, detail=ErrorMessages.CAPTURE_NOT_INIT)
    if state.packet_capture.is_running():
        return {"status": "already_running"}
    await state.packet_capture.start()
    return {"status": "started"}


@router.post("/stop")
async def stop_capture(current_user: Optional[User] = Depends(get_current_user_optional)):
    """Stop packet capture — optional authentication for testing."""
    if not state.packet_capture:
        raise HTTPException(status_code=503, detail=ErrorMessages.CAPTURE_NOT_INIT)
    try:
        await state.packet_capture.stop()
        return {"status": "stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop packet capture: {str(e)}")


@router.get("/status")
async def capture_status():
    """Get packet capture status."""
    if not state.packet_capture:
        return {"running": False, "error": "not_initialized"}
    return {
        "running": state.packet_capture.is_running(),
        "interface": state.packet_capture.interface,
        "packets_captured": state.packet_capture.packets_captured,
        "flows_detected": state.packet_capture.flows_detected,
    }
