"""
NetInsight Backend API
Raspberry Pi 5 compatible network traffic analysis service
"""
import asyncio
import os
import csv
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime
from io import StringIO
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from dotenv import load_dotenv

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

load_dotenv()

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle"""
    global packet_capture, device_service, threat_service, storage, analytics

    logger.info("Starting NetInsight Backend...")

    # Initialize storage
    storage = StorageService()
    await storage.initialize()

    # Initialize services
    device_service = DeviceFingerprintingService(storage)
    threat_service = ThreatDetectionService(storage)
    analytics = AnalyticsService(storage)
    global advanced_analytics
    advanced_analytics = AdvancedAnalyticsService(storage)

    # Initialize packet capture
    interface = os.getenv("NETWORK_INTERFACE", "eth0")
    packet_capture = PacketCaptureService(
        interface=interface,
        device_service=device_service,
        threat_service=threat_service,
        storage=storage,
        on_flow_update=notify_clients
    )

    # Start packet capture in background
    capture_task = asyncio.create_task(packet_capture.start())

    logger.info(f"Packet capture started on interface: {interface}")

    yield

    # Cleanup
    logger.info("Shutting down NetInsight Backend...")
    if packet_capture:
        await packet_capture.stop()
    capture_task.cancel()
    try:
        await capture_task
    except asyncio.CancelledError:
        pass
    await storage.close()


app = FastAPI(
    title="NetInsight API",
    description="Network traffic analysis backend for Raspberry Pi 5",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def notify_clients(data: dict):
    """Notify all connected WebSocket clients of updates"""
    if not active_connections:
        return

    disconnected = []
    for connection in active_connections:
        try:
            await connection.send_json(data)
        except Exception as e:
            logger.warning(f"Failed to send to client: {e}")
            disconnected.append(connection)

    # Remove disconnected clients
    for conn in disconnected:
        if conn in active_connections:
            active_connections.remove(conn)


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
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "capture_running": packet_capture.is_running() if packet_capture else False,
        "active_flows": await storage.count_flows() if storage else 0,
        "active_devices": await storage.count_devices() if storage else 0
    }


@app.get("/api/devices", response_model=List[Device])
async def get_devices():
    """Get all discovered devices"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not initialized")
    return await storage.get_devices()


@app.get("/api/devices/{device_id}", response_model=Device)
async def get_device(device_id: str):
    """Get specific device details"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not initialized")
    device = await storage.get_device(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@app.get("/api/flows", response_model=List[NetworkFlow])
async def get_flows(
    limit: int = 100,
    offset: int = 0,
    device_id: Optional[str] = None,
    status: Optional[str] = None,
    protocol: Optional[str] = None,
    start_time: Optional[int] = None,
    end_time: Optional[int] = None,
    source_ip: Optional[str] = None,
    dest_ip: Optional[str] = None,
    threat_level: Optional[str] = None,
    min_bytes: Optional[int] = None
):
    """Get network flows with advanced filtering options"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not initialized")
    return await storage.get_flows(
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
    )


@app.get("/api/flows/{flow_id}", response_model=NetworkFlow)
async def get_flow(flow_id: str):
    """Get specific flow details"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not initialized")
    flow = await storage.get_flow(flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow


@app.get("/api/threats", response_model=List[Threat])
async def get_threats(active_only: bool = True):
    """Get threat alerts"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not initialized")
    return await storage.get_threats(active_only=active_only)


