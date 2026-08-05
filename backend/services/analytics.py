"""
Analytics service: aggregated traffic, device, application, and network
quality statistics. Consolidated from 4 previously-separate service classes
(analytics.py, advanced_analytics.py, application_analytics.py,
network_quality_analytics.py) that all shared the same
`storage: StorageService` dependency and the same "compute a start_time from
hours_back, then delegate to a storage.aggregate_*() SQL method" pattern.
"""
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from collections import defaultdict

from models.types import AnalyticsData, ProtocolStats
from services.storage import StorageService

logger = logging.getLogger(__name__)

# TLDs common enough that flagging them as "unusual" would just be noise.
COMMON_TLDS = {
    "com", "net", "org", "io", "co", "gov", "edu", "us", "uk",
    "local", "lan", "home", "arpa", "internal",
}


def _extract_tld(domain: str) -> str:
    """Return the lowercase last label of a domain name (its TLD)."""
    parts = domain.rstrip(".").split(".")
    return parts[-1].lower() if parts and parts[-1] else ""


class AnalyticsService:
    def __init__(self, storage: StorageService):
        self.storage = storage

    @staticmethod
    def _start_time_ms(hours_back: int) -> int:
        """Epoch-ms timestamp `hours_back` hours before now - the common
        starting point for every hours_back-windowed query below."""
        return int((datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000)

    # -- Traffic/protocol analytics (formerly analytics.py) --

    async def get_analytics_data(self, hours_back: int = 24) -> List[AnalyticsData]:
        """Get aggregated analytics data for time range"""
        start_time = self._start_time_ms(hours_back)

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
        start_time = self._start_time_ms(hours_back) if hours_back else None

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

    # -- Summary/geographic/device analytics (formerly advanced_analytics.py) --

    async def get_summary_stats(self) -> Dict:
        """Get overall summary statistics"""
        devices = await self.storage.get_devices()
        # Use reasonable limit for summary stats (Pi optimization)
        flows = await self.storage.get_flows(limit=25000)  # Reduced for Pi (was 50000)
        threat_stats = await self.storage.aggregate_threat_stats()

        total_bytes = sum(f.bytesIn + f.bytesOut for f in flows)
        active_flows = [f for f in flows if f.status == "active"]

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
            "total_threats": threat_stats["total"],
            "active_threats": threat_stats["active"],
            "critical_threats": threat_stats["critical_active"],
            "oldest_flow_timestamp": oldest_flow,
            "newest_flow_timestamp": newest_flow,
            "capture_duration_hours": (newest_flow - oldest_flow) / (1000 * 60 * 60) if newest_flow > oldest_flow else 0
        }

    async def get_geographic_distribution(self, hours_back: int = 24) -> List[Dict]:
        """Get geographic distribution of connections"""
        start_time = self._start_time_ms(hours_back)
        return await self.storage.aggregate_geographic(start_time)

    async def get_top_domains(self, limit: int = 20, hours_back: int = 24) -> List[Dict]:
        """Get top domains by traffic"""
        start_time = self._start_time_ms(hours_back)
        return await self.storage.aggregate_top_domains(start_time, limit)

    async def get_dns_stats(self, limit: int = 20, hours_back: int = 24) -> Dict:
        """Get DNS query volume, response-code breakdown, top queried domains
        (with failure counts), and unusual (uncommon) TLDs among them."""
        start_time = self._start_time_ms(hours_back)
        stats = await self.storage.aggregate_dns_stats(start_time, limit)

        total_queries = stats["total_queries"]
        failure_count = stats["failure_count"]
        failure_rate = (failure_count / total_queries * 100) if total_queries else 0.0

        tld_counts: Dict[str, int] = defaultdict(int)
        for entry in stats["top_domains"]:
            tld = _extract_tld(entry["domain"])
            if tld and tld not in COMMON_TLDS:
                tld_counts[tld] += entry["query_count"]

        unusual_tlds = sorted(
            ({"tld": tld, "count": count} for tld, count in tld_counts.items()),
            key=lambda item: item["count"],
            reverse=True,
        )[:10]

        return {
            "total_queries": total_queries,
            "failure_count": failure_count,
            "failure_rate": round(failure_rate, 2),
            "response_codes": stats["response_codes"],
            "top_domains": stats["top_domains"],
            "unusual_tlds": unusual_tlds,
        }

    async def get_top_devices(self, limit: int = 10, hours_back: int = 24, sort_by: str = "bytes") -> List[Dict]:
        """Get top devices by traffic"""
        start_time = self._start_time_ms(hours_back)
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
        start_time = self._start_time_ms(hours_back)
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

        start_time = self._start_time_ms(hours_back)
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

    # -- Network quality analytics (formerly network_quality_analytics.py) --

    async def get_rtt_trends(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None,
        country: Optional[str] = None,
        interval_minutes: int = 15
    ) -> List[Dict]:
        """Get RTT trends over time"""
        start_time = self._start_time_ms(hours_back)
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
        start_time = self._start_time_ms(hours_back)
        return await self.storage.aggregate_jitter_stats(start_time, device_id=device_id)

    async def get_retransmission_report(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None
    ) -> Dict:
        """Get retransmission statistics"""
        start_time = self._start_time_ms(hours_back)
        return await self.storage.aggregate_retransmission_stats(start_time, device_id=device_id)

    async def get_connection_quality_summary(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None
    ) -> Dict:
        """Get overall connection quality summary"""
        start_time = self._start_time_ms(hours_back)
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

    # -- Application usage analytics (formerly application_analytics.py) --

    async def get_application_breakdown(
        self,
        hours_back: int = 24,
        device_id: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict]:
        """Get top applications by traffic"""
        start_time = self._start_time_ms(hours_back)

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
        start_time = self._start_time_ms(hours_back)
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
        start_time = self._start_time_ms(hours_back)

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



