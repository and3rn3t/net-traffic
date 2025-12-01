"""
Redis Caching Service
Provides caching layer for expensive analytics queries
"""
import logging
import json
import redis.asyncio as redis
from typing import Optional, Any, List
from datetime import timedelta

logger = logging.getLogger(__name__)


class CacheService:
    """
    Redis-based caching service for analytics data
    Reduces database load and improves response times
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: Optional[str] = None,
        default_ttl: int = 300  # 5 minutes default TTL
    ):
        """Initialize cache service"""
        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self.default_ttl = default_ttl
        self.redis: Optional[redis.Redis] = None
        self._enabled = True

    async def initialize(self):
        """Initialize Redis connection"""
        try:
            self.redis = await redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Test connection
            await self.redis.ping()
            logger.info(f"Cache service connected to Redis at {self.host}:{self.port}")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Caching disabled.")
            self._enabled = False
            self.redis = None

    async def close(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
            logger.info("Cache service disconnected")

    def is_enabled(self) -> bool:
        """Check if caching is enabled"""
        return self._enabled and self.redis is not None

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired
        """
        if not self.is_enabled():
            return None

        try:
            value = await self.redis.get(key)
            if value is None:
                logger.debug(f"Cache miss: {key}")
                return None

            logger.debug(f"Cache hit: {key}")
            return json.loads(value)
        except Exception as e:
            logger.warning(f"Cache get error for key {key}: {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Set value in cache

        Args:
            key: Cache key
            value: Value to cache (must be JSON serializable)
            ttl: Time to live in seconds (None = default_ttl)

        Returns:
            True if successful, False otherwise
        """
        if not self.is_enabled():
            return False

        try:
            ttl = ttl if ttl is not None else self.default_ttl
            serialized = json.dumps(value, default=str)  # Handle datetime objects
            await self.redis.setex(key, ttl, serialized)
            logger.debug(f"Cache set: {key} (TTL: {ttl}s)")
            return True
        except Exception as e:
            logger.warning(f"Cache set error for key {key}: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """
        Delete key from cache

        Args:
            key: Cache key to delete

        Returns:
            True if successful, False otherwise
        """
        if not self.is_enabled():
            return False

        try:
            await self.redis.delete(key)
            logger.debug(f"Cache delete: {key}")
            return True
        except Exception as e:
            logger.warning(f"Cache delete error for key {key}: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern

        Args:
            pattern: Redis key pattern (e.g., "analytics:*")

        Returns:
            Number of keys deleted
        """
        if not self.is_enabled():
            return 0

        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)

            if keys:
                deleted = await self.redis.delete(*keys)
                logger.debug(f"Cache pattern delete: {pattern} ({deleted} keys)")
                return deleted
            return 0
        except Exception as e:
            logger.warning(f"Cache pattern delete error for {pattern}: {e}")
            return 0

    async def invalidate_analytics(self):
        """Invalidate all analytics caches"""
        await self.delete_pattern("analytics:*")
        await self.delete_pattern("advanced:*")
        logger.info("Analytics cache invalidated")

    async def invalidate_devices(self):
        """Invalidate device-related caches"""
        await self.delete_pattern("devices:*")
        logger.info("Device cache invalidated")

    async def invalidate_flows(self):
        """Invalidate flow-related caches"""
        await self.delete_pattern("flows:*")
        await self.invalidate_analytics()  # Analytics depend on flows
        logger.info("Flow cache invalidated")

    async def invalidate_threats(self):
        """Invalidate threat-related caches"""
        await self.delete_pattern("threats:*")
        logger.info("Threat cache invalidated")

    async def get_stats(self) -> dict:
        """
        Get cache statistics

        Returns:
            Dictionary with cache statistics
        """
        if not self.is_enabled():
            return {
                "enabled": False,
                "message": "Redis not connected"
            }

        try:
            info = await self.redis.info("stats")
            db_info = await self.redis.info("keyspace")

            # Extract key count for current database
            db_key = f"db{self.db}"
            keys_count = 0
            if db_key in db_info:
                keys_count = db_info[db_key].get("keys", 0)

            return {
                "enabled": True,
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "keys": keys_count,
                "hit_rate": self._calculate_hit_rate(
                    info.get("keyspace_hits", 0),
                    info.get("keyspace_misses", 0)
                )
            }
        except Exception as e:
            logger.warning(f"Cache stats error: {e}")
            return {
                "enabled": True,
                "error": str(e)
            }

    def _calculate_hit_rate(self, hits: int, misses: int) -> float:
        """Calculate cache hit rate percentage"""
        total = hits + misses
        if total == 0:
            return 0.0
        return round((hits / total) * 100, 2)

    # Helper methods for common cache keys
    @staticmethod
    def key_analytics_summary(hours: int = 24) -> str:
        """Generate cache key for analytics summary"""
        return f"analytics:summary:{hours}h"

    @staticmethod
    def key_top_talkers(hours: int = 24, limit: int = 10) -> str:
        """Generate cache key for top talkers"""
        return f"analytics:top_talkers:{hours}h:{limit}"

    @staticmethod
    def key_protocol_distribution(hours: int = 24) -> str:
        """Generate cache key for protocol distribution"""
        return f"analytics:protocols:{hours}h"

    @staticmethod
    def key_geographic_data(hours: int = 24) -> str:
        """Generate cache key for geographic distribution"""
        return f"analytics:geographic:{hours}h"

    @staticmethod
    def key_advanced_analytics(metric: str, hours: int = 24) -> str:
        """Generate cache key for advanced analytics"""
        return f"advanced:{metric}:{hours}h"

    @staticmethod
    def key_device_list() -> str:
        """Generate cache key for device list"""
        return "devices:list"

    @staticmethod
    def key_flow_list(limit: int = 100) -> str:
        """Generate cache key for flow list"""
        return f"flows:list:{limit}"

    @staticmethod
    def key_threat_list() -> str:
        """Generate cache key for threat list"""
        return "threats:list"
