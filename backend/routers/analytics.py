"""Analytics and statistics endpoints."""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

import state
from models.types import AnalyticsData, ProtocolStats
from utils.constants import ErrorMessages
from utils.error_handler import handle_endpoint_error_call
from utils.validators import HoursQuery, LimitQuery

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/analytics", response_model=List[AnalyticsData])
async def get_analytics(hours: int = HoursQuery(24, 720)):
    """Get analytics data for specified time range."""
    if not state.analytics:
        raise HTTPException(status_code=503, detail=ErrorMessages.ANALYTICS_NOT_INIT)
    if state.cache_service and state.cache_service.is_enabled():
        cache_key = state.cache_service.key_analytics_summary(hours)
        cached = await state.cache_service.get(cache_key)
        if cached is not None:
            return cached
    result = await handle_endpoint_error_call(
        lambda: state.analytics.get_analytics_data(hours_back=hours), "Failed to retrieve analytics data"
    )
    if state.cache_service and state.cache_service.is_enabled():
        await state.cache_service.set(cache_key, result)
    return result


@router.get("/protocols", response_model=List[ProtocolStats])
async def get_protocol_stats():
    """Get protocol breakdown statistics."""
    if not state.analytics:
        raise HTTPException(status_code=503, detail=ErrorMessages.ANALYTICS_NOT_INIT)
    if state.cache_service and state.cache_service.is_enabled():
        cache_key = state.cache_service.key_protocol_distribution(24)
        cached = await state.cache_service.get(cache_key)
        if cached is not None:
            return cached
    result = await handle_endpoint_error_call(
        lambda: state.analytics.get_protocol_stats(), "Failed to retrieve protocol statistics"
    )
    if state.cache_service and state.cache_service.is_enabled():
        await state.cache_service.set(cache_key, result)
    return result


@router.get("/stats/summary")
async def get_summary_stats():
    """Get overall summary statistics."""
    if not state.advanced_analytics:
        raise HTTPException(status_code=503, detail=ErrorMessages.ADV_ANALYTICS_NOT_INIT)
    return await handle_endpoint_error_call(
        lambda: state.advanced_analytics.get_summary_stats(), "Failed to retrieve summary statistics"
    )


@router.get("/stats/geographic")
async def get_geographic_stats(hours: int = HoursQuery(24, 720)):
    """Get geographic distribution of connections."""
    if not state.advanced_analytics:
        raise HTTPException(status_code=503, detail=ErrorMessages.ADV_ANALYTICS_NOT_INIT)
    if state.cache_service and state.cache_service.is_enabled():
        cache_key = state.cache_service.key_geographic_data(hours)
        cached = await state.cache_service.get(cache_key)
        if cached is not None:
            return cached
    result = await handle_endpoint_error_call(
        lambda: state.advanced_analytics.get_geographic_distribution(hours_back=hours),
        "Failed to retrieve geographic statistics",
    )
    if state.cache_service and state.cache_service.is_enabled():
        await state.cache_service.set(cache_key, result)
    return result


@router.get("/stats/top/domains")
async def get_top_domains(limit: int = LimitQuery(20, 100), hours: int = HoursQuery(24, 720)):
    """Get top domains by traffic."""
    if not state.advanced_analytics:
        raise HTTPException(status_code=503, detail=ErrorMessages.ADV_ANALYTICS_NOT_INIT)
    if state.cache_service and state.cache_service.is_enabled():
        cache_key = f"analytics:top_domains:{hours}h:{limit}"
        cached = await state.cache_service.get(cache_key)
        if cached is not None:
            return cached
    result = await handle_endpoint_error_call(
        lambda: state.advanced_analytics.get_top_domains(limit=limit, hours_back=hours),
        "Failed to retrieve top domains",
    )
    if state.cache_service and state.cache_service.is_enabled():
        await state.cache_service.set(cache_key, result)
    return result


@router.get("/stats/top/devices")
async def get_top_devices(
    limit: int = LimitQuery(10, 100),
    hours: int = HoursQuery(24, 720),
    sort_by: str = Query("bytes", pattern="^(bytes|connections|threats)$"),
):
    """Get top devices by traffic."""
    if not state.advanced_analytics:
        raise HTTPException(status_code=503, detail=ErrorMessages.ADV_ANALYTICS_NOT_INIT)
    if state.cache_service and state.cache_service.is_enabled():
        cache_key = f"analytics:top_devices:{hours}h:{limit}:{sort_by}"
        cached = await state.cache_service.get(cache_key)
        if cached is not None:
            return cached
    result = await handle_endpoint_error_call(
        lambda: state.advanced_analytics.get_top_devices(limit=limit, hours_back=hours, sort_by=sort_by),
        "Failed to retrieve top devices",
    )
    if state.cache_service and state.cache_service.is_enabled():
        await state.cache_service.set(cache_key, result)
    return result


