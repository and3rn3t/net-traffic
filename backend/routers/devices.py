"""Device endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import state
from models.auth import User
from models.requests import DeviceUpdateRequest
from models.types import Device
from utils.auth_dependencies import require_operator_or_admin
from utils.constants import ErrorMessages
from utils.error_handler import handle_endpoint_error_call
from utils.validators import DeviceIdPath, HoursQuery, LimitQuery, OffsetQuery
from utils.validators import validate_string_param

router = APIRouter(prefix="/api", tags=["devices"])


@router.get("/devices", response_model=List[Device])
async def get_devices():
    """Get all discovered devices."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    return await handle_endpoint_error_call(lambda: state.storage.get_devices(), "Failed to retrieve devices")


@router.get("/devices/{device_id}", response_model=Device)
async def get_device(device_id: str = DeviceIdPath()):
    """Get specific device details."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    device = await handle_endpoint_error_call(
        lambda: state.storage.get_device(device_id), f"Failed to retrieve device {device_id}"
    )
    if not device:
        raise HTTPException(status_code=404, detail=ErrorMessages.DEVICE_NOT_FOUND)
    return device


@router.patch("/devices/{device_id}")
async def update_device(
    device_id: str = DeviceIdPath(),
    update: DeviceUpdateRequest = ...,
    current_user: User = Depends(require_operator_or_admin),
):
    """Update device information (name, notes, type) — requires operator or admin role."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    device = await state.storage.get_device(device_id)
    if not device:
        raise HTTPException(status_code=404, detail=ErrorMessages.DEVICE_NOT_FOUND)

    if update.name is not None:
        update.name = validate_string_param(update.name, "name", max_length=200)
    if update.notes is not None:
        update.notes = validate_string_param(update.notes, "notes", max_length=1000)
    if update.type is not None:
        valid_types = ["smartphone", "laptop", "desktop", "tablet", "iot", "server", "unknown"]
        if update.type not in valid_types:
            raise HTTPException(status_code=400, detail=f"type must be one of {valid_types}, got {update.type}")

    if update.name is not None:
        device.name = update.name
    if update.type is not None:
        device.type = update.type
    if update.notes is not None:
        device.notes = update.notes

    await state.storage.upsert_device(device)
    await state.on_device_update(device)
    return device


@router.get("/devices/{device_id}/analytics")
async def get_device_analytics(device_id: str = DeviceIdPath(), hours: int = HoursQuery(24, 720)):
    """Get detailed analytics for a specific device."""
    if not state.advanced_analytics:
        raise HTTPException(status_code=503, detail=ErrorMessages.ADV_ANALYTICS_NOT_INIT)
    result = await handle_endpoint_error_call(
        lambda: state.advanced_analytics.get_device_analytics(device_id, hours_back=hours),
        f"Failed to retrieve analytics for device {device_id}",
    )
    if not result:
        raise HTTPException(status_code=404, detail=ErrorMessages.DEVICE_NOT_FOUND)
    return result


@router.get("/analytics/devices/{device_id}/applications")
async def get_device_application_profile(device_id: str = DeviceIdPath(), hours: int = HoursQuery(24, 720)):
    """Get application usage profile for a specific device."""
    if not state.application_analytics:
        raise HTTPException(status_code=503, detail="Application analytics not initialized")
    return await handle_endpoint_error_call(
        lambda: state.application_analytics.get_device_application_profile(device_id, hours),
        "Failed to retrieve device application profile",
    )
