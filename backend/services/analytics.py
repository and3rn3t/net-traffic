"""
Analytics service for aggregated data
"""
import logging
from typing import List, Optional
from datetime import datetime, timedelta

from models.types import AnalyticsData, ProtocolStats
from services.storage import StorageService

logger = logging.getLogger(__name__)


class AnalyticsService:
    def __init__(self, storage: StorageService):
        self.storage = storage

    async def get_analytics_data(self, hours_back: int = 24) -> List[AnalyticsData]:
        """Get aggregated analytics data for time range"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )

        # Both aggregated in SQL (avoids loading up to 50000 flows into memory
        # per call). Both use the same epoch-hour-floor bucket alignment, so
        # they merge correctly.
        hourly = await self.storage.aggregate_analytics_hourly(start_time)
        threat_counts_by_hour = await self.storage.aggregate_threat_counts_by_hour(start_time)

        # Anchor gap-filled buckets to the same epoch-hour floor used above -
        # anchoring to raw "now - i hours" (with today's minutes/seconds still
        # attached) would never match an hour-floored bucket key except by
        # coincidence at the exact top of the hour, silently returning all-zero
        # data for every point.
        hour_ms = 60 * 60 * 1000
        current_hour = (int(datetime.now().timestamp() * 1000) // hour_ms) * hour_ms

        result = []
        for i in range(hours_back, -1, -1):
            hour_timestamp = current_hour - i * hour_ms
            data = hourly.get(hour_timestamp, {
                "total_bytes": 0,
                "total_connections": 0,
                "active_devices": 0,
                "threat_count": 0,
            })
            threat_count = data["threat_count"] + threat_counts_by_hour.get(hour_timestamp, 0)

            result.append(AnalyticsData(
                timestamp=hour_timestamp,
                totalBytes=data["total_bytes"],
                totalConnections=data["total_connections"],
                threatCount=threat_count,
                activeDevices=data["active_devices"]
            ))

        return result

    async def get_protocol_stats(self, hours_back: Optional[int] = None) -> List[ProtocolStats]:
        """Get protocol breakdown statistics"""
        start_time = None
        if hours_back:
            start_time = int(
                (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
            )

        protocol_rows = await self.storage.aggregate_protocol_stats(start_time)
        total_bytes = sum(r["bytes"] for r in protocol_rows)

        return [
            ProtocolStats(
                protocol=r["protocol"],
                bytes=r["bytes"],
                connections=r["connections"],
                percentage=(r["bytes"] / total_bytes * 100) if total_bytes > 0 else 0
            )
            for r in protocol_rows
        ]


