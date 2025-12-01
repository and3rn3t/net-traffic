"""
Analytics service for aggregated data
"""
import logging
from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

from models.types import AnalyticsData, ProtocolStats
from services.storage import StorageService

logger = logging.getLogger(__name__)


class AnalyticsService:
    def __init__(self, storage: StorageService):
        self.storage = storage

    async def get_analytics_data(self, hours_back: int = 24) -> List[AnalyticsData]:
        """Get aggregated analytics data for time range"""
        # Get flows from the time range using database filtering
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )

        # Use database-level aggregation instead of loading all flows (Pi optimization)
        # This reduces memory usage significantly
        flows = await self.storage.get_flows(
            limit=50000,  # Reduced limit for Pi (was 100000)
            start_time=start_time
        )

        # Group by hour
        hourly_data = defaultdict(lambda: {
            "totalBytes": 0,
            "totalConnections": 0,
            "threatCount": 0,
            "devices": set()
        })

        # Aggregate flows
        for flow in flows:
            hour_timestamp = (flow.timestamp // (60 * 60 * 1000)) * (60 * 60 * 1000)
            hourly_data[hour_timestamp]["totalBytes"] += flow.bytesIn + flow.bytesOut
            hourly_data[hour_timestamp]["totalConnections"] += 1
            hourly_data[hour_timestamp]["devices"].add(flow.deviceId)

            if flow.threatLevel in ["medium", "high", "critical"]:
                hourly_data[hour_timestamp]["threatCount"] += 1

        # Get threats for the time range
        threats = await self.storage.get_threats(active_only=False)
        for threat in threats:
            if threat.timestamp >= start_time:
                hour_timestamp = (threat.timestamp // (60 * 60 * 1000)) * (60 * 60 * 1000)
                if hour_timestamp in hourly_data:
                    hourly_data[hour_timestamp]["threatCount"] += 1

        # Convert to list and fill gaps
        result = []
        now = datetime.now()
        for i in range(hours_back, -1, -1):
            hour_time = now - timedelta(hours=i)
            hour_timestamp = int(hour_time.timestamp() * 1000)

            data = hourly_data.get(hour_timestamp, {
                "totalBytes": 0,
                "totalConnections": 0,
                "threatCount": 0,
                "devices": set()
            })

            result.append(AnalyticsData(
                timestamp=hour_timestamp,
                totalBytes=data["totalBytes"],
                totalConnections=data["totalConnections"],
                threatCount=data["threatCount"],
                activeDevices=len(data["devices"])
            ))

        return result

    async def get_protocol_stats(self, hours_back: Optional[int] = None) -> List[ProtocolStats]:
        """Get protocol breakdown statistics"""
        # Optionally filter by time range
        start_time = None
        if hours_back:
            start_time = int(
                (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
            )
        
        flows = await self.storage.get_flows(
            limit=100000,
            start_time=start_time
        )

        # Aggregate by protocol
        protocol_data = defaultdict(lambda: {
            "bytes": 0,
            "connections": 0
        })

        for flow in flows:
            protocol = flow.protocol
            protocol_data[protocol]["bytes"] += flow.bytesIn + flow.bytesOut
            protocol_data[protocol]["connections"] += 1

        # Calculate total
        total_bytes = sum(p["bytes"] for p in protocol_data.values())

        # Convert to list
        result = []
        for protocol, data in protocol_data.items():
            percentage = (data["bytes"] / total_bytes * 100) if total_bytes > 0 else 0
            result.append(ProtocolStats(
                protocol=protocol,
                bytes=data["bytes"],
                connections=data["connections"],
                percentage=percentage
            ))

        # Sort by bytes descending
        result.sort(key=lambda x: x.bytes, reverse=True)

        return result

