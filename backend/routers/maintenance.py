"""Maintenance, search, and data export endpoints."""
import csv
import logging
from datetime import datetime
from io import StringIO
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

import state
from utils.constants import ErrorMessages
from utils.error_handler import handle_endpoint_error_call
from utils.validators import LimitQuery, validate_string_param, validate_time_range

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["maintenance"])


@router.post("/maintenance/cleanup")
async def trigger_cleanup(days: Optional[int] = Query(None, ge=1, le=365)):
    """Manually trigger data cleanup."""
    if not state.storage:
        raise HTTPException(status_code=503, detail="Storage service not initialized")
    from utils.config import config
    retention_days = days or config.data_retention_days
    if retention_days < 1 or retention_days > 365:
        raise HTTPException(status_code=400, detail="retention_days must be between 1 and 365")
    result = await handle_endpoint_error_call(
        lambda: state.storage.cleanup_old_data(days=retention_days), "Failed to cleanup old data"
    )
    return {"status": "success", "retention_days": retention_days, **result}


@router.get("/maintenance/stats")
async def get_database_stats():
    """Get database statistics."""
    if not state.storage:
        raise HTTPException(status_code=503, detail="Storage service not initialized")
    return await state.storage.get_database_stats()


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    type: str = Query("all", pattern="^(all|devices|flows|threats)$"),
    limit: int = LimitQuery(50, 200),
):
    """Search across devices, flows, and threats."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    q = validate_string_param(q, "query", min_length=1, max_length=200)
    results: dict = {"query": q, "type": type, "devices": [], "flows": [], "threats": []}
    if type in ["all", "devices"]:
        results["devices"] = await state.storage.search_devices(q, limit)
    if type in ["all", "flows"]:
        results["flows"] = await state.storage.search_flows(q, limit)
    if type in ["all", "threats"]:
        results["threats"] = await handle_endpoint_error_call(
            lambda: state.storage.search_threats(q, limit, active_only=False), "Failed to search threats"
        )
    return results


@router.get("/export/flows")
async def export_flows(
    format: str = Query("json", pattern="^(json|csv)$"),
    start_time: Optional[int] = Query(None, ge=0),
    end_time: Optional[int] = Query(None, ge=0),
    device_id: Optional[str] = Query(None, min_length=1, max_length=100),
):
    """Export flows as JSON or CSV."""
    if not state.storage:
        raise HTTPException(status_code=503, detail=ErrorMessages.STORAGE_NOT_INIT)
    start_time, end_time = validate_time_range(start_time, end_time)
    flows = await state.storage.get_flows(limit=10000, start_time=start_time, end_time=end_time, device_id=device_id)

    if format.lower() == "csv":
        output = StringIO()  # type: ignore
        fieldnames = [
            "id", "timestamp", "source_ip", "source_port", "dest_ip", "dest_port",
            "protocol", "bytes_in", "bytes_out", "packets_in", "packets_out",
            "duration", "status", "country", "city", "asn", "domain", "sni",
            "threat_level", "device_id", "tcp_flags", "ttl", "connection_state",
            "rtt", "retransmissions", "jitter", "application", "user_agent",
            "http_method", "url", "dns_query_type", "dns_response_code",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for flow in flows:
            writer.writerow({
                "id": flow.id, "timestamp": flow.timestamp,
                "source_ip": flow.sourceIp, "source_port": flow.sourcePort,
                "dest_ip": flow.destIp, "dest_port": flow.destPort,
                "protocol": flow.protocol, "bytes_in": flow.bytesIn, "bytes_out": flow.bytesOut,
                "packets_in": flow.packetsIn, "packets_out": flow.packetsOut,
                "duration": flow.duration, "status": flow.status,
                "country": flow.country or "", "city": flow.city or "", "asn": flow.asn or "",
                "domain": flow.domain or "", "sni": flow.sni or "",
                "threat_level": flow.threatLevel, "device_id": flow.deviceId,
                "tcp_flags": ",".join(flow.tcpFlags) if flow.tcpFlags else "",
                "ttl": flow.ttl or "", "connection_state": flow.connectionState or "",
                "rtt": flow.rtt or "", "retransmissions": flow.retransmissions or "",
                "jitter": flow.jitter or "", "application": flow.application or "",
                "user_agent": flow.userAgent or "", "http_method": flow.httpMethod or "",
                "url": flow.url or "", "dns_query_type": flow.dnsQueryType or "",
                "dns_response_code": flow.dnsResponseCode or "",
            })
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=flows_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"},
        )
    return {"export_date": datetime.now().isoformat(), "count": len(flows), "flows": [flow.dict() for flow in flows]}
