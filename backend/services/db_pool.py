"""
Database Connection Pool Manager
Provides connection pooling, health checks, and query queuing for SQLite
"""
import asyncio
import logging
import aiosqlite
from typing import Optional, Callable, Any
from contextlib import asynccontextmanager
from datetime import datetime

logger = logging.getLogger(__name__)


class DatabasePool:
    """
    Lightweight connection pool for SQLite
    Provides connection reuse, health checks, and query serialization
    """

    def __init__(
        self,
        db_path: str,
        max_connections: int = 5,
        connection_timeout: float = 30.0,
        enable_wal: bool = True
    ):
        """
        Initialize database pool

        Args:
            db_path: Path to SQLite database file
            max_connections: Maximum number of concurrent connections
            connection_timeout: Connection acquisition timeout in seconds
            enable_wal: Enable Write-Ahead Logging for better concurrency
        """
        self.db_path = db_path
        self.max_connections = max_connections
        self.connection_timeout = connection_timeout
        self.enable_wal = enable_wal

        # Connection pool
        self._pool: list[aiosqlite.Connection] = []
        self._pool_size = 0
        self._available = asyncio.Queue()
        self._lock = asyncio.Lock()

        # Statistics
        self._stats = {
            "connections_created": 0,
            "connections_reused": 0,
            "query_count": 0,
            "error_count": 0,
            "last_error": None,
            "pool_hits": 0,
            "pool_misses": 0
        }

    async def initialize(self):
        """Initialize the connection pool"""
        try:
            # Create initial connections
            initial_size = min(2, self.max_connections)
            for _ in range(initial_size):
                conn = await self._create_connection()
                await self._available.put(conn)
                self._pool.append(conn)

            logger.info(
                f"Database pool initialized with {initial_size} connections "
                f"(max: {self.max_connections}) for {self.db_path}"
            )
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            raise

    async def _create_connection(self) -> aiosqlite.Connection:
        """Create a new database connection"""
        try:
            conn = await aiosqlite.connect(
                self.db_path,
                timeout=self.connection_timeout,
                isolation_level=None  # Autocommit mode
            )
            conn.row_factory = aiosqlite.Row

            # Enable WAL mode for better concurrent access
            if self.enable_wal:
                await conn.execute("PRAGMA journal_mode=WAL")

            # Optimize SQLite settings
            await conn.execute("PRAGMA synchronous=NORMAL")
            await conn.execute("PRAGMA temp_store=MEMORY")
            await conn.execute("PRAGMA mmap_size=268435456")  # 256MB
            await conn.execute("PRAGMA cache_size=-64000")  # 64MB cache

            self._pool_size += 1
            self._stats["connections_created"] += 1

            logger.debug(f"Created new database connection (total: {self._pool_size})")
            return conn

        except Exception as e:
            self._stats["error_count"] += 1
            self._stats["last_error"] = str(e)
            logger.error(f"Failed to create database connection: {e}")
            raise

    @asynccontextmanager
    async def acquire(self):
        """
        Acquire a connection from the pool

        Usage:
            async with pool.acquire() as conn:
                cursor = await conn.execute("SELECT * FROM table")
                rows = await cursor.fetchall()
        """
        conn = None
        try:
            # Try to get an available connection
            try:
                conn = await asyncio.wait_for(
                    self._available.get(),
                    timeout=0.1  # Quick check
                )
                self._stats["pool_hits"] += 1
                self._stats["connections_reused"] += 1
            except asyncio.TimeoutError:
                # No connection available, create new if under limit
                self._stats["pool_misses"] += 1

                async with self._lock:
                    if self._pool_size < self.max_connections:
                        conn = await self._create_connection()
                        self._pool.append(conn)
                    else:
                        # Wait for an available connection
                        logger.debug("Pool exhausted, waiting for available connection")
                        conn = await asyncio.wait_for(
                            self._available.get(),
                            timeout=self.connection_timeout
                        )
                        self._stats["connections_reused"] += 1

            # Verify connection is healthy
            if not await self._check_connection_health(conn):
                logger.warning("Connection unhealthy, creating new connection")
                await self._close_connection(conn)
                conn = await self._create_connection()
                self._pool.append(conn)

            yield conn

        except Exception as e:
            self._stats["error_count"] += 1
            self._stats["last_error"] = str(e)
            logger.error(f"Error in connection acquire: {e}")
            raise

        finally:
            # Return connection to pool
            if conn:
                try:
                    # Reset connection state
                    await conn.rollback()  # Rollback any uncommitted transactions

                    # Return to pool
                    await self._available.put(conn)
                except Exception as e:
                    logger.error(f"Error returning connection to pool: {e}")
                    await self._close_connection(conn)

    async def _check_connection_health(self, conn: aiosqlite.Connection) -> bool:
        """Check if a connection is still healthy"""
        try:
            cursor = await conn.execute("SELECT 1")
            await cursor.fetchone()
            await cursor.close()
            return True
        except Exception as e:
            logger.warning(f"Connection health check failed: {e}")
            return False

    async def _close_connection(self, conn: aiosqlite.Connection):
        """Close a connection and remove from pool"""
        try:
            await conn.close()
            self._pool_size -= 1
            if conn in self._pool:
                self._pool.remove(conn)
            logger.debug(f"Closed database connection (remaining: {self._pool_size})")
        except Exception as e:
            logger.error(f"Error closing connection: {e}")

    async def execute_query(
        self,
        query: str,
        params: tuple = None,
        fetch_one: bool = False,
        fetch_all: bool = False
    ) -> Any:
        """
        Execute a query using a pooled connection

        Args:
            query: SQL query string
            params: Query parameters
            fetch_one: Fetch single result
            fetch_all: Fetch all results

        Returns:
            Query results or None
        """
        self._stats["query_count"] += 1

        async with self.acquire() as conn:
            try:
                cursor = await conn.execute(query, params or ())

                if fetch_one:
                    result = await cursor.fetchone()
                    await cursor.close()
                    return result
                elif fetch_all:
                    result = await cursor.fetchall()
                    await cursor.close()
                    return result
                else:
                    await cursor.close()
                    return None

            except Exception as e:
                self._stats["error_count"] += 1
                self._stats["last_error"] = str(e)
                logger.error(f"Query execution error: {e}")
                raise

    async def execute_many(self, query: str, params_list: list) -> None:
        """
        Execute a query with multiple parameter sets

        Args:
            query: SQL query string
            params_list: List of parameter tuples
        """
        self._stats["query_count"] += len(params_list)

        async with self.acquire() as conn:
            try:
                await conn.executemany(query, params_list)
                await conn.commit()
            except Exception as e:
                self._stats["error_count"] += 1
                self._stats["last_error"] = str(e)
                logger.error(f"Bulk query execution error: {e}")
                raise

    async def execute_transaction(self, operations: Callable) -> Any:
        """
        Execute multiple operations in a single transaction

        Args:
            operations: Async function that receives connection and performs operations

        Returns:
            Result from operations function
        """
        async with self.acquire() as conn:
            try:
                await conn.execute("BEGIN TRANSACTION")
                result = await operations(conn)
                await conn.commit()
                return result
            except Exception as e:
                await conn.rollback()
                self._stats["error_count"] += 1
                self._stats["last_error"] = str(e)
                logger.error(f"Transaction error: {e}")
                raise

    def get_stats(self) -> dict:
        """Get pool statistics"""
        return {
            "pool_size": self._pool_size,
            "max_connections": self.max_connections,
            "available_connections": self._available.qsize(),
            "statistics": {
                **self._stats,
                "pool_utilization": (
                    round(
                        (1 - self._available.qsize() / max(self._pool_size, 1)) * 100,
                        2
                    )
                ),
                "pool_hit_rate": (
                    round(
                        self._stats["pool_hits"] /
                        max(self._stats["pool_hits"] + self._stats["pool_misses"], 1) * 100,
                        2
                    )
                )
            }
        }

    async def close(self):
        """Close all connections in the pool"""
        logger.info("Closing database connection pool")

        # Close all connections
        for conn in self._pool:
            try:
                await conn.close()
            except Exception as e:
                logger.error(f"Error closing pooled connection: {e}")

        self._pool.clear()
        self._pool_size = 0

        # Clear the queue
        while not self._available.empty():
            try:
                self._available.get_nowait()
            except asyncio.QueueEmpty:
                break

        logger.info("Database connection pool closed")
