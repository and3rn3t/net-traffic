"""
Global application state shared across all routers.
Service references are None until initialized in main.py lifespan.
"""
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, List, Optional

from fastapi import WebSocket

if TYPE_CHECKING:
    from services.packet_capture import PacketCaptureService
    from services.device_fingerprinting import DeviceFingerprintingService
    from services.threat_detection import ThreatDetectionService
    from services.storage import StorageService
    from services.analytics import AnalyticsService
    from services.advanced_analytics import AdvancedAnalyticsService
    from services.geolocation import GeolocationService
    from services.network_quality_analytics import NetworkQualityAnalyticsService
    from services.application_analytics import ApplicationAnalyticsService
    from services.auth_service import AuthService
    from services.cache_service import CacheService
    from utils.service_manager import ServiceManager

logger = logging.getLogger(__name__)

# Service instances (set by main.py lifespan)
packet_capture: Optional["PacketCaptureService"] = None
device_service: Optional["DeviceFingerprintingService"] = None
threat_service: Optional["ThreatDetectionService"] = None
storage: Optional["StorageService"] = None
analytics: Optional["AnalyticsService"] = None
advanced_analytics: Optional["AdvancedAnalyticsService"] = None
geolocation_service: Optional["GeolocationService"] = None
network_quality_analytics: Optional["NetworkQualityAnalyticsService"] = None
application_analytics: Optional["ApplicationAnalyticsService"] = None
auth_service: Optional["AuthService"] = None
cache_service: Optional["CacheService"] = None
service_manager: Optional["ServiceManager"] = None

# Active WebSocket connections
active_connections: List[WebSocket] = []


async def notify_clients(data: dict) -> None:
    """Notify all connected WebSocket clients with retry logic."""
    if not active_connections:
        return

    disconnected = []
    failed_connections = []

    for connection in active_connections:
        try:
            await asyncio.wait_for(connection.send_json(data), timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning("WebSocket send timeout - connection may be slow")
            failed_connections.append(connection)
        except (ConnectionError, RuntimeError) as e:
            logger.debug(f"Permanent WebSocket error: {e}")
            disconnected.append(connection)
        except Exception as e:
            error_str = str(e).lower()
            if any(k in error_str for k in ["closed", "disconnect", "broken", "reset"]):
                logger.debug(f"WebSocket connection closed: {e}")
                disconnected.append(connection)
            else:
                logger.warning(f"Unknown WebSocket error: {e}")
                failed_connections.append(connection)

    for conn in disconnected:
        if conn in active_connections:
            active_connections.remove(conn)
            logger.info(f"Removed disconnected WebSocket client. Remaining: {len(active_connections)}")

    if failed_connections:
        await asyncio.sleep(0.1)
        for connection in failed_connections[:]:
            try:
                await asyncio.wait_for(connection.send_json(data), timeout=2.0)
                failed_connections.remove(connection)
            except Exception as e:
                logger.warning(f"WebSocket retry failed: {e}")
                if connection in active_connections:
                    active_connections.remove(connection)
                    logger.info(f"Removed WebSocket client after failed retry. Remaining: {len(active_connections)}")


async def on_device_update(device) -> None:
    """Callback when a device is created or updated."""
    await notify_clients({"type": "device_update", "device": device.dict()})
    if cache_service and cache_service.is_enabled():
        await cache_service.invalidate_devices()


async def on_threat_update(threat) -> None:
    """Callback when a threat is created."""
    await notify_clients({"type": "threat_update", "threat": threat.dict()})
    if cache_service and cache_service.is_enabled():
        await cache_service.invalidate_threats()


async def on_flow_update(data: dict) -> None:
    """Callback when flow data is updated."""
    await notify_clients(data)
    if cache_service and cache_service.is_enabled():
        await cache_service.invalidate_flows()
