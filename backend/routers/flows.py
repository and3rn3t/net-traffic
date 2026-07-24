"""Flow endpoints."""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

import state
from models.types import NetworkFlow
from utils.constants import ErrorMessages
from utils.error_handler import handle_endpoint_error_call
from utils.validators import (
    FlowIdPath, HoursQuery, IPQuery, LimitQuery, OffsetQuery,
    StatusQuery, ThreatLevelQuery, validate_min_bytes, validate_time_range,
)

router = APIRouter(prefix="/api", tags=["flows"])


@router.get("/flows", response_model=List[NetworkFlow])
async def get_flows(
    limit: int = LimitQuery(100, 1000),
    offset: int = OffsetQuery(0),
    device_id: Optional[str] = Query(None, min_length=1, max_length=100),
    status: Optional[str] = StatusQuery(),
    protocol: Optional[str] = Query(None, min_length=1, max_length=20),
    start_time: Optional[int] = Query(None, ge=0),
    end_time: Optional[int] = Query(None, ge=0),
    source_ip: Optional[str] = IPQuery("Source IP address"),
    dest_ip: Optional[str] = IPQuery("Destination IP address"),
    threat_level: Optional[str] = ThreatLevelQuery(),
    min_bytes: Optional[int] = Query(None, ge=0),
    country: Optional[str] = Query(None, min_length=2, max_length=2),
    city: Optional[str] = Query(None, min_length=1, max_length=100),
    application: Optional[str] = Query(None, min_length=1, max_length=50),
    min_rtt: Optional[int] = Query(None, ge=0),
    max_rtt: Optional[int] = Query(None, ge=0),
    max_jitter: Optional[float] = Query(None, ge=0),
    max_retransmissions: Optional[int] = Query(None, ge=0),
    sni: Optional[str] = Query(None, min_length=1, max_length=255),
    connection_state: Optional[str] = Query(None),
):
    """Get network flows with advanced filtering options."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    start_time, end_time = validate_time_range(start_time, end_time)
    if min_bytes is not None:
        min_bytes = validate_min_bytes(min_bytes)
    return await handle_endpoint_error_call(
        lambda: state.storage.get_flows(
            limit=limit, offset=offset, device_id=device_id, status=status,
            protocol=protocol, start_time=start_time, end_time=end_time,
            source_ip=source_ip, dest_ip=dest_ip, threat_level=threat_level,
            min_bytes=min_bytes, country=country, city=city, application=application,
            min_rtt=min_rtt, max_rtt=max_rtt, max_jitter=max_jitter,
            max_retransmissions=max_retransmissions, sni=sni, connection_state=connection_state,
        ),
        "Failed to retrieve flows",
    )


@router.get("/flows/{flow_id}", response_model=NetworkFlow)
async def get_flow(flow_id: str = FlowIdPath()):
    """Get specific flow details."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    flow = await handle_endpoint_error_call(
        lambda: state.storage.get_flow(flow_id), f"Failed to retrieve flow {flow_id}"
    )
    if not flow:
        raise HTTPException(status_code=404, detail=ErrorMessages.FLOW_NOT_FOUND)
    return flow
