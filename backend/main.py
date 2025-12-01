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
from utils.request_logging import RequestLoggingMiddleware

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
from models.types import (
    NetworkFlow, Device, Threat, AnalyticsData, ProtocolStats
)
from models.auth import (
    User, UserCreate, UserUpdate, LoginRequest, Token,
    APIKeyCreate, APIKey, PasswordChange, UserRole
)
from models.requests import DeviceUpdateRequest
from utils.config import config
from utils.validators import (
    LimitQuery, OffsetQuery, HoursQuery, IPQuery, StatusQuery,
    ThreatLevelQuery, DeviceIdPath, FlowIdPath, ThreatIdPath,
    validate_time_range, validate_min_bytes, validate_string_param
)
from utils.error_handler import handle_endpoint_error
from utils.constants import SECONDS_PER_HOUR, CLEANUP_INTERVAL_HOURS
from utils.service_manager import ServiceManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global services (maintained for backward compatibility with endpoints)
packet_capture: Optional[PacketCaptureService] = None
device_service: Optional[DeviceFingerprintingService] = None
threat_service: Optional[ThreatDetectionService] = None
storage: Optional[StorageService] = None
analytics: Optional[AnalyticsService] = None
advanced_analytics: Optional[AdvancedAnalyticsService] = None
geolocation_service: Optional[GeolocationService] = None
network_quality_analytics: Optional[NetworkQualityAnalyticsService] = None
application_analytics: Optional[ApplicationAnalyticsService] = None
auth_service: Optional[AuthService] = None

# Service manager for centralized lifecycle management
service_manager: Optional[ServiceManager] = None

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


# Import error messages from constants
from utils.constants import ErrorMessages

# Backward compatibility aliases
ERR_STORAGE_NOT_INIT = ErrorMessages.STORAGE_NOT_INIT
ERR_DEVICE_NOT_FOUND = ErrorMessages.DEVICE_NOT_FOUND
ERR_FLOW_NOT_FOUND = ErrorMessages.FLOW_NOT_FOUND
ERR_THREAT_NOT_FOUND = ErrorMessages.THREAT_NOT_FOUND
ERR_ANALYTICS_NOT_INIT = ErrorMessages.ANALYTICS_NOT_INIT
ERR_ADV_ANALYTICS_NOT_INIT = ErrorMessages.ADV_ANALYTICS_NOT_INIT
ERR_CAPTURE_NOT_INIT = ErrorMessages.CAPTURE_NOT_INIT


async def _periodic_cleanup(storage: StorageService, interval_hours: int):
    """Periodic cleanup task for old data"""
    while True:
        try:
            await asyncio.sleep(interval_hours * SECONDS_PER_HOUR)
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
    global packet_capture
    global device_service
    global threat_service
    global storage
    global analytics
    global advanced_analytics
    global geolocation_service
    global network_quality_analytics
    global application_analytics
    global auth_service
    global service_manager

    logger.info("Starting NetInsight Backend...")

    # Initialize storage
    storage = StorageService(db_path=config.db_path)
    await storage.initialize()

    # Initialize authentication service
    auth_service = AuthService(db_path=config.db_path)
    await auth_service.initialize()

    # Set auth service for dependencies
    from utils.auth_dependencies import set_auth_service
    set_auth_service(auth_service)

    # Initialize services using ServiceManager
    service_manager = ServiceManager(storage)
    service_manager.initialize_services(
        on_device_update=on_device_update,
        on_threat_update=on_threat_update,
        on_flow_update=notify_clients,
        network_interface=config.network_interface,
    )

    # Assign to global variables for backward compatibility with endpoints
    device_service = service_manager.device_service
    threat_service = service_manager.threat_service
    analytics = service_manager.analytics
    advanced_analytics = service_manager.advanced_analytics
    geolocation_service = service_manager.geolocation_service
    network_quality_analytics = service_manager.network_quality_analytics
    application_analytics = service_manager.application_analytics
    packet_capture = service_manager.packet_capture

    # Start packet capture in background
    capture_task = asyncio.create_task(packet_capture.start())

    # Start periodic cleanup task
    cleanup_task = asyncio.create_task(
        _periodic_cleanup(storage, CLEANUP_INTERVAL_HOURS)
    )

    logger.info(
        f"Packet capture started on interface: {config.network_interface}"
    )

    yield

    # Cleanup
    logger.info("Shutting down NetInsight Backend...")

    # Cancel background tasks
    capture_task.cancel()
    cleanup_task.cancel()

    try:
        await capture_task
    except asyncio.CancelledError:
        pass

    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

    # Cleanup services using ServiceManager
    if service_manager:
        await service_manager.cleanup()

    # Cleanup auth service
    if auth_service:
        await auth_service.close()

    logger.info("NetInsight Backend stopped")


