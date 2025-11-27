"""
NetInsight Backend API
Raspberry Pi 5 compatible network traffic analysis service
"""
import asyncio
import csv
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime
from io import StringIO
import logging

from fastapi import (
    FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from utils.rate_limit import RateLimitMiddleware

from services.packet_capture import PacketCaptureService
from services.device_fingerprinting import DeviceFingerprintingService
from services.threat_detection import ThreatDetectionService
from services.storage import StorageService
from services.analytics import AnalyticsService
from services.advanced_analytics import AdvancedAnalyticsService
from models.types import (
    NetworkFlow, Device, Threat, AnalyticsData, ProtocolStats
)
from models.requests import DeviceUpdateRequest
from utils.config import config
from utils.validators import (
    LimitQuery, OffsetQuery, HoursQuery, IPQuery, StatusQuery,
    ThreatLevelQuery, DeviceIdPath, FlowIdPath, ThreatIdPath,
    validate_time_range, validate_min_bytes, validate_string_param
)
from utils.error_handler import handle_endpoint_error

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global services
packet_capture: Optional[PacketCaptureService] = None
device_service: Optional[DeviceFingerprintingService] = None
threat_service: Optional[ThreatDetectionService] = None
storage: Optional[StorageService] = None
analytics: Optional[AnalyticsService] = None
advanced_analytics: Optional[AdvancedAnalyticsService] = None

# WebSocket connections for real-time updates
active_connections: List[WebSocket] = []

# Callback for device updates
async def on_device_update(device: Device):
    """Callback when device is created or updated"""
    await notify_clients({
        "type": "device_update",
        "device": device.dict()
    })


# Callback for threat updates
async def on_threat_update(threat: Threat):
    """Callback when threat is created"""
    await notify_clients({
        "type": "threat_update",
        "threat": threat.dict()
    })


# Error messages
ERR_STORAGE_NOT_INIT = "Storage service not initialized"
ERR_DEVICE_NOT_FOUND = "Device not found"
ERR_FLOW_NOT_FOUND = "Flow not found"
ERR_THREAT_NOT_FOUND = "Threat not found"
ERR_ANALYTICS_NOT_INIT = "Analytics service not initialized"
ERR_ADV_ANALYTICS_NOT_INIT = "Advanced analytics service not initialized"
ERR_CAPTURE_NOT_INIT = "Packet capture not initialized"


async def _periodic_cleanup(storage: StorageService, interval_hours: int):
    """Periodic cleanup task for old data"""
    while True:
        try:
            await asyncio.sleep(interval_hours * 3600)  # Convert to seconds
            retention_days = config.data_retention_days
            logger.info(f"Running periodic cleanup (retention: {retention_days} days)")
            await storage.cleanup_old_data(days=retention_days)
        except asyncio.CancelledError:
            logger.info("Periodic cleanup task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in periodic cleanup: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle"""
    global packet_capture, device_service, threat_service, storage, analytics

    logger.info("Starting NetInsight Backend...")

    # Initialize storage
    storage = StorageService(db_path=config.db_path)
    await storage.initialize()

    # Initialize services with WebSocket callbacks
    device_service = DeviceFingerprintingService(storage, on_device_update=on_device_update)
    threat_service = ThreatDetectionService(storage, on_threat_update=on_threat_update)
    analytics = AnalyticsService(storage)
    global advanced_analytics
    advanced_analytics = AdvancedAnalyticsService(storage)

    # Initialize packet capture
    packet_capture = PacketCaptureService(
        interface=config.network_interface,
        device_service=device_service,
        threat_service=threat_service,
        storage=storage,
        on_flow_update=notify_clients
    )

    # Start packet capture in background
    capture_task = asyncio.create_task(packet_capture.start())

    # Start periodic cleanup task
    cleanup_interval_hours = 24  # Run cleanup once per day
    cleanup_task = asyncio.create_task(
        _periodic_cleanup(storage, cleanup_interval_hours)
    )

    logger.info(
        f"Packet capture started on interface: {config.network_interface}"
    )

    yield

    # Cleanup
    logger.info("Shutting down NetInsight Backend...")

    # Cancel cleanup task
    if 'cleanup_task' in locals():
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass

    # Stop packet capture
    if packet_capture:
        await packet_capture.stop()
    capture_task.cancel()
    try:
        await capture_task
    except asyncio.CancelledError:
        pass

    # Close storage
    await storage.close()


app = FastAPI(
    title="NetInsight API",
    description="Network traffic analysis backend for Raspberry Pi 5",
    version="1.0.0",
    lifespan=lifespan
)

# Rate limiting (before CORS)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=config.rate_limit_per_minute
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def notify_clients(data: dict):
    """Notify all connected WebSocket clients of updates with retry logic"""
    if not active_connections:
        return

    disconnected = []
    failed_connections = []

    for connection in active_connections:
        try:
            # Attempt to send with timeout
            await asyncio.wait_for(
                connection.send_json(data),
                timeout=5.0  # 5 second timeout
            )
        except asyncio.TimeoutError:
            logger.warning("WebSocket send timeout - connection may be slow")
            failed_connections.append(connection)
        except (ConnectionError, RuntimeError) as e:
            # Permanent connection errors - remove immediately
            logger.debug(f"Permanent WebSocket error: {e}")
            disconnected.append(connection)
        except Exception as e:
            # Other errors - try to classify
            error_str = str(e).lower()
            if any(keyword in error_str for keyword in [
                'closed', 'disconnect', 'broken', 'reset'
            ]):
                # Connection is definitely closed
                logger.debug(f"WebSocket connection closed: {e}")
                disconnected.append(connection)
            else:
                # Unknown error - log and mark for retry
                logger.warning(f"Unknown WebSocket error: {e}")
                failed_connections.append(connection)

    # Remove permanently disconnected clients
    for conn in disconnected:
        if conn in active_connections:
            active_connections.remove(conn)
            logger.info(f"Removed disconnected WebSocket client. "
                       f"Remaining: {len(active_connections)}")

    # Retry failed connections once (for transient errors)
    if failed_connections:
        await asyncio.sleep(0.1)  # Brief delay before retry
        for connection in failed_connections[:]:  # Copy list to avoid modification during iteration
            try:
                await asyncio.wait_for(
                    connection.send_json(data),
                    timeout=2.0
                )
                failed_connections.remove(connection)
            except Exception as e:
                # Retry also failed - treat as permanent
                logger.warning(f"WebSocket retry failed: {e}")
                if connection in active_connections:
                    active_connections.remove(connection)
                    logger.info(f"Removed WebSocket client after failed retry. "
                               f"Remaining: {len(active_connections)}")


# API Routes

@app.get("/")
async def root():
    return {
        "service": "NetInsight Backend",
        "version": "1.0.0",
        "status": "running",
        "packet_capture": "active" if packet_capture and packet_capture.is_running() else "inactive"
    }


@app.get("/api/health")
async def health():
    """Health check endpoint with detailed status"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "storage": storage is not None,
            "packet_capture": packet_capture is not None,
            "device_service": device_service is not None,
            "threat_service": threat_service is not None,
            "analytics": analytics is not None,
        },
        "capture": {
            "running": packet_capture.is_running() if packet_capture else False,
            "interface": (
                packet_capture.interface
                if packet_capture
                else None
            ),
            "packets_captured": (
                packet_capture.packets_captured
                if packet_capture
                else 0
            ),
            "flows_detected": (
                packet_capture.flows_detected
                if packet_capture
                else 0
            ),
        },
        "database": {
            "active_flows": await storage.count_flows() if storage else 0,
            "active_devices": await storage.count_devices() if storage else 0,
        },
        "websocket": {
            "active_connections": len(active_connections)
        }
    }

    # Determine overall health status
    if not storage or not packet_capture:
        health_status["status"] = "degraded"
    if not packet_capture or not packet_capture.is_running():
        health_status["status"] = "unhealthy"

    return health_status


@app.get("/api/devices", response_model=List[Device])
async def get_devices():
    """Get all discovered devices"""
    if not storage:
        raise HTTPException(
            status_code=503,
            detail=ERR_STORAGE_NOT_INIT
        )
    
    return await handle_endpoint_error(
        lambda: storage.get_devices(),
        "Failed to retrieve devices"
    )


@app.get("/api/devices/{device_id}", response_model=Device)
async def get_device(device_id: str = DeviceIdPath()):
    """Get specific device details"""
    if not storage:
        raise HTTPException(status_code=503, detail=ERR_STORAGE_NOT_INIT)
    
    device = await handle_endpoint_error(
        lambda: storage.get_device(device_id),
        f"Failed to retrieve device {device_id}"
    )
    
    if not device:
        raise HTTPException(status_code=404, detail=ERR_DEVICE_NOT_FOUND)
    return device


@app.get("/api/flows", response_model=List[NetworkFlow])
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
    min_bytes: Optional[int] = Query(None, ge=0)
):
    """Get network flows with advanced filtering options"""
    if not storage:
        raise HTTPException(status_code=503, detail=ERR_STORAGE_NOT_INIT)

    # Validate time range
    start_time, end_time = validate_time_range(start_time, end_time)

    # Validate min_bytes if provided
    if min_bytes is not None:
        min_bytes = validate_min_bytes(min_bytes)

    return await handle_endpoint_error(
        lambda: storage.get_flows(
            limit=limit,
            offset=offset,
            device_id=device_id,
            status=status,
            protocol=protocol,
            start_time=start_time,
            end_time=end_time,
            source_ip=source_ip,
            dest_ip=dest_ip,
            threat_level=threat_level,
            min_bytes=min_bytes
        ),
        "Failed to retrieve flows"
    )


@app.get("/api/flows/{flow_id}", response_model=NetworkFlow)
async def get_flow(flow_id: str = FlowIdPath()):
    """Get specific flow details"""
    if not storage:
        raise HTTPException(status_code=503, detail=ERR_STORAGE_NOT_INIT)
    
    flow = await handle_endpoint_error(
        lambda: storage.get_flow(flow_id),
        f"Failed to retrieve flow {flow_id}"
    )
    
    if not flow:
        raise HTTPException(status_code=404, detail=ERR_FLOW_NOT_FOUND)
    return flow


@app.get("/api/threats", response_model=List[Threat])
async def get_threats(active_only: bool = True):
    """Get threat alerts"""
    if not storage:
        raise HTTPException(status_code=503, detail=ERR_STORAGE_NOT_INIT)
    return await storage.get_threats(active_only=active_only)


@app.post("/api/threats/{threat_id}/dismiss")
async def dismiss_threat(threat_id: str = ThreatIdPath()):
    """Dismiss a threat alert"""
    if not storage:
        raise HTTPException(status_code=503, detail=ERR_STORAGE_NOT_INIT)
    
    threat = await handle_endpoint_error(
        lambda: storage.get_threat(threat_id),
        f"Failed to retrieve threat {threat_id}"
    )
    
    if not threat:
        raise HTTPException(status_code=404, detail=ERR_THREAT_NOT_FOUND)
    
    threat.dismissed = True
    
    await handle_endpoint_error(
        lambda: storage.upsert_threat(threat),
        f"Failed to dismiss threat {threat_id}"
    )
    
    # Notify WebSocket clients of threat update
    try:
        await on_threat_update(threat)
    except Exception as e:
        logger.warning(f"Failed to notify WebSocket clients: {e}")
    
    return {"status": "dismissed", "threat_id": threat_id}


@app.get("/api/analytics", response_model=List[AnalyticsData])
async def get_analytics(hours: int = HoursQuery(24, 720)):
    """Get analytics data for specified time range"""
    if not analytics:
        raise HTTPException(
            status_code=503, detail=ERR_ANALYTICS_NOT_INIT
        )
    
    return await handle_endpoint_error(
        lambda: analytics.get_analytics_data(hours_back=hours),
        "Failed to retrieve analytics data"
    )


@app.get("/api/protocols", response_model=List[ProtocolStats])
async def get_protocol_stats():
    """Get protocol breakdown statistics"""
    if not analytics:
        raise HTTPException(
            status_code=503, detail=ERR_ANALYTICS_NOT_INIT
        )
    
    return await handle_endpoint_error(
        lambda: analytics.get_protocol_stats(),
        "Failed to retrieve protocol statistics"
    )


@app.get("/api/stats/summary")
async def get_summary_stats():
    """Get overall summary statistics"""
    if not advanced_analytics:
        raise HTTPException(
            status_code=503, detail=ERR_ADV_ANALYTICS_NOT_INIT
        )
    
    return await handle_endpoint_error(
        lambda: advanced_analytics.get_summary_stats(),
        "Failed to retrieve summary statistics"
    )


@app.get("/api/stats/geographic")
async def get_geographic_stats(hours: int = HoursQuery(24, 720)):
    """Get geographic distribution of connections"""
    if not advanced_analytics:
        raise HTTPException(
            status_code=503, detail=ERR_ADV_ANALYTICS_NOT_INIT
        )
    
    return await handle_endpoint_error(
        lambda: advanced_analytics.get_geographic_distribution(
            hours_back=hours
        ),
        "Failed to retrieve geographic statistics"
    )


@app.get("/api/stats/top/domains")
async def get_top_domains(
    limit: int = LimitQuery(20, 100),
    hours: int = HoursQuery(24, 720)
):
    """Get top domains by traffic"""
    if not advanced_analytics:
        raise HTTPException(
            status_code=503, detail=ERR_ADV_ANALYTICS_NOT_INIT
        )
    
    return await handle_endpoint_error(
        lambda: advanced_analytics.get_top_domains(
            limit=limit, hours_back=hours
        ),
        "Failed to retrieve top domains"
    )


@app.get("/api/stats/top/devices")
async def get_top_devices(
    limit: int = LimitQuery(10, 100),
    hours: int = HoursQuery(24, 720),
    sort_by: str = Query("bytes", regex="^(bytes|connections|threats)$")
):
    """Get top devices by traffic"""
    if not advanced_analytics:
        raise HTTPException(
            status_code=503, detail=ERR_ADV_ANALYTICS_NOT_INIT
        )
    
    return await handle_endpoint_error(
        lambda: advanced_analytics.get_top_devices(
            limit=limit, hours_back=hours, sort_by=sort_by
        ),
        "Failed to retrieve top devices"
    )


@app.get("/api/stats/bandwidth")
async def get_bandwidth_timeline(
    hours: int = HoursQuery(24, 720),
    interval_minutes: int = Query(5, ge=1, le=1440)
):
    """Get bandwidth usage timeline"""
    if not advanced_analytics:
        raise HTTPException(
            status_code=503, detail=ERR_ADV_ANALYTICS_NOT_INIT
        )
    
    return await handle_endpoint_error(
        lambda: advanced_analytics.get_bandwidth_timeline(
            hours_back=hours, interval_minutes=interval_minutes
        ),
        "Failed to retrieve bandwidth timeline"
    )


@app.get("/api/devices/{device_id}/analytics")
async def get_device_analytics(
    device_id: str = DeviceIdPath(),
    hours: int = HoursQuery(24, 720)
):
    """Get detailed analytics for a specific device"""
    if not advanced_analytics:
        raise HTTPException(
            status_code=503, detail=ERR_ADV_ANALYTICS_NOT_INIT
        )
    
    result = await handle_endpoint_error(
        lambda: advanced_analytics.get_device_analytics(
            device_id, hours_back=hours
        ),
        f"Failed to retrieve analytics for device {device_id}"
    )
    
    if not result:
        raise HTTPException(status_code=404, detail=ERR_DEVICE_NOT_FOUND)
    return result


@app.patch("/api/devices/{device_id}")
async def update_device(
    device_id: str = DeviceIdPath(),
    update: DeviceUpdateRequest = ...
):
    """Update device information (name, notes, type)"""
    if not storage:
        raise HTTPException(status_code=503, detail=ERR_STORAGE_NOT_INIT)

    device = await storage.get_device(device_id)
    if not device:
        raise HTTPException(status_code=404, detail=ERR_DEVICE_NOT_FOUND)

    # Validate update fields
    if update.name is not None:
        update.name = validate_string_param(update.name, "name", max_length=200)
    if update.notes is not None:
        update.notes = validate_string_param(update.notes, "notes", max_length=1000)
    if update.type is not None:
        valid_types = ['smartphone', 'laptop', 'desktop', 'tablet', 'iot', 'server', 'unknown']
        if update.type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"type must be one of {valid_types}, got {update.type}"
            )

    # Update fields if provided
    if update.name is not None:
        device.name = update.name
    if update.type is not None:
        device.type = update.type
    # Note: notes field would need to be added to Device model
    # For now, we can store it in behavioral dict
    if update.notes is not None:
        behavioral = device.behavioral.copy() if isinstance(device.behavioral, dict) else {}
        behavioral["notes"] = update.notes
        device.behavioral = behavioral

    await storage.upsert_device(device)

    # Notify WebSocket clients of device update
    await on_device_update(device)

    return device


@app.get("/api/search")
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    type: str = Query("all", regex="^(all|devices|flows|threats)$"),
    limit: int = LimitQuery(50, 200)
):
    """Search across devices, flows, and threats"""
    if not storage:
        raise HTTPException(status_code=503, detail=ERR_STORAGE_NOT_INIT)

    # Validate and sanitize query
    q = validate_string_param(q, "query", min_length=1, max_length=200)

    results = {
        "query": q,
        "type": type,
        "devices": [],
        "flows": [],
        "threats": []
    }

    if type in ["all", "devices"]:
        results["devices"] = await storage.search_devices(q, limit)

    if type in ["all", "flows"]:
        results["flows"] = await storage.search_flows(q, limit)

    if type in ["all", "threats"]:
        results["threats"] = await handle_endpoint_error(
            lambda: storage.search_threats(q, limit, active_only=False),
            "Failed to search threats"
        )

    return results


@app.get("/api/export/flows")
async def export_flows(
    format: str = Query("json", regex="^(json|csv)$"),
    start_time: Optional[int] = Query(None, ge=0),
    end_time: Optional[int] = Query(None, ge=0),
    device_id: Optional[str] = Query(None, min_length=1, max_length=100)
):
    """Export flows as JSON or CSV"""
    if not storage:
        raise HTTPException(status_code=503, detail=ERR_STORAGE_NOT_INIT)

    # Validate time range
    start_time, end_time = validate_time_range(start_time, end_time)

    flows = await storage.get_flows(
        limit=10000,
        start_time=start_time,
        end_time=end_time,
        device_id=device_id
    )

    if format.lower() == "csv":
        output = StringIO()  # type: ignore
        writer = csv.DictWriter(output, fieldnames=[
            "id", "timestamp", "source_ip", "source_port", "dest_ip", "dest_port",
            "protocol", "bytes_in", "bytes_out", "packets_in", "packets_out",
            "duration", "status", "country", "domain", "threat_level", "device_id"
        ])
        writer.writeheader()

        for flow in flows:
            writer.writerow({
                "id": flow.id,
                "timestamp": flow.timestamp,
                "source_ip": flow.sourceIp,
                "source_port": flow.sourcePort,
                "dest_ip": flow.destIp,
                "dest_port": flow.destPort,
                "protocol": flow.protocol,
                "bytes_in": flow.bytesIn,
                "bytes_out": flow.bytesOut,
                "packets_in": flow.packetsIn,
                "packets_out": flow.packetsOut,
                "duration": flow.duration,
                "status": flow.status,
                "country": flow.country or "",
                "domain": flow.domain or "",
                "threat_level": flow.threatLevel,
                "device_id": flow.deviceId
            })

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=flows_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )
    else:
        # JSON format
        return {
            "export_date": datetime.now().isoformat(),
            "count": len(flows),
            "flows": [flow.dict() for flow in flows]
        }


@app.post("/api/capture/start")
async def start_capture():
    """Start packet capture"""
    if not packet_capture:
        raise HTTPException(
            status_code=503, detail=ERR_CAPTURE_NOT_INIT
        )
    if packet_capture.is_running():
        return {"status": "already_running"}
    await packet_capture.start()
    return {"status": "started"}


@app.post("/api/capture/stop")
async def stop_capture():
    """Stop packet capture"""
    if not packet_capture:
        raise HTTPException(
            status_code=503, detail=ERR_CAPTURE_NOT_INIT
        )
    
    try:
        await packet_capture.stop()
        return {"status": "stopped"}
    except Exception as e:
        logger.error(f"Failed to stop capture: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to stop packet capture: {str(e)}"
        )


@app.get("/api/capture/status")
async def capture_status():
    """Get packet capture status"""
    if not packet_capture:
        return {"running": False, "error": "not_initialized"}
    return {
        "running": packet_capture.is_running(),
        "interface": packet_capture.interface,
        "packets_captured": packet_capture.packets_captured,
        "flows_detected": packet_capture.flows_detected
    }


@app.post("/api/maintenance/cleanup")
async def trigger_cleanup(
    days: Optional[int] = Query(None, ge=1, le=365)
):
    """Manually trigger data cleanup"""
    if not storage:
        raise HTTPException(
            status_code=503,
            detail="Storage service not initialized"
        )

    retention_days = days or config.data_retention_days
    if retention_days < 1 or retention_days > 365:
        raise HTTPException(
            status_code=400,
            detail="retention_days must be between 1 and 365"
        )
    
    result = await handle_endpoint_error(
        lambda: storage.cleanup_old_data(days=retention_days),
        "Failed to cleanup old data"
    )
    
    return {
        "status": "success",
        "retention_days": retention_days,
        **result
    }


@app.get("/api/maintenance/stats")
async def get_database_stats():
    """Get database statistics"""
    if not storage:
        raise HTTPException(
            status_code=503,
            detail="Storage service not initialized"
        )
    return await storage.get_database_stats()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    active_connections.append(websocket)
    logger.info(f"WebSocket client connected. Total connections: {len(active_connections)}")

    try:
        # Send initial state
        if storage:
            await websocket.send_json({
                "type": "initial_state",
                "devices": await storage.get_devices(),
                "flows": await storage.get_flows(limit=50),
                "threats": await storage.get_threats(active_only=True)
            })

        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            # Echo back for ping/pong
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
        logger.info(f"WebSocket client removed. Total connections: {len(active_connections)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=config.host,
        port=config.port,
        reload=config.debug
    )

