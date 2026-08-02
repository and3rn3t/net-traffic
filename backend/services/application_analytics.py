"""
Application Usage Analytics Service
Provides analytics for application protocol usage
"""
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from collections import defaultdict

from services.storage import StorageService

logger = logging.getLogger(__name__)


class ApplicationAnalyticsService:
    def __init__(self, storage: StorageService):
        self.storage = storage

    async def get_application_breakdown(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict]:
        """Get top applications by traffic"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )

        app_rows = await self.storage.aggregate_application_breakdown(start_time, device_id)
        total_bytes = sum(r["bytes"] for r in app_rows)

        result = [
            {
                "application": r["application"],
                "connections": r["connections"],
                "bytes": r["bytes"],
                "packets": r["packets"],
                "unique_devices": r["unique_devices"],
                "avg_rtt": round(r["avg_rtt"], 2) if r["avg_rtt"] else None,
                "traffic_percentage": round(
                    (r["bytes"] / total_bytes * 100) if total_bytes > 0 else 0, 2
                ),
            }
            for r in app_rows
        ]

        return result[:limit]

    async def get_application_trends(
        self,
        hours_back: int = 24,
        application: Optional[str] = None,
        interval_minutes: int = 15
    ) -> List[Dict]:
        """Get application usage trends over time"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        interval_ms = interval_minutes * 60 * 1000

        rows = await self.storage.aggregate_application_trends(
            start_time, interval_ms, application=application
        )

        # Group the (bucket, application) rows back into per-bucket lists -
        # cheap in Python since this is only a handful of distinct rows, not
        # every raw flow.
        timeline: Dict[int, list] = defaultdict(list)
        for r in rows:
            timeline[r["bucket"]].append({
                "application": r["application"],
                "connections": r["connections"],
                "bytes": r["bytes"],
            })

        result = []
        for timestamp in sorted(timeline.keys()):
            result.append({
                "timestamp": timestamp,
                "applications": sorted(
                    timeline[timestamp], key=lambda x: x["bytes"], reverse=True
                )
            })

        return result

    async def get_device_application_profile(
        self,
        device_id: str,
        hours_back: int = 24
    ) -> Dict:
        """Get application usage profile for a specific device"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )

        app_rows = await self.storage.aggregate_device_application_profile(device_id, start_time)
        total_bytes = sum(r["bytes"] for r in app_rows)

        result = [
            {
                "application": r["application"],
                "connections": r["connections"],
                "bytes": r["bytes"],
                "avg_duration": round(
                    r["duration"] / r["connections"] if r["connections"] > 0 else 0, 2
                ),
                "traffic_percentage": round(
                    (r["bytes"] / total_bytes * 100) if total_bytes > 0 else 0, 2
                )
            }
            for r in app_rows
        ]
        result.sort(key=lambda x: x["bytes"], reverse=True)

        return {
            "device_id": device_id,
            "total_applications": len(result),
            "total_connections": sum(r["connections"] for r in result),
            "total_bytes": total_bytes,
            "applications": result
        }