@app.post("/api/threats/{threat_id}/dismiss")
async def dismiss_threat(threat_id: str):
    """Dismiss a threat alert"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not initialized")
    success = await storage.dismiss_threat(threat_id)
    if not success:
        raise HTTPException(status_code=404, detail="Threat not found")
    return {"status": "dismissed", "threat_id": threat_id}


@app.get("/api/analytics", response_model=List[AnalyticsData])
async def get_analytics(hours: int = 24):
    """Get analytics data for specified time range"""
    if not analytics:
        raise HTTPException(status_code=503, detail="Analytics service not initialized")
    return await analytics.get_analytics_data(hours_back=hours)


@app.get("/api/protocols", response_model=List[ProtocolStats])
async def get_protocol_stats():
    """Get protocol breakdown statistics"""
    if not analytics:
        raise HTTPException(status_code=503, detail="Analytics service not initialized")
    return await analytics.get_protocol_stats()


@app.get("/api/stats/summary")
async def get_summary_stats():
    """Get overall summary statistics"""
    if not advanced_analytics:
        raise HTTPException(status_code=503, detail="Advanced analytics service not initialized")
    return await advanced_analytics.get_summary_stats()


@app.get("/api/stats/geographic")
async def get_geographic_stats(hours: int = 24):
    """Get geographic distribution of connections"""
    if not advanced_analytics:
        raise HTTPException(status_code=503, detail="Advanced analytics service not initialized")
    return await advanced_analytics.get_geographic_distribution(hours_back=hours)


@app.get("/api/stats/top/domains")
async def get_top_domains(limit: int = 20, hours: int = 24):
    """Get top domains by traffic"""
    if not advanced_analytics:
        raise HTTPException(status_code=503, detail="Advanced analytics service not initialized")
    return await advanced_analytics.get_top_domains(limit=limit, hours_back=hours)


@app.get("/api/stats/top/devices")
async def get_top_devices(limit: int = 10, hours: int = 24, sort_by: str = "bytes"):
    """Get top devices by traffic"""
    if not advanced_analytics:
        raise HTTPException(status_code=503, detail="Advanced analytics service not initialized")
    return await advanced_analytics.get_top_devices(limit=limit, hours_back=hours, sort_by=sort_by)


@app.get("/api/stats/bandwidth")
async def get_bandwidth_timeline(hours: int = 24, interval_minutes: int = 5):
    """Get bandwidth usage timeline"""
    if not advanced_analytics:
        raise HTTPException(status_code=503, detail="Advanced analytics service not initialized")
    return await advanced_analytics.get_bandwidth_timeline(hours_back=hours, interval_minutes=interval_minutes)


@app.get("/api/devices/{device_id}/analytics")
async def get_device_analytics(device_id: str, hours: int = 24):
    """Get detailed analytics for a specific device"""
    if not advanced_analytics:
        raise HTTPException(status_code=503, detail="Advanced analytics service not initialized")
    result = await advanced_analytics.get_device_analytics(device_id, hours_back=hours)
    if not result:
        raise HTTPException(status_code=404, detail="Device not found")
    return result


@app.patch("/api/devices/{device_id}")
async def update_device(device_id: str, update: DeviceUpdateRequest):
    """Update device information (name, notes, type)"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not initialized")

    device = await storage.get_device(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

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
    return device


@app.get("/api/search")
async def search(
    q: str,
    type: str = "all",
    limit: int = 50
):
    """Search across devices, flows, and threats"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not initialized")

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
        threats = await storage.get_threats(active_only=False)
        results["threats"] = [
            t for t in threats
            if q.lower() in t.description.lower() or q.lower() in t.type.lower()
        ][:limit]

    return results


@app.get("/api/export/flows")
async def export_flows(
    format: str = "json",
    start_time: Optional[int] = None,
    end_time: Optional[int] = None,
    device_id: Optional[str] = None
):
    """Export flows as JSON or CSV"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not initialized")

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
        raise HTTPException(status_code=503, detail="Packet capture not initialized")
    if packet_capture.is_running():
        return {"status": "already_running"}
    await packet_capture.start()
    return {"status": "started"}


@app.post("/api/capture/stop")
async def stop_capture():
    """Stop packet capture"""
    if not packet_capture:
        raise HTTPException(status_code=503, detail="Packet capture not initialized")
    await packet_capture.stop()
    return {"status": "stopped"}


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

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=os.getenv("DEBUG", "false").lower() == "true"
    )

