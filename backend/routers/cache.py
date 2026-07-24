"""Cache management endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import state
from models.auth import User
from utils.auth_dependencies import get_current_active_user, require_operator_or_admin

router = APIRouter(prefix="/api/cache", tags=["cache"])


@router.get("/stats")
async def get_cache_stats(current_user: User = Depends(get_current_active_user)):
    """Get cache statistics (requires authentication)."""
    if not state.cache_service or not state.cache_service.is_enabled():
        return {"enabled": False, "message": "Caching disabled or unavailable"}
    return await state.cache_service.get_stats()


@router.post("/invalidate")
async def invalidate_cache(
    pattern: Optional[str] = Query(None, description="Pattern to invalidate (e.g., 'analytics:*')"),
    current_user: User = Depends(require_operator_or_admin),
):
    """Invalidate cache entries (requires operator or admin role)."""
    if not state.cache_service or not state.cache_service.is_enabled():
        raise HTTPException(status_code=503, detail="Cache service not available")
    if pattern:
        deleted = await state.cache_service.delete_pattern(pattern)
        return {"status": "success", "message": f"Invalidated cache entries matching pattern: {pattern}", "keys_deleted": deleted}
    await state.cache_service.invalidate_analytics()
    return {"status": "success", "message": "Invalidated all analytics caches"}
