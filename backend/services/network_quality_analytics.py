"""
Network Quality Analytics Service
Provides analytics for RTT, jitter, retransmissions, and connection quality
"""
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta

from services.storage import StorageService

logger = logging.getLogger(__name__)


class NetworkQualityAnalyticsService:
    def __init__(self, storage: StorageService):
        self.storage = storage

    async def get_rtt_trends(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None,
        country: Optional[str] = None,
        interval_minutes: int = 15
    ) -> List[Dict]:
        """Get RTT trends over time"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        interval_ms = interval_minutes * 60 * 1000
        return await self.storage.aggregate_rtt_trends(
            start_time, interval_ms, device_id=device_id, country=country
        )

    async def get_jitter_analysis(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None
    ) -> Dict:
        """Get jitter analysis statistics"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        return await self.storage.aggregate_jitter_stats(start_time, device_id=device_id)

    async def get_retransmission_report(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None
    ) -> Dict:
        """Get retransmission statistics"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        return await self.storage.aggregate_retransmission_stats(start_time, device_id=device_id)

    async def get_connection_quality_summary(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None
    ) -> Dict:
        """Get overall connection quality summary"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        agg = await self.storage.aggregate_connection_quality(start_time, device_id=device_id)

        avg_rtt = agg["avg_rtt"]
        avg_jitter = agg["avg_jitter"]
        avg_retrans = agg["avg_retransmissions"]

        if agg["flows_with_metrics"] == 0:
            quality_score = 0
        else:
            # Calculate quality score (0-100)
            rtt_score = max(0, 30 - (avg_rtt / 100)) if avg_rtt > 0 else 20
            jitter_score = max(0, 20 - (avg_jitter / 10)) if avg_jitter > 0 else 15
            retrans_score = max(0, 30 - (avg_retrans * 3)) if avg_retrans > 0 else 25
            quality_score = min(100, rtt_score + jitter_score + retrans_score + 20)

        return {
            "total_flows": agg["total_flows"],
            "flows_with_metrics": agg["flows_with_metrics"],
            "quality_score": round(quality_score, 1),
            "avg_rtt": round(avg_rtt, 2),
            "avg_jitter": round(avg_jitter, 2),
            "avg_retransmissions": round(avg_retrans, 2),
            "avg_duration": round(agg["avg_duration"], 2),
            "avg_packet_size": round(agg["avg_packet_size"], 2),
            "avg_bandwidth_utilization": round(agg["avg_bandwidth_utilization"], 2),
            "protocol_efficiency": agg["protocol_efficiency"],
            "quality_distribution": agg["quality_distribution"]
        }



