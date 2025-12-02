"""
Database migration system
Handles schema changes and version tracking
"""
import aiosqlite
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Current schema version
CURRENT_SCHEMA_VERSION = 2

# Migration history
MIGRATIONS = {
    1: {
        "description": "Initial schema",
        "up": None,  # Initial schema is created in _create_tables
    },
    2: {
        "description": "Add notes field to devices table",
        "up": """
            -- Check if column exists before adding
            -- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
            -- So we'll catch the error if it already exists
        """,
    },
}


async def get_schema_version(db: aiosqlite.Connection) -> int:
    """Get current schema version from database"""
    try:
        async with db.execute(
            "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
        ) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0
    except aiosqlite.OperationalError:
        # Schema version table doesn't exist yet
        return 0


async def set_schema_version(db: aiosqlite.Connection, version: int):
    """Set schema version in database"""
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL,
            description TEXT
        )
        """
    )
    await db.execute(
        """
        INSERT OR REPLACE INTO schema_version (version, applied_at, description)
        VALUES (?, ?, ?)
        """,
        (
            version,
            int(time.time()),
            MIGRATIONS.get(version, {}).get("description", ""),
        ),
    )
    await db.commit()


async def create_schema_version_table(db: aiosqlite.Connection):
    """Create schema version tracking table"""
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL,
            description TEXT
        )
        """
    )
    await db.commit()


async def run_migrations(db: aiosqlite.Connection) -> int:
    """Run pending migrations"""
    await create_schema_version_table(db)

    current_version = await get_schema_version(db)
    target_version = CURRENT_SCHEMA_VERSION

    if current_version >= target_version:
        logger.info(f"Database schema is up to date (version {current_version})")
        return current_version

    logger.info(
        f"Migrating database from version {current_version} to {target_version}"
    )

    for version in range(current_version + 1, target_version + 1):
        if version not in MIGRATIONS:
            logger.warning(f"No migration found for version {version}, skipping")
            continue

        migration = MIGRATIONS[version]
        description = migration.get("description", "No description")
        logger.info(f"Applying migration {version}: {description}")

        try:
            if migration.get("up"):
                # For migration 2, check if column already exists
                if version == 2:
                    # Check if notes column exists in devices table
                    async with db.execute(
                        "PRAGMA table_info(devices)"
                    ) as cursor:
                        columns = await cursor.fetchall()
                        column_names = [col[1] for col in columns]
                        if "notes" in column_names:
                            logger.info(f"Column 'notes' already exists in devices table, skipping migration {version}")
                        else:
                            await db.execute("ALTER TABLE devices ADD COLUMN notes TEXT;")
                            await db.commit()
                            logger.info(f"Migration {version} applied successfully")
                else:
                    await db.execute(migration["up"])
                    await db.commit()
                    logger.info(f"Migration {version} applied successfully")
            else:
                logger.info(f"Migration {version} is initial schema, skipping")

            await set_schema_version(db, version)
        except Exception as e:
            # If error is about duplicate column, it's okay - column already exists
            if "duplicate column" in str(e).lower() or "duplicate column name" in str(e).lower():
                logger.warning(f"Column already exists, marking migration {version} as applied")
                await set_schema_version(db, version)
            else:
                logger.error(f"Error applying migration {version}: {e}")
                raise

    logger.info(f"Database migration complete (version {target_version})")
    return target_version

