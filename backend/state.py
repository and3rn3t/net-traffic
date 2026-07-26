"""
Global application state shared across all routers.
Service references are None until initialized in main.py lifespan.
"""
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Dict, List, Optional, Set

import requests
from fastapi import WebSocket

from utils.config import config

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
    from services.alerting import AlertingService
    from services.baseline_learning import BaselineLearningService
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
alerting_service: Optional["AlertingService"] = None
baseline_learning_service: Optional["BaselineLearningService"] = None
service_manager: Optional["ServiceManager"] = None

# Active WebSocket connections
active_connections: List[WebSocket] = []

# Per-connection topic subscriptions. A value of None means "subscribed to
# all topics" (the default for clients that don't request filtering).
connection_topics: Dict[WebSocket, Optional[Set[str]]] = {}

# Fire-and-forget webhook delivery tasks, tracked so they can be drained on shutdown.
pending_webhook_tasks: Set[asyncio.Task] = set()


async def notify_clients(data: dict) -> None:
    """Notify all connected WebSocket clients concurrently, with retry logic.

    Sends are fanned out with asyncio.gather so N clients bound total latency
    to a single timeout window (~5s) instead of N * timeout when done
    sequentially - this matters because notify_clients() is called once per
    flow/threat during shutdown flow finalization, and a single slow/stale
    client could previously stall the whole broadcast loop for minutes.
    """
    if not active_connections:
        return

    topic = data.get("type")
    recipients = [
        c for c in active_connections
        if (topics := connection_topics.get(c)) is None or topic in topics
    ]
    if not recipients:
        return

    async def _send(connection: WebSocket) -> tuple[str, WebSocket] | None:
        try:
            await asyncio.wait_for(connection.send_json(data), timeout=5.0)
            return None
        except asyncio.TimeoutError:
            logger.warning("WebSocket send timeout - connection may be slow")
            return ("retry", connection)
        except (ConnectionError, RuntimeError) as e:
            logger.debug(f"Permanent WebSocket error: {e}")
            return ("disconnect", connection)
        except Exception as e:
            error_str = str(e).lower()
            if any(k in error_str for k in ["closed", "disconnect", "broken", "reset"]):
                logger.debug(f"WebSocket connection closed: {e}")
                return ("disconnect", connection)
            logger.warning(f"Unknown WebSocket error: {e}")
            return ("retry", connection)

    results = await asyncio.gather(*(_send(c) for c in recipients))

    disconnected = [conn for outcome in results if outcome and outcome[0] == "disconnect" for conn in [outcome[1]]]
    failed_connections = [conn for outcome in results if outcome and outcome[0] == "retry" for conn in [outcome[1]]]

    for conn in disconnected:
        if conn in active_connections:
            active_connections.remove(conn)
            connection_topics.pop(conn, None)
            logger.info(f"Removed disconnected WebSocket client. Remaining: {len(active_connections)}")

    if failed_connections:
        await asyncio.sleep(0.1)

        async def _retry(connection: WebSocket) -> WebSocket | None:
            try:
                await asyncio.wait_for(connection.send_json(data), timeout=2.0)
                return None
            except Exception as e:
                logger.warning(f"WebSocket retry failed: {e}")
                return connection

        retry_results = await asyncio.gather(*(_retry(c) for c in failed_connections))
        for connection in retry_results:
            if connection is not None and connection in active_connections:
                active_connections.remove(connection)
                connection_topics.pop(connection, None)
                logger.info(f"Removed WebSocket client after failed retry. Remaining: {len(active_connections)}")


async def close_all_connections() -> None:
    """Proactively close all WebSocket connections during shutdown.

    Must run before packet capture finalizes remaining active flows, since
    each finalized flow triggers a notify_clients() broadcast - closing
    connections up front makes those broadcasts instant no-ops instead of
    attempting to reach clients that are about to lose the connection anyway.
    """
    if not active_connections:
        return

    async def _close(connection: WebSocket) -> None:
        try:
            await asyncio.wait_for(connection.close(), timeout=1.0)
        except Exception:
            pass

    await asyncio.gather(*(_close(c) for c in active_connections), return_exceptions=True)
    count = len(active_connections)
    active_connections.clear()
    connection_topics.clear()
    logger.info(f"Closed {count} WebSocket connection(s) for shutdown")


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
    _dispatch_webhook(threat)


async def on_alert_triggered(alert) -> None:
    """Callback when a configurable alert rule triggers."""
    await notify_clients({"type": "alert_triggered", "alert": alert.dict()})


def _deliver_webhook_sync(threat) -> None:
    """Blocking webhook POST - always run via asyncio.to_thread."""
    payload = {
        "event": "threat_detected",
        "threat": threat.dict(),
    }
    try:
        response = requests.post(config.webhook_url, json=payload, timeout=5)
        response.raise_for_status()
    except requests.RequestException as e:
        logger.warning(f"Webhook delivery failed: {e}")


def _dispatch_webhook(threat) -> None:
    """Fire-and-forget webhook delivery for a threat, if configured.

    Runs as a tracked background task so it never blocks threat creation
    (which can happen during shutdown flow finalization) and so pending
    deliveries can be drained on shutdown instead of being silently dropped.
    """
    if not config.webhook_url:
        return

    task = asyncio.create_task(asyncio.to_thread(_deliver_webhook_sync, threat))
    pending_webhook_tasks.add(task)
    task.add_done_callback(pending_webhook_tasks.discard)


async def drain_webhook_tasks(timeout: float = 5.0) -> None:
    """Wait briefly for in-flight webhook deliveries to finish during shutdown."""
    if not pending_webhook_tasks:
        return
    try:
        await asyncio.wait_for(
            asyncio.gather(*pending_webhook_tasks, return_exceptions=True), timeout=timeout
        )
    except asyncio.TimeoutError:
        logger.warning(f"Timed out waiting for {len(pending_webhook_tasks)} webhook task(s) to finish")


async def on_flow_update(data: dict) -> None:
    """Callback when flow data is updated."""
    await notify_clients(data)
    if cache_service and cache_service.is_enabled():
        await cache_service.invalidate_flows()
