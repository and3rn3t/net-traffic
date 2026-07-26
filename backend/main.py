"""
NetInsight Backend API
Raspberry Pi 5 compatible network traffic analysis service
"""
import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import state
from models.types import Threat
from utils.config import config
from utils.constants import CLEANUP_INTERVAL_HOURS, SECONDS_PER_HOUR
from utils.logging_config import StructuredLogger, setup_logging
from utils.rate_limit import RateLimitMiddleware
from utils.request_logging import RequestLoggingMiddleware
from services.cache_service import CacheService
from services.auth_service import AuthService
from utils.service_manager import ServiceManager

# Configure structured logging
setup_logging(
    level=config.log_level if hasattr(config, "log_level") else "INFO",
    use_json=config.use_json_logging if hasattr(config, "use_json_logging") else True,
    log_file=config.log_file if hasattr(config, "log_file") else None,
)
logger = StructuredLogger(__name__)

BANDWIDTH_CHECK_INTERVAL_HOURS = 1


async def _periodic_cleanup(interval_hours: int) -> None:
    """Periodic cleanup task for old data."""
    while True:
        try:
            await asyncio.sleep(interval_hours * SECONDS_PER_HOUR)
            retention_days = config.data_retention_days
            logger.info(f"Running periodic cleanup (retention: {retention_days} days)")
            await state.storage.cleanup_old_data(days=retention_days)
        except asyncio.CancelledError:
            logger.info("Periodic cleanup task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in periodic cleanup: {e}")