app = FastAPI(
    title="NetInsight API",
    description="Network traffic analysis backend for Raspberry Pi 5",
    version="1.0.0",
    lifespan=lifespan
)

# Request logging (first, to capture all requests)
app.add_middleware(
    RequestLoggingMiddleware,
    log_excluded_paths=False  # Set to True to log health checks at DEBUG level
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
        # Copy list to avoid modification during iteration
        for connection in failed_connections[:]:
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
        "packet_capture": (
            "active" if packet_capture and packet_capture.is_running()
            else "inactive"
        )
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
            "performance_stats": (
                packet_capture.get_performance_stats()
                if packet_capture
                else {}
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


@app.get("/api/health/storage")
@handle_endpoint_error
async def health_storage():
    """Health check for storage service"""
    if not storage:
        raise HTTPException(
            status_code=503,
            detail=ErrorMessages.STORAGE_NOT_INIT
        )
    
    try:
        stats = await storage.get_database_stats()
        return {
            "status": "healthy",
            "service": "storage",
            "timestamp": datetime.now().isoformat(),
            "database": {
                "connected": True,
                "path": storage.db_path,
                "stats": stats,
            },
        }
    except Exception as e:
        logger.error(f"Storage health check failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Storage service unhealthy: {str(e)}"
        )


@app.get("/api/health/capture")
@handle_endpoint_error
async def health_capture():
    """Health check for packet capture service"""
    if not packet_capture:
        raise HTTPException(
            status_code=503,
            detail=ErrorMessages.CAPTURE_NOT_INIT
        )
    
    return {
        "status": "healthy" if packet_capture.is_running() else "inactive",
        "service": "packet_capture",
        "timestamp": datetime.now().isoformat(),
        "capture": {
            "running": packet_capture.is_running(),
            "interface": packet_capture.interface,
            "packets_captured": packet_capture.packets_captured,
        },
    }


@app.get("/api/health/analytics")
@handle_endpoint_error
async def health_analytics():
    """Health check for analytics services"""
    services_status = {
        "analytics": analytics is not None,
        "advanced_analytics": advanced_analytics is not None,
        "network_quality_analytics": network_quality_analytics is not None,
        "application_analytics": application_analytics is not None,
    }
    
    all_healthy = all(services_status.values())
    
    return {
        "status": "healthy" if all_healthy else "degraded",
        "service": "analytics",
        "timestamp": datetime.now().isoformat(),
        "services": services_status,
    }


@app.get("/api/health/device")
@handle_endpoint_error
async def health_device():
    """Health check for device fingerprinting service"""
    if not device_service:
        raise HTTPException(
            status_code=503,
            detail="Device service not initialized"
        )
    
    return {
        "status": "healthy",
        "service": "device_fingerprinting",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/health/threat")
@handle_endpoint_error
async def health_threat():
    """Health check for threat detection service"""
    if not threat_service:
        raise HTTPException(
            status_code=503,
            detail="Threat detection service not initialized"
        )
    
    return {
        "status": "healthy",
        "service": "threat_detection",
        "timestamp": datetime.now().isoformat(),
    }


# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

from utils.auth_dependencies import (
    get_current_user, get_current_active_user,
    require_admin, require_operator_or_admin, get_current_user_optional
)
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends, status


@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login with username and password to get JWT token
    """
    if not auth_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available"
        )

    user = await auth_service.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    from datetime import timedelta
    access_token_expires = timedelta(minutes=30)
    token = auth_service.create_access_token(
        data={"sub": user.username, "role": user.role.value},
        expires_delta=access_token_expires
    )

    return token


@app.post("/api/auth/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register(
    user_create: UserCreate,
    current_user: User = Depends(require_admin)
):
    """
    Register a new user (admin only)
    """
    if not auth_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available"
        )

    # Check if username already exists
    existing_user = await auth_service.get_user(user_create.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    user = await auth_service.create_user(user_create)
    return user


@app.get("/api/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """
    Get current authenticated user information
    """
    return current_user


@app.get("/api/auth/users", response_model=List[User])
async def list_users(current_user: User = Depends(require_admin)):
    """
    List all users (admin only)
    """
    if not auth_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available"
        )

    users = await auth_service.list_users()
    return users


@app.patch("/api/auth/users/{username}", response_model=User)
async def update_user(
    username: str,
    user_update: UserUpdate,
    current_user: User = Depends(require_admin)
):
    """
    Update user information (admin only)
    """
    if not auth_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available"
        )

    updated_user = await auth_service.update_user(username, user_update)
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return updated_user


@app.delete("/api/auth/users/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    username: str,
    current_user: User = Depends(require_admin)
):
    """
    Delete a user (admin only)
    Cannot delete yourself
    """
    if not auth_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available"
        )

    if username == current_user.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    success = await auth_service.delete_user(username)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return None


@app.post("/api/auth/change-password")
async def change_password(
    password_change: PasswordChange,
    current_user: User = Depends(get_current_active_user)
):
    """
    Change current user's password
    """
    if not auth_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available"
        )

    # Verify old password
    user_in_db = await auth_service.get_user(current_user.username)
    if not user_in_db or not auth_service.verify_password(password_change.old_password, user_in_db.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password"
        )

    # Update password
    await auth_service.update_user(
        current_user.username,
        UserUpdate(password=password_change.new_password)
    )

    return {"message": "Password updated successfully"}


@app.post("/api/auth/api-keys", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    api_key_create: APIKeyCreate,
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new API key for current user
    Returns the API key once - store it securely!
    """
    if not auth_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available"
        )

    api_key_obj, raw_key = await auth_service.create_api_key(current_user.id, api_key_create)

    return {
        "id": api_key_obj.id,
        "name": api_key_obj.name,
        "api_key": raw_key,  # Only shown once!
        "created_at": api_key_obj.created_at,
        "expires_at": api_key_obj.expires_at,
        "message": "Store this API key securely - it will not be shown again"
    }


@app.get("/api/auth/api-keys", response_model=List[APIKey])
async def list_api_keys(current_user: User = Depends(get_current_active_user)):
    """
    List current user's API keys
    """
    if not auth_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available"
        )

    keys = await auth_service.list_user_api_keys(current_user.id)
    return keys


@app.delete("/api/auth/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Revoke (delete) an API key
    """
    if not auth_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available"
        )

    await auth_service.revoke_api_key(key_id, current_user.id)
    return None


# ============================================================================
# DEVICE ENDPOINTS
# ============================================================================

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
    min_bytes: Optional[int] = Query(None, ge=0),
    # New enhanced filters
    country: Optional[str] = Query(None, min_length=2, max_length=2, description="Filter by country code (e.g., US, GB)"),
    city: Optional[str] = Query(None, min_length=1, max_length=100, description="Filter by city name"),
    application: Optional[str] = Query(None, min_length=1, max_length=50, description="Filter by application (HTTP, HTTPS, SSH, etc.)"),
    min_rtt: Optional[int] = Query(None, ge=0, description="Minimum RTT in milliseconds"),
    max_rtt: Optional[int] = Query(None, ge=0, description="Maximum RTT in milliseconds"),
    max_jitter: Optional[float] = Query(None, ge=0, description="Maximum jitter in milliseconds"),
    max_retransmissions: Optional[int] = Query(None, ge=0, description="Maximum retransmission count"),
    sni: Optional[str] = Query(None, min_length=1, max_length=255, description="Filter by Server Name Indication"),
    connection_state: Optional[str] = Query(None, description="Filter by connection state (ESTABLISHED, SYN_SENT, etc.)")
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
            min_bytes=min_bytes,
            country=country,
            city=city,
            application=application,
            min_rtt=min_rtt,
            max_rtt=max_rtt,
            max_jitter=max_jitter,
            max_retransmissions=max_retransmissions,
            sni=sni,
            connection_state=connection_state
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
async def dismiss_threat(
    threat_id: str = ThreatIdPath(),
    current_user: User = Depends(require_operator_or_admin)
):
    """Dismiss a threat alert - Requires operator or admin role"""
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


# Network Quality Analytics Endpoints
@app.get("/api/analytics/rtt-trends")
async def get_rtt_trends(
    hours: int = HoursQuery(24, 720),
    device_id: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    interval_minutes: int = Query(15, ge=1, le=1440)
):
    """Get RTT (Round-Trip Time) trends over time"""
    if not network_quality_analytics:
        raise HTTPException(status_code=503, detail="Network quality analytics not initialized")

    return await handle_endpoint_error(
        lambda: network_quality_analytics.get_rtt_trends(hours, device_id, country, interval_minutes),
        "Failed to retrieve RTT trends"
    )


@app.get("/api/analytics/jitter")
async def get_jitter_analysis(
    hours: int = HoursQuery(24, 720),
    device_id: Optional[str] = Query(None)
):
    """Get jitter analysis statistics"""
    if not network_quality_analytics:
        raise HTTPException(status_code=503, detail="Network quality analytics not initialized")

    return await handle_endpoint_error(
        lambda: network_quality_analytics.get_jitter_analysis(hours, device_id),
        "Failed to retrieve jitter analysis"
    )


@app.get("/api/analytics/retransmissions")
async def get_retransmission_report(
    hours: int = HoursQuery(24, 720),
    device_id: Optional[str] = Query(None)
):
    """Get retransmission statistics report"""
    if not network_quality_analytics:
        raise HTTPException(status_code=503, detail="Network quality analytics not initialized")

    return await handle_endpoint_error(
        lambda: network_quality_analytics.get_retransmission_report(hours, device_id),
        "Failed to retrieve retransmission report"
    )


@app.get("/api/analytics/connection-quality")
async def get_connection_quality_summary(
    hours: int = HoursQuery(24, 720),
    device_id: Optional[str] = Query(None)
):
    """Get overall connection quality summary"""
    if not network_quality_analytics:
        raise HTTPException(status_code=503, detail="Network quality analytics not initialized")

    return await handle_endpoint_error(
        lambda: network_quality_analytics.get_connection_quality_summary(hours, device_id),
        "Failed to retrieve connection quality summary"
    )


# Application Analytics Endpoints
@app.get("/api/analytics/applications")
async def get_application_breakdown(
    hours: int = HoursQuery(24, 720),
    device_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100)
):
    """Get top applications by traffic"""
    if not application_analytics:
        raise HTTPException(status_code=503, detail="Application analytics not initialized")

    return await handle_endpoint_error(
        lambda: application_analytics.get_application_breakdown(hours, device_id, limit),
        "Failed to retrieve application breakdown"
    )


@app.get("/api/analytics/applications/trends")
async def get_application_trends(
    hours: int = HoursQuery(24, 720),
    application: Optional[str] = Query(None),
    interval_minutes: int = Query(15, ge=1, le=1440)
):
    """Get application usage trends over time"""
    if not application_analytics:
        raise HTTPException(status_code=503, detail="Application analytics not initialized")

    return await handle_endpoint_error(
        lambda: application_analytics.get_application_trends(hours, application, interval_minutes),
        "Failed to retrieve application trends"
    )


@app.get("/api/analytics/devices/{device_id}/applications")
async def get_device_application_profile(
    device_id: str = DeviceIdPath(),
    hours: int = HoursQuery(24, 720)
):
    """Get application usage profile for a specific device"""
    if not application_analytics:
        raise HTTPException(status_code=503, detail="Application analytics not initialized")

    return await handle_endpoint_error(
        lambda: application_analytics.get_device_application_profile(device_id, hours),
        "Failed to retrieve device application profile"
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
    update: DeviceUpdateRequest = ...,
    current_user: User = Depends(require_operator_or_admin)
):
    """Update device information (name, notes, type) - Requires operator or admin role"""
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
    if update.notes is not None:
        device.notes = update.notes

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
                "city": flow.city or "",
                "asn": flow.asn or "",
                "domain": flow.domain or "",
                "sni": flow.sni or "",
                "threat_level": flow.threatLevel,
                "device_id": flow.deviceId,
                "tcp_flags": ",".join(flow.tcpFlags) if flow.tcpFlags else "",
                "ttl": flow.ttl or "",
                "connection_state": flow.connectionState or "",
                "rtt": flow.rtt or "",
                "retransmissions": flow.retransmissions or "",
                "jitter": flow.jitter or "",
                "application": flow.application or "",
                "user_agent": flow.userAgent or "",
                "http_method": flow.httpMethod or "",
                "url": flow.url or "",
                "dns_query_type": flow.dnsQueryType or "",
                "dns_response_code": flow.dnsResponseCode or ""
            })

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": (
                    f"attachment; "
                    f"filename=flows_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                )
            }
        )
    else:
        # JSON format
        return {
            "export_date": datetime.now().isoformat(),
            "count": len(flows),
            "flows": [flow.dict() for flow in flows]
        }


@app.post("/api/capture/start")
async def start_capture(current_user: User = Depends(require_operator_or_admin)):
    """Start packet capture - Requires operator or admin role"""
    if not packet_capture:
        raise HTTPException(
            status_code=503, detail=ERR_CAPTURE_NOT_INIT
        )
    if packet_capture.is_running():
        return {"status": "already_running"}
    await packet_capture.start()
    return {"status": "started"}


@app.post("/api/capture/stop")
async def stop_capture(current_user: User = Depends(require_operator_or_admin)):
    """Stop packet capture - Requires operator or admin role"""
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

