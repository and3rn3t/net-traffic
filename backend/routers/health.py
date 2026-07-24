"""Health check endpoints."""
from datetime import datetime

from fastapi import APIRouter, HTTPException

import state
from utils.constants import ErrorMessages

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health():
    """Health check endpoint with detailed status."""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "storage": state.storage is not None,
            "packet_capture": state.packet_capture is not None,
            "device_service": state.device_service is not None,
            "threat_service": state.threat_service is not None,
            "analytics": state.analytics is not None,
        },
        "capture": {
            "running": state.packet_capture.is_running() if state.packet_capture else False,
            "interface": state.packet_capture.interface if state.packet_capture else None,
            "packets_captured": state.packet_capture.packets_captured if state.packet_capture else 0,
            "performance_stats": {
                "packets_dropped": getattr(state.packet_capture, "_packets_dropped", 0),
                "packets_duplicate": getattr(state.packet_capture, "_packets_duplicate", 0),
                "active_flows_count": len(getattr(state.packet_capture, "_active_flows", {})),
            } if state.packet_capture else {},
            "flows_detected": state.packet_capture.flows_detected if state.packet_capture else 0,
        },
        "database": {
            "active_flows": await state.storage.count_flows() if state.storage else 0,
            "active_devices": await state.storage.count_devices() if state.storage else 0,
        },
        "websocket": {
            "active_connections": len(state.active_connections),
        },
    }

    if not state.storage or not state.packet_capture:
        health_status["status"] = "degraded"
    if not state.packet_capture or not state.packet_capture.is_running():
        health_status["status"] = "unhealthy"

    return health_status


@router.get("/storage")
async def health_storage():
    """Health check for storage service."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    try:
        db_stats = await state.storage.get_database_stats()
        return {
            "status": "healthy",
            "service": "storage",
            "timestamp": datetime.now().isoformat(),
            "database": {"connected": True, "path": state.storage.db_path, "stats": db_stats},
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Storage service unhealthy: {str(e)}")


@router.get("/capture")
async def health_capture():
    """Health check for packet capture service."""
    if not state.packet_capture:
        raise HTTPException(status_code=503, detail=ErrorMessages.CAPTURE_NOT_INIT)
    return {
        "status": "healthy" if state.packet_capture.is_running() else "inactive",
        "service": "packet_capture",
        "timestamp": datetime.now().isoformat(),
        "capture": {
            "running": state.packet_capture.is_running(),
            "interface": state.packet_capture.interface,
            "packets_captured": state.packet_capture.packets_captured,
        },
    }


@router.get("/analytics")
async def health_analytics():
    """Health check for analytics services."""
    services_status = {
        "analytics": state.analytics is not None,
        "advanced_analytics": state.advanced_analytics is not None,
        "network_quality_analytics": state.network_quality_analytics is not None,
        "application_analytics": state.application_analytics is not None,
    }
    return {
        "status": "healthy" if all(services_status.values()) else "degraded",
        "service": "analytics",
        "timestamp": datetime.now().isoformat(),
        "services": services_status,
    }


@router.get("/device")
async def health_device():
    """Health check for device fingerprinting service."""
    if not state.device_service:
        raise HTTPException(status_code=503, detail="Device service not initialized")
    return {"status": "healthy", "service": "device_fingerprinting", "timestamp": datetime.now().isoformat()}


@router.get("/threat")
async def health_threat():
    """Health check for threat detection service."""
    if not state.threat_service:
        raise HTTPException(status_code=503, detail="Threat detection service not initialized")
    return {"status": "healthy", "service": "threat_detection", "timestamp": datetime.now().isoformat()}


@router.get("/cache")
async def health_cache():
    """Health check for cache service."""
    if not state.cache_service:
        return {"status": "disabled", "service": "cache", "timestamp": datetime.now().isoformat(), "message": "Cache service not initialized"}
    if not state.cache_service.is_enabled():
        return {"status": "disabled", "service": "cache", "timestamp": datetime.now().isoformat(), "message": "Redis connection unavailable - caching disabled"}
    stats = await state.cache_service.get_stats()
    return {"status": "healthy", "service": "cache", "timestamp": datetime.now().isoformat(), "stats": stats}


@router.get("/db-pool")
async def health_db_pool():
    """Health check for database connection pool."""
    if not state.storage:
        return {"status": "unavailable", "service": "db_pool", "timestamp": datetime.now().isoformat(), "message": "Storage service not initialized"}
    pool_stats = state.storage.get_pool_stats()
    if pool_stats.get("pool_enabled") is False:
        return {"status": "disabled", "service": "db_pool", "timestamp": datetime.now().isoformat(), **pool_stats}
    return {"status": "healthy", "service": "db_pool", "timestamp": datetime.now().isoformat(), **pool_stats}
