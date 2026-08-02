"""
NetInsight Backend API
Raspberry Pi 5 compatible network traffic analysis service
"""
import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

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
BASELINE_LEARNING_INTERVAL_HOURS = 1


async def _periodic_health_heartbeat(interval_minutes: int) -> None:
    """Periodic structured summary of DB/dataflow health for log-only troubleshooting.

    Runs shortly after startup (so it's useful even on frequently-restarted
    hosts) and then on the configured interval. Also opportunistically
    checkpoints the WAL and warns on threshold breaches (WAL size, stale
    capture, growing packet-drop counters) so incidents are visible via
    `journalctl` alone, without needing to query the API mid-incident.
    """
    delay = 60  # first heartbeat 1 min after startup
    interval_seconds = interval_minutes * 60
    last_packets_captured = 0
    last_dropped = 0
    last_dropped_backpressure = 0
    while True:
        try:
            await asyncio.sleep(delay)
            delay = interval_seconds

            db_stats = await state.storage.get_database_stats() if state.storage else {}
            pool_stats = state.storage.get_pool_stats() if state.storage else {}
            cache_stats = await state.cache_service.get_stats() if state.cache_service else {}

            capture = state.packet_capture
            packets_captured = capture.packets_captured if capture else 0
            dropped = getattr(capture, "_packets_dropped", 0) if capture else 0
            dropped_backpressure = getattr(capture, "_packets_dropped_backpressure", 0) if capture else 0
            capture_stale = capture.is_stale() if capture else None

            logger.info(
                "Health heartbeat",
                packets_captured_total=packets_captured,
                packets_captured_delta=packets_captured - last_packets_captured,
                packets_dropped_delta=dropped - last_dropped,
                packets_dropped_backpressure_delta=dropped_backpressure - last_dropped_backpressure,
                active_flows=len(getattr(capture, "_active_flows", {})) if capture else 0,
                capture_stale=capture_stale,
                db_size_bytes=db_stats.get("database_size_bytes", 0),
                wal_size_bytes=db_stats.get("wal_size_bytes", 0),
                total_flows=db_stats.get("total_flows", 0),
                total_threats=db_stats.get("total_threats", 0),
                cache_backend=cache_stats.get("backend", "disabled"),
                cache_hit_rate=cache_stats.get("hit_rate"),
                slow_query_count=pool_stats.get("query_stats", {}).get("slow_query_count", 0),
                ws_connections=len(state.active_connections),
                http_5xx_total=state.request_5xx_count,
            )

            if capture_stale:
                logger.warning("Health heartbeat: packet capture is stale (not receiving packets)")
            if dropped_backpressure > last_dropped_backpressure:
                logger.warning(
                    f"Health heartbeat: packet backpressure drops increased by "
                    f"{dropped_backpressure - last_dropped_backpressure} since last heartbeat"
                )

            wal_bytes = db_stats.get("wal_size_bytes", 0)
            if wal_bytes > config.wal_warn_bytes and state.storage:
                logger.warning(f"WAL size {wal_bytes} bytes exceeds threshold, running proactive checkpoint")
                result = await state.storage.checkpoint_wal_if_needed(config.wal_warn_bytes)
                if result:
                    logger.info(
                        "Proactive WAL checkpoint",
                        before_bytes=result["before_bytes"],
                        after_bytes=result["after_bytes"],
                    )

            last_packets_captured = packets_captured
            last_dropped = dropped
            last_dropped_backpressure = dropped_backpressure
        except asyncio.CancelledError:
            logger.info("Health heartbeat task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in health heartbeat: {e}")


async def _periodic_cleanup(interval_hours: int) -> None:
    """Periodic cleanup task for old data.

    Runs shortly after startup (so it still fires on frequently-restarted
    hosts, where a 24h-first-sleep would mean it never runs) and then on the
    configured interval.
    """
    delay = 300  # first cleanup 5 min after startup
    interval_seconds = interval_hours * SECONDS_PER_HOUR
    while True:
        try:
            await asyncio.sleep(delay)
            delay = interval_seconds
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


