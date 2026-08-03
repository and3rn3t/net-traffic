"""
Redis Caching Service
Provides caching layer for expensive analytics queries
"""
import fnmatch
import logging
import json
import time
import redis.asyncio as redis
from typing import Optional, Any

logger = logging.getLogger(__name__)

# Max keys kept in the in-memory fallback cache when Redis is unavailable
MEMORY_CACHE_MAX_KEYS = 500


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
        # Fallback used whenever Redis is unreachable: key -> (value, expire_at_monotonic)
        self._memory_cache: dict[str, tuple[Any, float]] = {}

    async def initialize(self):
        """Initialize Redis connection, falling back to an in-memory cache on failure"""
        try:
            self.redis = await redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Test connection
            await self.redis.ping()
            logger.info(f"Cache service connected to Redis at {self.host}:{self.port}")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Using in-memory cache fallback.")
            self.redis = None

    async def close(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
            logger.info("Cache service disconnected")
        self._memory_cache.clear()

    def is_enabled(self) -> bool:
        """Check if caching is enabled (always true - falls back to in-memory cache)"""
        return self._enabled

    def _uses_redis(self) -> bool:
        return self._enabled and self.redis is not None

    def _memory_get(self, key: str) -> Optional[Any]:
        entry = self._memory_cache.get(key)
        if entry is None:
            return None
        value, expire_at = entry
        if expire_at < time.monotonic():
            del self._memory_cache[key]
            return None
        return value

    def _memory_set(self, key: str, value: Any, ttl: int) -> None:
        if len(self._memory_cache) >= MEMORY_CACHE_MAX_KEYS and key not in self._memory_cache:
            # Evict the entry expiring soonest to make room
            oldest_key = min(self._memory_cache, key=lambda k: self._memory_cache[k][1])
            del self._memory_cache[oldest_key]
        self._memory_cache[key] = (value, time.monotonic() + ttl)

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

        if not self._uses_redis():
            return self._memory_get(key)

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

        ttl = ttl if ttl is not None else self.default_ttl

        if not self._uses_redis():
            self._memory_set(key, value, ttl)
            return True

        try:
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

        if not self._uses_redis():
            self._memory_cache.pop(key, None)
            return True

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

        if not self._uses_redis():
            matched = [k for k in self._memory_cache if fnmatch.fnmatchcase(k, pattern)]
            for k in matched:
                del self._memory_cache[k]
            return len(matched)

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
                "message": "Cache disabled"
            }

        if not self._uses_redis():
            return {
                "enabled": True,
                "backend": "memory",
                "keys": len(self._memory_cache),
                "max_keys": MEMORY_CACHE_MAX_KEYS,
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
                "backend": "redis",
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
