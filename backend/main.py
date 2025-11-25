"""
NetInsight Backend API
Raspberry Pi 5 compatible network traffic analysis service
"""
import asyncio
import os
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from services.packet_capture import PacketCaptureService
from services.device_fingerprinting import DeviceFingerprintingService
from services.threat_detection import ThreatDetectionService
from services.storage import StorageService
from services.analytics import AnalyticsService
from models.types import NetworkFlow, Device, Threat, AnalyticsData, ProtocolStats

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
    device_id: Optional[str] = None,
    status: Optional[str] = None
):
    """Get network flows with optional filters"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not initialized")
    return await storage.get_flows(limit=limit, device_id=device_id, status=status)


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

