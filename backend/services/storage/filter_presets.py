"""Filter preset repository: saved flow-filter presets per user."""
import json
from typing import List

from models.types import FilterPreset
from services.storage.base import Repository


class FilterPresetRepository(Repository):
    async def add_filter_preset(self, preset: FilterPreset):
        """Save a new flow filter preset"""
        await self.base._execute_with_retry("""
            INSERT INTO filter_presets (id, user_id, name, filters, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            preset.id, preset.userId, preset.name, json.dumps(preset.filters), preset.createdAt
        ))
        await self.base._ensure_connection()
        await self.base.db.commit()

    async def get_filter_presets(self, user_id: str) -> List[FilterPreset]:
        """List a user's saved filter presets"""
        query = "SELECT * FROM filter_presets WHERE user_id = ? ORDER BY created_at DESC"
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query, (user_id,)) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_filter_preset(row) for row in rows]
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query, (user_id,)) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_filter_preset(row) for row in rows]

    async def delete_filter_preset(self, preset_id: str, user_id: str) -> bool:
        """Delete a filter preset, scoped to its owner"""
        await self.base._ensure_connection()
        cursor = await self.base.db.execute(
            "DELETE FROM filter_presets WHERE id = ? AND user_id = ?", (preset_id, user_id)
        )
        await self.base.db.commit()
        return cursor.rowcount > 0

    def _row_to_filter_preset(self, row) -> FilterPreset:
        """Convert database row to FilterPreset model"""
        return FilterPreset(
            id=row["id"],
            userId=row["user_id"],
            name=row["name"],
            filters=json.loads(row["filters"]),
            createdAt=row["created_at"],
        )
