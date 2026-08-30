"""
Redis & High-Performance Caching Service
=========================================
Connects to Redis server (IP: 127.0.0.1, Port: 38215) with authentication.
Features automatic fallback to fast in-memory dictionary caching if Redis
is unreachable or temporarily offline, ensuring zero system downtime.
"""

import json
import time
import logging
import functools
from typing import Any, Optional
from app.config import Config

logger = logging.getLogger(__name__)

try:
    import redis
    REDIS_LIB_AVAILABLE = True
except ImportError:
    REDIS_LIB_AVAILABLE = False
    redis = None  # type: ignore


class CacheManager:
    """Unified Caching Layer supporting Redis with In-Memory fallback."""

    def __init__(self):
        self.redis_client: Optional[Any] = None
        self.using_redis: bool = False
        self.in_memory_store: dict = {}

    def init_app(self, app=None):
        """Initialize Redis connection using credentials from Config."""
        if not Config.REDIS_ENABLED:
            logger.info("REDIS CACHE: Disabled via configuration.")
            return

        if not REDIS_LIB_AVAILABLE:
            logger.warning("REDIS CACHE: 'redis' python package not installed. Using in-memory fallback.")
            return

        try:
            self.redis_client = redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                password=Config.REDIS_PASSWORD or None,
                db=Config.REDIS_DB,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
                decode_responses=True,
            )
            # Test connection
            if self.redis_client.ping():
                self.using_redis = True
                logger.info(
                    f"REDIS CACHE CONNECTED: Connected to Redis at {Config.REDIS_HOST}:{Config.REDIS_PORT} "
                    f"(Max memory target: {Config.REDIS_MAX_MEMORY})"
                )
                # Attempt to set maxmemory and eviction policy for optimal 128m memory management
                try:
                    self.redis_client.config_set("maxmemory", Config.REDIS_MAX_MEMORY)
                    self.redis_client.config_set("maxmemory-policy", "allkeys-lru")
                except Exception as cfg_err:
                    logger.debug(f"Redis config_set skipped/restricted: {cfg_err}")
        except Exception as e:
            self.using_redis = False
            self.redis_client = None
            logger.warning(
                f"REDIS CACHE CONNECTION NOTICE: Unable to reach Redis at {Config.REDIS_HOST}:{Config.REDIS_PORT} ({e}). "
                f"Activated ultra-fast In-Memory caching fallback."
            )

    def get(self, key: str) -> Optional[Any]:
        """Retrieve value from Redis or fallback store."""
        if self.using_redis and self.redis_client:
            try:
                raw_data = self.redis_client.get(key)
                if raw_data is not None:
                    return json.loads(raw_data)
            except Exception as e:
                logger.error(f"Redis GET error for key '{key}': {e}")

        # Fallback to in-memory store
        item = self.in_memory_store.get(key)
        if item:
            expire_at, data = item
            if expire_at is None or expire_at > time.time():
                return data
            else:
                # Expired key
                del self.in_memory_store[key]
        return None

    def set(self, key: str, value: Any, timeout: int = 300) -> bool:
        """Store value with expiration (default 300 seconds / 5 min)."""
        if self.using_redis and self.redis_client:
            try:
                serialized = json.dumps(value, default=str)
                return bool(self.redis_client.set(name=key, value=serialized, ex=timeout))
            except Exception as e:
                logger.error(f"Redis SET error for key '{key}': {e}")

        # Fallback in-memory
        expire_at = time.time() + timeout if timeout else None
        self.in_memory_store[key] = (expire_at, value)
        self.clean_expired_in_memory()
        return True

    def delete(self, key: str) -> bool:
        """Delete specific key."""
        deleted = False
        if self.using_redis and self.redis_client:
            try:
                deleted = bool(self.redis_client.delete(key))
            except Exception as e:
                logger.error(f"Redis DELETE error for key '{key}': {e}")

        if key in self.in_memory_store:
            del self.in_memory_store[key]
            deleted = True
        return deleted

    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern (e.g. 'services:*')."""
        count = 0
        if self.using_redis and self.redis_client:
            try:
                keys = self.redis_client.keys(pattern)
                if keys:
                    count = self.redis_client.delete(*keys)
            except Exception as e:
                logger.error(f"Redis DELETE PATTERN error '{pattern}': {e}")

        # Clean in-memory keys
        import fnmatch
        keys_to_del = [k for k in self.in_memory_store.keys() if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_del:
            del self.in_memory_store[k]
            count += 1
        return count

    def clear(self) -> bool:
        """Flush cache."""
        if self.using_redis and self.redis_client:
            try:
                self.redis_client.flushdb()
            except Exception as e:
                logger.error(f"Redis FLUSHDB error: {e}")
        self.in_memory_store.clear()
        return True

    def clean_expired_in_memory(self):
        """Purge expired keys from in-memory dictionary to keep memory minimal."""
        now = time.time()
        expired_keys = [
            k for k, (exp, _) in self.in_memory_store.items()
            if exp is not None and exp <= now
        ]
        for k in expired_keys:
            del self.in_memory_store[k]

    def get_status(self) -> dict:
        """Return cache health diagnostic status."""
        return {
            "enabled": Config.REDIS_ENABLED,
            "mode": "redis" if self.using_redis else "in_memory_fallback",
            "redis_connected": self.using_redis,
            "host": Config.REDIS_HOST,
            "port": Config.REDIS_PORT,
            "max_memory": Config.REDIS_MAX_MEMORY,
            "in_memory_keys": len(self.in_memory_store),
        }


# Global Singleton Cache Instance
cache = CacheManager()


def cached(timeout: int = 300, key_prefix: str = "cache"):
    """Decorator to cache API response or function result."""
    def decorator(f):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            # Create a unique key based on function name, args, kwargs
            arg_str = f"{args}:{kwargs}"
            cache_key = f"{key_prefix}:{f.__module__}.{f.__name__}:{hash(arg_str)}"
            
            cached_val = cache.get(cache_key)
            if cached_val is not None:
                return cached_val

            result = f(*args, **kwargs)
            if result is not None:
                cache.set(cache_key, result, timeout=timeout)
            return result
        return decorated_function
    return decorator
