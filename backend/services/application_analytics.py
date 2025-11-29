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

        flows = await self.storage.get_flows(
            limit=100000,
            start_time=start_time,
            device_id=device_id
        )

        # Filter flows with application data
        flows_with_app = [f for f in flows if f.application]

        app_stats = defaultdict(lambda: {
            "application": "",
            "connections": 0,
            "bytes": 0,
            "packets": 0,
            "devices": set(),
            "avg_rtt": 0.0,
            "rtt_count": 0,
            "rtt_sum": 0.0
        })

        for flow in flows_with_app:
            app = flow.application
            if not app:
                continue

            app_stats[app]["application"] = app
            app_stats[app]["connections"] += 1
            app_stats[app]["bytes"] += flow.bytesIn + flow.bytesOut
            app_stats[app]["packets"] += flow.packetsIn + flow.packetsOut
            app_stats[app]["devices"].add(flow.deviceId)

            if flow.rtt is not None:
                app_stats[app]["rtt_sum"] += flow.rtt
                app_stats[app]["rtt_count"] += 1

        # Calculate averages and format
        result = []
        for app, stats in app_stats.items():
            avg_rtt = (
                stats["rtt_sum"] / stats["rtt_count"]
                if stats["rtt_count"] > 0 else 0
            )

            result.append({
                "application": app,
                "connections": stats["connections"],
                "bytes": stats["bytes"],
                "packets": stats["packets"],
                "unique_devices": len(stats["devices"]),
                "avg_rtt": round(avg_rtt, 2) if avg_rtt > 0 else None,
                "traffic_percentage": 0  # Will calculate after sorting
            })

        # Sort by bytes and calculate percentages
        total_bytes = sum(r["bytes"] for r in result)
        result.sort(key=lambda x: x["bytes"], reverse=True)

        for item in result:
            item["traffic_percentage"] = round(
                (item["bytes"] / total_bytes * 100) if total_bytes > 0 else 0, 2
            )

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

        flows = await self.storage.get_flows(
            limit=100000,
            start_time=start_time
        )

        # Filter by application if specified
        if application:
            flows = [f for f in flows if f.application == application]
        else:
            flows = [f for f in flows if f.application]

        interval_ms = interval_minutes * 60 * 1000
        timeline = defaultdict(lambda: {
            "timestamp": 0,
            "applications": defaultdict(lambda: {
                "connections": 0,
                "bytes": 0
            })
        })

        for flow in flows:
            if not flow.application:
                continue

            interval_timestamp = (flow.timestamp // interval_ms) * interval_ms

            if interval_timestamp not in timeline:
                timeline[interval_timestamp] = {
                    "timestamp": interval_timestamp,
                    "applications": defaultdict(lambda: {
                        "connections": 0,
                        "bytes": 0
                    })
                }

            timeline[interval_timestamp]["applications"][flow.application]["connections"] += 1
            timeline[interval_timestamp]["applications"][flow.application]["bytes"] += (
                flow.bytesIn + flow.bytesOut
            )

        # Format result
        result = []
        for timestamp, data in sorted(timeline.items()):
            apps_data = []
            for app, stats in data["applications"].items():
                apps_data.append({
                    "application": app,
                    "connections": stats["connections"],
                    "bytes": stats["bytes"]
                })

            result.append({
                "timestamp": timestamp,
                "applications": sorted(apps_data, key=lambda x: x["bytes"], reverse=True)
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

        flows = await self.storage.get_flows(
            limit=100000,
            device_id=device_id,
            start_time=start_time
        )

        flows_with_app = [f for f in flows if f.application]

        app_usage = defaultdict(lambda: {
            "connections": 0,
            "bytes": 0,
            "duration": 0
        })

        for flow in flows_with_app:
            app = flow.application
            app_usage[app]["connections"] += 1
            app_usage[app]["bytes"] += flow.bytesIn + flow.bytesOut
            app_usage[app]["duration"] += flow.duration

        result = []
        total_bytes = sum(stats["bytes"] for stats in app_usage.values())

        for app, stats in app_usage.items():
            result.append({
                "application": app,
                "connections": stats["connections"],
                "bytes": stats["bytes"],
                "avg_duration": round(
                    stats["duration"] / stats["connections"] if stats["connections"] > 0 else 0, 2
                ),
                "traffic_percentage": round(
                    (stats["bytes"] / total_bytes * 100) if total_bytes > 0 else 0, 2
                )
            })

        result.sort(key=lambda x: x["bytes"], reverse=True)

        return {
            "device_id": device_id,
            "total_applications": len(result),
            "total_connections": sum(r["connections"] for r in result),
            "total_bytes": total_bytes,
            "applications": result
        }

