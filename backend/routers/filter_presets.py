"""Saved flow filter preset endpoints."""
import logging
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

import state
from models.auth import User
from models.requests import FilterPresetCreate
from models.types import FilterPreset
from utils.auth_dependencies import get_current_active_user
from utils.constants import ErrorMessages
from utils.error_handler import handle_endpoint_error_call

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/filter-presets", tags=["filter-presets"])

MAX_PRESETS_PER_USER = 50


@router.post("", response_model=FilterPreset, status_code=status.HTTP_201_CREATED)
async def create_filter_preset(
    preset_create: FilterPresetCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Save a new named flow filter preset for the current user."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)

    existing = await state.storage.get_filter_presets(current_user.id)
    if len(existing) >= MAX_PRESETS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum of {MAX_PRESETS_PER_USER} saved presets reached",
        )

    preset = FilterPreset(
        id=str(uuid.uuid4()),
        userId=current_user.id,
        name=preset_create.name,
        filters=preset_create.filters,
        createdAt=int(datetime.now(timezone.utc).timestamp() * 1000),
    )
    await handle_endpoint_error_call(
        lambda: state.storage.add_filter_preset(preset), "Failed to save filter preset"
    )
    return preset


@router.get("", response_model=List[FilterPreset])
async def list_filter_presets(current_user: User = Depends(get_current_active_user)):
    """List the current user's saved filter presets."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    return await handle_endpoint_error_call(
        lambda: state.storage.get_filter_presets(current_user.id), "Failed to retrieve filter presets"
    )


@router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_filter_preset(
    preset_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Delete one of the current user's saved filter presets."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    deleted = await handle_endpoint_error_call(
        lambda: state.storage.delete_filter_preset(preset_id, current_user.id),
        "Failed to delete filter preset",
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter preset not found")
    return None
