"""
Advanced analytics service with additional statistics and aggregations
"""
import logging
from typing import List, Dict
from datetime import datetime, timedelta

from services.storage import StorageService

logger = logging.getLogger(__name__)


class AdvancedAnalyticsService:
    def __init__(self, storage: StorageService):
        self.storage = storage

    async def get_summary_stats(self) -> Dict:
        """Get overall summary statistics"""
        devices = await self.storage.get_devices()
        # Use reasonable limit for summary stats (Pi optimization)
        flows = await self.storage.get_flows(limit=25000)  # Reduced for Pi (was 50000)
        threats = await self.storage.get_threats(active_only=False, limit=100000)

        total_bytes = sum(f.bytesIn + f.bytesOut for f in flows)
        active_flows = [f for f in flows if f.status == "active"]
        active_threats = [t for t in threats if not t.dismissed]

        # Calculate time range
        if flows:
            timestamps = [f.timestamp for f in flows]
            oldest_flow = min(timestamps)
            newest_flow = max(timestamps)
        else:
            oldest_flow = int(datetime.now().timestamp() * 1000)
            newest_flow = oldest_flow

        return {
            "total_devices": len(devices),
            "active_devices": len([d for d in devices if (datetime.now().timestamp() * 1000) - d.lastSeen < 300000]),  # Active in last 5 min
            "total_flows": len(flows),
            "active_flows": len(active_flows),
            "total_bytes": total_bytes,
            "total_threats": len(threats),
            "active_threats": len(active_threats),
            "critical_threats": len([t for t in active_threats if t.severity == "critical"]),
            "oldest_flow_timestamp": oldest_flow,
            "newest_flow_timestamp": newest_flow,
            "capture_duration_hours": (newest_flow - oldest_flow) / (1000 * 60 * 60) if newest_flow > oldest_flow else 0
        }

    async def get_geographic_distribution(self, hours_back: int = 24) -> List[Dict]:
        """Get geographic distribution of connections"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        return await self.storage.aggregate_geographic(start_time)

    async def get_top_domains(self, limit: int = 20, hours_back: int = 24) -> List[Dict]:
        """Get top domains by traffic"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        return await self.storage.aggregate_top_domains(start_time, limit)

    async def get_top_devices(self, limit: int = 10, hours_back: int = 24, sort_by: str = "bytes") -> List[Dict]:
        """Get top devices by traffic"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        devices = await self.storage.get_devices()
        device_stats = await self.storage.aggregate_top_devices(start_time)

        # Enrich with device info
        device_map = {d.id: d for d in devices}
        result = []
        for stats in device_stats:
            device = device_map.get(stats["device_id"])
            result.append({
                "device_id": stats["device_id"],
                "device_name": device.name if device else "Unknown",
                "device_ip": device.ip if device else "Unknown",
                "device_type": device.type if device else "unknown",
                "bytes": stats["bytes"],
                "connections": stats["connections"],
                "threats": stats["threats"]
            })

        sort_key = sort_by if sort_by in ["bytes", "connections", "threats"] else "bytes"
        result.sort(key=lambda x: x[sort_key], reverse=True)
        return result[:limit]

    async def get_bandwidth_timeline(self, hours_back: int = 24, interval_minutes: int = 5) -> List[Dict]:
        """Get bandwidth usage timeline with configurable interval"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        interval_ms = interval_minutes * 60 * 1000
        return await self.storage.aggregate_bandwidth_timeline(
            start_time, interval_ms
        )

    async def get_device_analytics(
        self, device_id: str, hours_back: int = 24
    ) -> Dict:
        """Get detailed analytics for a specific device"""
        device = await self.storage.get_device(device_id)
        if not device:
            return {}

        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        breakdown = await self.storage.aggregate_device_analytics(
            device_id, start_time
        )
        summary = breakdown["summary"]
        return {
            "device": {
                "id": device.id,
                "name": device.name,
                "ip": device.ip,
                "type": device.type
            },
            "summary": {
                "total_bytes_in": summary["total_bytes_in"],
                "total_bytes_out": summary["total_bytes_out"],
                "total_bytes": summary["total_bytes_in"] + summary["total_bytes_out"],
                "connections": summary["connections"],
                "threats": summary["threats"]
            },
            "protocols": breakdown["protocols"],
            "top_domains": breakdown["top_domains"],
            "top_ports": breakdown["top_ports"]
        }