async def _periodic_bandwidth_check(interval_hours: int) -> None:
    """Periodically check rolling 24h bandwidth against a configured threshold.

    Alerts at most once per calendar day (UTC) to avoid repeatedly notifying
    while usage stays above the threshold.
    """
    last_alert_date: str | None = None
    while True:
        try:
            await asyncio.sleep(interval_hours * SECONDS_PER_HOUR)
            threshold_mb = config.bandwidth_alert_threshold_mb
            if not threshold_mb or not state.storage:
                continue

            since_ms = int((datetime.now(timezone.utc) - timedelta(hours=24)).timestamp() * 1000)
            total_bytes = await state.storage.get_total_bytes_since(since_ms)
            total_mb = total_bytes / (1024 * 1024)

            if total_mb < threshold_mb:
                continue

            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            if today == last_alert_date:
                continue
            last_alert_date = today

            threat = Threat(
                id=str(uuid.uuid4()),
                timestamp=int(datetime.now(timezone.utc).timestamp() * 1000),
                type="bandwidth_quota",
                severity="medium",
                deviceId="network",
                flowId="n/a",
                description=(
                    f"Network-wide bandwidth over the last 24h ({total_mb:.1f} MB) "
                    f"exceeded the configured threshold ({threshold_mb:.1f} MB)"
                ),
                recommendation="Review top talkers and consider investigating unexpected usage spikes.",
                dismissed=False,
            )
            await state.storage.add_threat(threat)
            await state.on_threat_update(threat)
            logger.warning(f"Bandwidth alert triggered: {total_mb:.1f} MB / {threshold_mb:.1f} MB threshold")
        except asyncio.CancelledError:
            logger.info("Bandwidth check task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in periodic bandwidth check: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    from services.storage import StorageService
    from utils.auth_dependencies import set_auth_service

    logger.info("Starting NetInsight Backend...")

    # Storage
    state.storage = StorageService(db_path=config.db_path)
    await state.storage.initialize()

    # Cache (Redis - optional, degrades gracefully)
    state.cache_service = CacheService(host=config.redis_host, port=config.redis_port, default_ttl=300)
    await state.cache_service.initialize()
    logger.info("Cache service initialized", redis_host=config.redis_host, redis_port=config.redis_port)

    # Auth
    state.auth_service = AuthService(db_path=config.db_path)
    await state.auth_service.initialize()
    set_auth_service(state.auth_service)

    # All other services via ServiceManager
    state.service_manager = ServiceManager(state.storage)
    state.service_manager.initialize_services(
        on_device_update=state.on_device_update,
        on_threat_update=state.on_threat_update,
        on_flow_update=state.on_flow_update,
        on_alert_triggered=state.on_alert_triggered,
        network_interface=config.network_interface,
        capture_mode=config.capture_mode,
        remote_capture_host=config.remote_capture_host,
        remote_capture_user=config.remote_capture_user,
        remote_capture_interface=config.remote_capture_interface,
        remote_capture_ssh_key=config.remote_capture_ssh_key,
    )
    state.device_service = state.service_manager.device_service
    state.threat_service = state.service_manager.threat_service
    state.analytics = state.service_manager.analytics
    state.advanced_analytics = state.service_manager.advanced_analytics
    state.geolocation_service = state.service_manager.geolocation_service
    state.network_quality_analytics = state.service_manager.network_quality_analytics
    state.application_analytics = state.service_manager.application_analytics
    state.packet_capture = state.service_manager.packet_capture
    state.alerting_service = state.service_manager.alerting_service
    await state.alerting_service.refresh_cache()

    # Start packet capture
    capture_source = (
        f"{config.remote_capture_user}@{config.remote_capture_host}:"
        f"{config.remote_capture_interface} (remote_ssh)"
        if config.capture_mode == "remote_ssh"
        else config.network_interface
    )
    try:
        capture_task = asyncio.create_task(state.packet_capture.start())
        await asyncio.sleep(0.5)
        if state.packet_capture.is_running():
            logger.info(f"Packet capture started on: {capture_source}")
        else:
            logger.warning(
                f"Packet capture not running - check Scapy and capture source: {capture_source}"
            )
    except Exception as e:
        logger.error(f"Failed to start packet capture: {e}. Backend continues without capture.")
        capture_task = asyncio.create_task(asyncio.sleep(0))

    cleanup_task = asyncio.create_task(_periodic_cleanup(CLEANUP_INTERVAL_HOURS))
    bandwidth_task = asyncio.create_task(_periodic_bandwidth_check(BANDWIDTH_CHECK_INTERVAL_HOURS))

    yield

    # Shutdown
    logger.info("Shutting down NetInsight Backend...")

    # Close WebSocket connections first so flow finalization below (triggered
    # via service_manager.cleanup() -> packet_capture.stop()) doesn't try to
    # broadcast to clients that are about to be disconnected anyway. Without
    # this, a slow/stale client could stall shutdown by many minutes since
    # notify_clients() is called once per finalized flow.
    await state.close_all_connections()

    capture_task.cancel()
    cleanup_task.cancel()
    bandwidth_task.cancel()
    for task in (capture_task, cleanup_task, bandwidth_task):
        try:
            await task
        except asyncio.CancelledError:
            pass

    if state.service_manager:
        await state.service_manager.cleanup()
    if state.auth_service:
        await state.auth_service.close()
    if state.cache_service:
        await state.cache_service.close()
    await state.drain_webhook_tasks()
    logger.info("NetInsight Backend stopped")


app = FastAPI(
    title="NetInsight API",
    description="Network traffic analysis backend for Raspberry Pi 5",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware (order matters: logging -> rate limit -> CORS)
app.add_middleware(RequestLoggingMiddleware, log_excluded_paths=False)
app.add_middleware(RateLimitMiddleware, requests_per_minute=config.rate_limit_per_minute)
# Auth uses a Bearer token in the Authorization header, not cookies, so the
# frontend never needs `credentials: 'include'`. Wildcard origin + credentials
# is also an invalid/dangerous combination per the CORS spec (it would let
# any site make credentialed requests). Credentials are disabled entirely
# since nothing in this API relies on cookie-based auth.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "NetInsight Backend",
        "version": "1.0.0",
        "status": "running",
        "packet_capture": (
            "active" if state.packet_capture and state.packet_capture.is_running() else "inactive"
        ),
    }


# Register routers
from routers import (
    alerts, analytics, auth, cache, capture, devices, filter_presets, flows, health, maintenance, threats, websocket,
)  # noqa: E402

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(cache.router)
app.include_router(devices.router)
app.include_router(flows.router)
app.include_router(threats.router)
app.include_router(analytics.router)
app.include_router(capture.router)
app.include_router(maintenance.router)
app.include_router(websocket.router)
app.include_router(filter_presets.router)
app.include_router(alerts.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=config.host, port=config.port, reload=config.debug)