@router.get("/stats/bandwidth")
async def get_bandwidth_timeline(hours: int = HoursQuery(24, 720), interval_minutes: int = Query(5, ge=1, le=1440)):
    """Get bandwidth usage timeline."""
    if not state.advanced_analytics:
        raise HTTPException(status_code=503, detail=ErrorMessages.ADV_ANALYTICS_NOT_INIT)
    if state.cache_service and state.cache_service.is_enabled():
        cache_key = f"analytics:bandwidth:{hours}h:{interval_minutes}m"
        cached = await state.cache_service.get(cache_key)
        if cached is not None:
            return cached
    result = await handle_endpoint_error_call(
        lambda: state.advanced_analytics.get_bandwidth_timeline(hours_back=hours, interval_minutes=interval_minutes),
        "Failed to retrieve bandwidth timeline",
    )
    if state.cache_service and state.cache_service.is_enabled():
        await state.cache_service.set(cache_key, result)
    return result


@router.get("/analytics/rtt-trends")
async def get_rtt_trends(
    hours: int = HoursQuery(24, 720),
    device_id: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    interval_minutes: int = Query(15, ge=1, le=1440),
):
    """Get RTT trends over time."""
    if not state.network_quality_analytics:
        raise HTTPException(status_code=503, detail="Network quality analytics not initialized")
    return await handle_endpoint_error_call(
        lambda: state.network_quality_analytics.get_rtt_trends(hours, device_id, country, interval_minutes),
        "Failed to retrieve RTT trends",
    )


@router.get("/analytics/jitter")
async def get_jitter_analysis(hours: int = HoursQuery(24, 720), device_id: Optional[str] = Query(None)):
    """Get jitter analysis statistics."""
    if not state.network_quality_analytics:
        raise HTTPException(status_code=503, detail="Network quality analytics not initialized")
    return await handle_endpoint_error_call(
        lambda: state.network_quality_analytics.get_jitter_analysis(hours, device_id),
        "Failed to retrieve jitter analysis",
    )


@router.get("/analytics/retransmissions")
async def get_retransmission_report(hours: int = HoursQuery(24, 720), device_id: Optional[str] = Query(None)):
    """Get retransmission statistics report."""
    if not state.network_quality_analytics:
        raise HTTPException(status_code=503, detail="Network quality analytics not initialized")
    return await handle_endpoint_error_call(
        lambda: state.network_quality_analytics.get_retransmission_report(hours, device_id),
        "Failed to retrieve retransmission report",
    )


@router.get("/analytics/connection-quality")
async def get_connection_quality_summary(hours: int = HoursQuery(24, 720), device_id: Optional[str] = Query(None)):
    """Get overall connection quality summary."""
    if not state.network_quality_analytics:
        raise HTTPException(status_code=503, detail="Network quality analytics not initialized")
    return await handle_endpoint_error_call(
        lambda: state.network_quality_analytics.get_connection_quality_summary(hours, device_id),
        "Failed to retrieve connection quality summary",
    )


@router.get("/analytics/applications")
async def get_application_breakdown(
    hours: int = HoursQuery(24, 720),
    device_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """Get top applications by traffic."""
    if not state.application_analytics:
        raise HTTPException(status_code=503, detail="Application analytics not initialized")
    return await handle_endpoint_error_call(
        lambda: state.application_analytics.get_application_breakdown(hours, device_id, limit),
        "Failed to retrieve application breakdown",
    )


@router.get("/analytics/applications/trends")
async def get_application_trends(
    hours: int = HoursQuery(24, 720),
    application: Optional[str] = Query(None),
    interval_minutes: int = Query(15, ge=1, le=1440),
):
    """Get application usage trends over time."""
    if not state.application_analytics:
        raise HTTPException(status_code=503, detail="Application analytics not initialized")
    return await handle_endpoint_error_call(
        lambda: state.application_analytics.get_application_trends(hours, application, interval_minutes),
        "Failed to retrieve application trends",
    )