async def _periodic_baseline_learning(interval_hours: int) -> None:
    """Periodically learn per-device behavioral baselines and flag predictive anomalies."""
    while True:
        try:
            await asyncio.sleep(interval_hours * SECONDS_PER_HOUR)
            if not state.baseline_learning_service:
                continue
            await state.baseline_learning_service.run_cycle(window_hours=interval_hours)
        except asyncio.CancelledError:
            logger.info("Baseline learning task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in periodic baseline learning: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    from services.storage import StorageService
    from utils.auth_dependencies import set_auth_service

    logger.info("Starting NetInsight Backend...")
    # Log the effective config once at startup - the fastest way to rule out
    # .env drift (e.g. a stale deployed value) when troubleshooting. No secrets
    # (webhook URL, SSH key path) are included.
    logger.info(
        "Effective configuration",
        capture_mode=config.capture_mode,
        network_interface=config.network_interface if config.capture_mode == "local" else None,
        remote_capture_host=config.remote_capture_host if config.capture_mode == "remote_ssh" else None,
        db_path=config.db_path,
        data_retention_days=config.data_retention_days,
        redis_host=config.redis_host,
        redis_port=config.redis_port,
        rate_limit_per_minute=config.rate_limit_per_minute,
        allowed_origins_count=len(config.allowed_origins),
        slow_query_ms=config.slow_query_ms,
        slow_request_ms=config.slow_request_ms,
        wal_warn_bytes=config.wal_warn_bytes,
        heartbeat_interval_minutes=config.heartbeat_interval_minutes,
        debug=config.debug,
    )

    # Storage + cache are independent (no shared connection) - initialize concurrently
    state.storage = StorageService(db_path=config.db_path)
    state.cache_service = CacheService(host=config.redis_host, port=config.redis_port, default_ttl=300)
    await asyncio.gather(state.storage.initialize(), state.cache_service.initialize())
    logger.info("Cache service initialized", redis_host=config.redis_host, redis_port=config.redis_port)

    # Auth connects to the same db file with its own connection - run after
    # storage.initialize() so WAL mode is already set (avoids "database is
    # locked" from a second connection racing table creation under the
    # default rollback journal mode).
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
    # Recompute vendor/type for existing devices using the current OUI database -
    # cheap and idempotent, so it also picks up a newly-downloaded OUI file on
    # every restart without a separate one-off migration step.
    await state.device_service.backfill_vendor_and_type()
    state.threat_service = state.service_manager.threat_service
    state.analytics = state.service_manager.analytics
    state.advanced_analytics = state.service_manager.advanced_analytics
    state.geolocation_service = state.service_manager.geolocation_service
    state.network_quality_analytics = state.service_manager.network_quality_analytics
    state.application_analytics = state.service_manager.application_analytics
    state.packet_capture = state.service_manager.packet_capture
    state.alerting_service = state.service_manager.alerting_service
    await state.alerting_service.refresh_cache()
    state.baseline_learning_service = state.service_manager.baseline_learning_service
    await state.baseline_learning_service.load_baselines()

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
    baseline_task = asyncio.create_task(_periodic_baseline_learning(BASELINE_LEARNING_INTERVAL_HOURS))
    heartbeat_task = asyncio.create_task(_periodic_health_heartbeat(config.heartbeat_interval_minutes))

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
    baseline_task.cancel()
    heartbeat_task.cancel()
    for task in (capture_task, cleanup_task, bandwidth_task, baseline_task, heartbeat_task):
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

# Middleware (order matters: logging -> rate limit -> CORS -> gzip)
app.add_middleware(RequestLoggingMiddleware, log_excluded_paths=False)
app.add_middleware(RateLimitMiddleware, requests_per_minute=config.rate_limit_per_minute)
# Compresses JSON responses over the cloudflared tunnel; skips small payloads.
app.add_middleware(GZipMiddleware, minimum_size=1024)
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
    # Without this, browsers can't read X-Request-ID on cross-origin responses
    # (prod frontend and backend are on different domains).
    expose_headers=["X-Request-ID"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Ensure any unhandled error is logged with a traceback + request_id for correlation."""
    request_id = getattr(request.state, "request_id", None)
    logging.getLogger(__name__).error(
        f"Unhandled exception: {request.method} {request.url.path}",
        exc_info=exc,
        extra={"request_id": request_id},
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": request_id},
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
