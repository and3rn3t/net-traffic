"""
NetInsight Backend API
Raspberry Pi 5 compatible network traffic analysis service
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import state
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
        network_interface=config.network_interface,
    )
    state.device_service = state.service_manager.device_service
    state.threat_service = state.service_manager.threat_service
    state.analytics = state.service_manager.analytics
    state.advanced_analytics = state.service_manager.advanced_analytics
    state.geolocation_service = state.service_manager.geolocation_service
    state.network_quality_analytics = state.service_manager.network_quality_analytics
    state.application_analytics = state.service_manager.application_analytics
    state.packet_capture = state.service_manager.packet_capture

    # Start packet capture
    try:
        capture_task = asyncio.create_task(state.packet_capture.start())
        await asyncio.sleep(0.5)
        if state.packet_capture.is_running():
            logger.info(f"Packet capture started on interface: {config.network_interface}")
        else:
            logger.warning(
                f"Packet capture not running - check Scapy and interface: {config.network_interface}"
            )
    except Exception as e:
        logger.error(f"Failed to start packet capture: {e}. Backend continues without capture.")
        capture_task = asyncio.create_task(asyncio.sleep(0))

    cleanup_task = asyncio.create_task(_periodic_cleanup(CLEANUP_INTERVAL_HOURS))

    yield

    # Shutdown
    logger.info("Shutting down NetInsight Backend...")
    capture_task.cancel()
    cleanup_task.cancel()
    for task in (capture_task, cleanup_task):
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.allowed_origins,
    allow_credentials=True,
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
from routers import analytics, auth, cache, capture, devices, flows, health, maintenance, threats, websocket  # noqa: E402

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=config.host, port=config.port, reload=config.debug)
