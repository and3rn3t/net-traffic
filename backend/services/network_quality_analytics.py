"""
Network Quality Analytics Service
Provides analytics for RTT, jitter, retransmissions, and connection quality
"""
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from collections import defaultdict

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

        flows = await self.storage.get_flows(
            limit=100000,
            start_time=start_time,
            device_id=device_id,
            country=country
        )

        # Filter flows with RTT data
        flows_with_rtt = [f for f in flows if f.rtt is not None]

        if not flows_with_rtt:
            return []

        interval_ms = interval_minutes * 60 * 1000
        timeline = defaultdict(lambda: {
            "timestamp": 0,
            "avg_rtt": 0.0,
            "min_rtt": 0.0,
            "max_rtt": 0.0,
            "count": 0
        })

        for flow in flows_with_rtt:
            interval_timestamp = (flow.timestamp // interval_ms) * interval_ms

            if interval_timestamp not in timeline:
                timeline[interval_timestamp] = {
                    "timestamp": interval_timestamp,
                    "avg_rtt": 0.0,
                    "min_rtt": float('inf'),
                    "max_rtt": 0.0,
                    "count": 0,
                    "rtt_sum": 0.0
                }

            rtt = flow.rtt or 0
            timeline[interval_timestamp]["rtt_sum"] += rtt
            timeline[interval_timestamp]["count"] += 1
            timeline[interval_timestamp]["min_rtt"] = min(
                timeline[interval_timestamp]["min_rtt"], rtt
            )
            timeline[interval_timestamp]["max_rtt"] = max(
                timeline[interval_timestamp]["max_rtt"], rtt
            )

        # Calculate averages
        result = []
        for timestamp, data in timeline.items():
            avg_rtt = data["rtt_sum"] / data["count"] if data["count"] > 0 else 0
            result.append({
                "timestamp": timestamp,
                "avg_rtt": round(avg_rtt, 2),
                "min_rtt": round(data["min_rtt"], 2) if data["min_rtt"] != float('inf') else 0,
                "max_rtt": round(data["max_rtt"], 2),
                "count": data["count"]
            })

        result.sort(key=lambda x: x["timestamp"])
        return result

    async def get_jitter_analysis(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None
    ) -> Dict:
        """Get jitter analysis statistics"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )

        flows = await self.storage.get_flows(
            limit=100000,
            start_time=start_time,
            device_id=device_id
        )

        # Filter flows with jitter data
        flows_with_jitter = [f for f in flows if f.jitter is not None]

        if not flows_with_jitter:
            return {
                "avg_jitter": 0.0,
                "min_jitter": 0.0,
                "max_jitter": 0.0,
                "count": 0,
                "distribution": []
            }

        jitter_values = [f.jitter for f in flows_with_jitter if f.jitter is not None]

        avg_jitter = sum(jitter_values) / len(jitter_values)
        min_jitter = min(jitter_values)
        max_jitter = max(jitter_values)

        # Distribution buckets
        buckets = [0, 10, 20, 30, 50, 100, 200, float('inf')]
        distribution = defaultdict(int)

        for jitter in jitter_values:
            for i, threshold in enumerate(buckets[1:], 1):
                if jitter <= threshold:
                    bucket_label = f"{buckets[i-1]}-{threshold if threshold != float('inf') else '∞'}ms"
                    distribution[bucket_label] += 1
                    break

        return {
            "avg_jitter": round(avg_jitter, 2),
            "min_jitter": round(min_jitter, 2),
            "max_jitter": round(max_jitter, 2),
            "count": len(jitter_values),
            "distribution": [
                {"range": k, "count": v}
                for k, v in sorted(distribution.items())
            ]
        }

    async def get_retransmission_report(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None
    ) -> Dict:
        """Get retransmission statistics"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )

        flows = await self.storage.get_flows(
            limit=100000,
            start_time=start_time,
            device_id=device_id
        )

        total_flows = len(flows)
        flows_with_retrans = [f for f in flows if f.retransmissions and f.retransmissions > 0]

        total_retransmissions = sum(
            f.retransmissions for f in flows if f.retransmissions is not None
        )

        total_packets = sum(
            f.packetsIn + f.packetsOut for f in flows
        )

        retransmission_rate = (
            (total_retransmissions / total_packets * 100)
            if total_packets > 0 else 0
        )

        # By protocol
        by_protocol = defaultdict(lambda: {"count": 0, "retransmissions": 0, "packets": 0})
        for flow in flows:
            if flow.retransmissions is not None:
                by_protocol[flow.protocol]["count"] += 1
                by_protocol[flow.protocol]["retransmissions"] += flow.retransmissions
                by_protocol[flow.protocol]["packets"] += flow.packetsIn + flow.packetsOut

        protocol_stats = []
        for protocol, stats in by_protocol.items():
            rate = (stats["retransmissions"] / stats["packets"] * 100) if stats["packets"] > 0 else 0
            protocol_stats.append({
                "protocol": protocol,
                "flows": stats["count"],
                "retransmissions": stats["retransmissions"],
                "rate": round(rate, 2)
            })

        protocol_stats.sort(key=lambda x: x["rate"], reverse=True)

        return {
            "total_flows": total_flows,
            "flows_with_retransmissions": len(flows_with_retrans),
            "total_retransmissions": total_retransmissions,
            "total_packets": total_packets,
            "retransmission_rate": round(retransmission_rate, 2),
            "by_protocol": protocol_stats[:10]  # Top 10
        }

    async def get_connection_quality_summary(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None
    ) -> Dict:
        """Get overall connection quality summary"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )

        flows = await self.storage.get_flows(
            limit=100000,
            start_time=start_time,
            device_id=device_id
        )

        flows_with_metrics = [
            f for f in flows
            if f.rtt is not None or f.jitter is not None or f.retransmissions is not None
        ]

        if not flows_with_metrics:
            return {
                "total_flows": len(flows),
                "flows_with_metrics": 0,
                "quality_score": 0,
                "avg_rtt": 0.0,
                "avg_jitter": 0.0,
                "avg_retransmissions": 0.0,
                "quality_distribution": {
                    "excellent": 0,
                    "good": 0,
                    "fair": 0,
                    "poor": 0
                }
            }

        rtt_values = [f.rtt for f in flows_with_metrics if f.rtt is not None]
        jitter_values = [f.jitter for f in flows_with_metrics if f.jitter is not None]
        retrans_values = [f.retransmissions for f in flows_with_metrics if f.retransmissions is not None]

        avg_rtt = sum(rtt_values) / len(rtt_values) if rtt_values else 0
        avg_jitter = sum(jitter_values) / len(jitter_values) if jitter_values else 0
        avg_retrans = sum(retrans_values) / len(retrans_values) if retrans_values else 0

        # Calculate quality score (0-100)
        rtt_score = max(0, 30 - (avg_rtt / 100)) if avg_rtt > 0 else 20
        jitter_score = max(0, 20 - (avg_jitter / 10)) if avg_jitter > 0 else 15
        retrans_score = max(0, 30 - (avg_retrans * 3)) if avg_retrans > 0 else 25
        quality_score = min(100, rtt_score + jitter_score + retrans_score + 20)

        # Quality distribution
        quality_dist = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
        for flow in flows_with_metrics:
            rtt = flow.rtt or 0
            jitter = flow.jitter or 0
            retrans = flow.retransmissions or 0

            if rtt < 50 and jitter < 10 and retrans == 0:
                quality_dist["excellent"] += 1
            elif rtt < 100 and jitter < 30 and retrans < 3:
                quality_dist["good"] += 1
            elif rtt < 200 and jitter < 100 and retrans < 10:
                quality_dist["fair"] += 1
            else:
                quality_dist["poor"] += 1

        return {
            "total_flows": len(flows),
            "flows_with_metrics": len(flows_with_metrics),
            "quality_score": round(quality_score, 1),
            "avg_rtt": round(avg_rtt, 2),
            "avg_jitter": round(avg_jitter, 2),
            "avg_retransmissions": round(avg_retrans, 2),
            "quality_distribution": quality_dist
        }

