"""Migration system: fresh DB reaches CURRENT_SCHEMA_VERSION, re-run is a no-op."""
import pytest

from utils.migrations import CURRENT_SCHEMA_VERSION, get_schema_version, run_migrations


@pytest.mark.asyncio
async def test_fresh_db_reaches_current_schema_version(storage):
    async with storage.pool.acquire() as conn:
        version = await get_schema_version(conn)
    assert version == CURRENT_SCHEMA_VERSION


@pytest.mark.asyncio
async def test_run_migrations_is_idempotent(storage):
    async with storage.pool.acquire() as conn:
        version_before = await run_migrations(conn)
        version_after = await run_migrations(conn)
    assert version_before == CURRENT_SCHEMA_VERSION
    assert version_after == CURRENT_SCHEMA_VERSION


@pytest.mark.asyncio
async def test_multi_statement_migration_applied(storage):
    """Migration 7's 'up' SQL chains 5 ALTER TABLE statements in one string -
    this only works via executescript(), not execute() (aiosqlite's execute()
    only runs one statement at a time). Confirms all 5 columns landed."""
    async with storage.pool.acquire() as conn:
        async with conn.execute("PRAGMA table_info(flows)") as cursor:
            columns = {row[1] for row in await cursor.fetchall()}
    assert {"http_host", "http_status_code", "dns_query_name", "dns_answers", "tls_version"} <= columns

