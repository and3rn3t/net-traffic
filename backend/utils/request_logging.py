"""
Request logging middleware for API observability
"""
import time
import uuid
import logging
import json
from typing import Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all HTTP requests and responses"""

    # Paths to exclude from logging (or log at DEBUG level)
    EXCLUDED_PATHS = {
        "/",
        "/api/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/favicon.ico",
    }

    def __init__(self, app, log_excluded_paths: bool = False):
        """
        Initialize request logging middleware

        Args:
            app: FastAPI application
            log_excluded_paths: If True, log excluded paths at DEBUG level
        """
        super().__init__(app)
        self.log_excluded_paths = log_excluded_paths

    async def dispatch(self, request: Request, call_next):
        """Process request and log details"""
        # Generate unique request ID
        request_id = str(uuid.uuid4())[:8]

        # Get client info
        client_ip = request.client.host if request.client else "unknown"
        client_port = request.client.port if request.client else None

        # Determine if we should log this request
        should_log = request.url.path not in self.EXCLUDED_PATHS
        should_log_debug = (
            not should_log and self.log_excluded_paths
        )

        # Start timing
        start_time = time.time()

        # Log request details
        if should_log:
            self._log_request(request, request_id, client_ip, client_port)
        elif should_log_debug:
            logger.debug(
                f"[{request_id}] {request.method} {request.url.path} "
                f"from {client_ip}"
            )

        # Process request and capture response
        response: Optional[Response] = None
        status_code = 500
        error_occurred = False
        error_message = None

        try:
            response = await call_next(request)
            status_code = response.status_code

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            # Log response
            if should_log:
                self._log_response(
                    request, request_id, status_code, duration_ms,
                    client_ip
                )
            elif should_log_debug:
                logger.debug(
                    f"[{request_id}] {request.method} {request.url.path} "
                    f"-> {status_code} ({duration_ms:.2f}ms)"
                )

            return response

        except Exception as e:
            # Handle exceptions during request processing
            error_occurred = True
            error_message = str(e)
            duration_ms = (time.time() - start_time) * 1000
            status_code = 500

            # Log error
            logger.error(
                f"[{request_id}] ERROR {request.method} {request.url.path} "
                f"from {client_ip} - {error_message} ({duration_ms:.2f}ms)",
                exc_info=True
            )

            # Re-raise the exception so FastAPI can handle it
            raise

        finally:
            # Log structured data if enabled (for JSON logging)
            if should_log and logger.isEnabledFor(logging.INFO):
                self._log_structured(
                    request, request_id, status_code, duration_ms,
                    client_ip, client_port, error_occurred, error_message
                )

    def _log_request(
        self, request: Request, request_id: str,
        client_ip: str, client_port: Optional[int]
    ):
        """Log incoming request details"""
        query_params = dict(request.query_params)

        # Don't log full query strings for very long requests
        query_str = "&".join(
            f"{k}={v[:50]}" if len(str(v)) > 50 else f"{k}={v}"
            for k, v in query_params.items()
        )[:200]  # Limit total length

        log_msg = (
            f"[{request_id}] {request.method} {request.url.path}"
        )

        if query_str:
            log_msg += f"?{query_str}"

        log_msg += f" from {client_ip}"
        if client_port:
            log_msg += f":{client_port}"

        logger.info(log_msg)

    def _log_response(
        self, request: Request, request_id: str,
        status_code: int, duration_ms: float, client_ip: str
    ):
        """Log response details"""
        # Determine log level based on status code
        if status_code >= 500:
            log_level = logging.ERROR
        elif status_code >= 400:
            log_level = logging.WARNING
        else:
            log_level = logging.INFO

        # Format duration for readability
        if duration_ms < 100:
            duration_str = f"{duration_ms:.2f}ms"
        elif duration_ms < 1000:
            duration_str = f"{duration_ms:.0f}ms"
        else:
            duration_str = f"{duration_ms/1000:.2f}s"

        log_msg = (
            f"[{request_id}] {request.method} {request.url.path} "
            f"-> {status_code} ({duration_str}) from {client_ip}"
        )

        logger.log(log_level, log_msg)

    def _log_structured(
        self, request: Request, request_id: str, status_code: int,
        duration_ms: float, client_ip: str, client_port: Optional[int],
        error_occurred: bool, error_message: Optional[str]
    ):
        """Log structured data (JSON format) for better parsing"""
        # Only log structured data at INFO level or above
        if not logger.isEnabledFor(logging.INFO):
            return

        # Build structured log entry
        log_data = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "status_code": status_code,
            "duration_ms": round(duration_ms, 2),
            "client_ip": client_ip,
            "timestamp": time.time(),
            "error": error_occurred,
        }

        if client_port:
            log_data["client_port"] = client_port

        if error_message:
            log_data["error_message"] = error_message

        # Log as JSON string for structured logging systems
        # This allows easy parsing by log aggregation tools
        try:
            logger.debug(f"[STRUCTURED] {json.dumps(log_data)}")
        except Exception:
            # Fallback if JSON serialization fails
            logger.debug(f"[STRUCTURED] {log_data}")
