"""
Simple rate limiting middleware
"""
import time
from collections import defaultdict
from typing import Dict, Tuple
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiting middleware"""

    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        # Store request timestamps per IP: {ip: [timestamps]}
        self.request_history: Dict[str, list] = defaultdict(list)
        # Cleanup old entries every N requests
        self._cleanup_counter = 0

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ["/", "/api/health", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"

        # Clean up old entries periodically
        self._cleanup_counter += 1
        if self._cleanup_counter >= 100:
            self._cleanup_old_entries()
            self._cleanup_counter = 0

        # Check rate limit
        current_time = time.time()
        minute_ago = current_time - 60

        # Remove old timestamps
        self.request_history[client_ip] = [
            ts for ts in self.request_history[client_ip]
            if ts > minute_ago
        ]

        # Check if limit exceeded
        if len(self.request_history[client_ip]) >= self.requests_per_minute:
            logger.warning(
                f"Rate limit exceeded for IP {client_ip}: "
                f"{len(self.request_history[client_ip])} requests"
            )
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Rate limit exceeded. "
                    f"Maximum {self.requests_per_minute} requests per minute."
                )
            )

        # Record this request
        self.request_history[client_ip].append(current_time)

        # Process request
        response = await call_next(request)
        return response

    def _cleanup_old_entries(self):
        """Remove entries older than 1 minute"""
        current_time = time.time()
        minute_ago = current_time - 60

        # Remove old IP entries
        ips_to_remove = []
        for ip, timestamps in self.request_history.items():
            self.request_history[ip] = [
                ts for ts in timestamps if ts > minute_ago
            ]
            if not self.request_history[ip]:
                ips_to_remove.append(ip)

        for ip in ips_to_remove:
            del self.request_history[ip]

