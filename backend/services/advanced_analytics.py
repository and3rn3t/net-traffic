"""
Advanced analytics service with additional statistics and aggregations
"""
import logging
from typing import List, Dict
from datetime import datetime, timedelta
from collections import defaultdict

from services.storage import StorageService

logger = logging.getLogger(__name__)


class AdvancedAnalyticsService:
    def __init__(self, storage: StorageService):
        self.storage = storage

    async def get_summary_stats(self) -> Dict:
        """Get overall summary statistics"""
        devices = await self.storage.get_devices()
        # Use reasonable limit for summary stats
        flows = await self.storage.get_flows(limit=50000)
        threats = await self.storage.get_threats(active_only=False)

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
        # Use database filtering and get all flows with countries
        flows = await self.storage.get_flows(
            limit=100000,
            start_time=start_time
        )
        
        # Filter to only flows with country info
        flows = [f for f in flows if f.country]

        country_stats = defaultdict(lambda: {
            "country": "",
            "connections": 0,
            "bytes": 0,
            "threats": 0
        })

        for flow in flows:
            country = flow.country or "Unknown"
            if country not in country_stats:
                country_stats[country] = {
                    "country": country,
                    "connections": 0,
                    "bytes": 0,
                    "threats": 0
                }

            country_stats[country]["connections"] += 1
            country_stats[country]["bytes"] += flow.bytesIn + flow.bytesOut

            if flow.threatLevel in ["medium", "high", "critical"]:
                country_stats[country]["threats"] += 1

        result = list(country_stats.values())
        result.sort(key=lambda x: x["connections"], reverse=True)
        return result

    async def get_top_domains(self, limit: int = 20, hours_back: int = 24) -> List[Dict]:
        """Get top domains by traffic"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        # Use database filtering
        flows = await self.storage.get_flows(
            limit=100000,
            start_time=start_time
        )
        
        # Filter to only flows with domain info
        flows = [f for f in flows if f.domain]

        domain_stats = defaultdict(lambda: {
            "domain": "",
            "connections": 0,
            "bytes": 0,
            "devices": set()
        })

        for flow in flows:
            domain = flow.domain or "Unknown"
            if domain not in domain_stats:
                domain_stats[domain] = {
                    "domain": domain,
                    "connections": 0,
                    "bytes": 0,
                    "devices": set()
                }

            domain_stats[domain]["connections"] += 1
            domain_stats[domain]["bytes"] += flow.bytesIn + flow.bytesOut
            domain_stats[domain]["devices"].add(flow.deviceId)

        result = []
        for domain, stats in domain_stats.items():
            result.append({
                "domain": domain,
                "connections": stats["connections"],
                "bytes": stats["bytes"],
                "unique_devices": len(stats["devices"])
            })

        result.sort(key=lambda x: x["bytes"], reverse=True)
        return result[:limit]

    async def get_top_devices(self, limit: int = 10, hours_back: int = 24, sort_by: str = "bytes") -> List[Dict]:
        """Get top devices by traffic"""
        start_time = int(
            (datetime.now() - timedelta(hours=hours_back)).timestamp() * 1000
        )
        devices = await self.storage.get_devices()
        # Use database filtering
        flows = await self.storage.get_flows(
            limit=100000,
            start_time=start_time
        )

        device_stats = defaultdict(lambda: {
            "device_id": "",
            "bytes": 0,
            "connections": 0,
            "threats": 0
        })

        for flow in flows:
            device_id = flow.deviceId
            if device_id not in device_stats:
                device_stats[device_id] = {
                    "device_id": device_id,
                    "bytes": 0,
                    "connections": 0,
                    "threats": 0
                }

            device_stats[device_id]["bytes"] += flow.bytesIn + flow.bytesOut
            device_stats[device_id]["connections"] += 1

            if flow.threatLevel in ["medium", "high", "critical"]:
                device_stats[device_id]["threats"] += 1

        # Enrich with device info
        result = []
        device_map = {d.id: d for d in devices}

        for device_id, stats in device_stats.items():
            device = device_map.get(device_id)
            result.append({
                "device_id": device_id,
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
        # Use database filtering
        flows = await self.storage.get_flows(
            limit=100000,
            start_time=start_time
        )

        interval_ms = interval_minutes * 60 * 1000

        timeline = defaultdict(lambda: {
            "timestamp": 0,
            "bytes_in": 0,
            "bytes_out": 0,
            "packets": 0,
            "connections": 0
        })

        for flow in flows:
            interval_timestamp = (flow.timestamp // interval_ms) * interval_ms

            if interval_timestamp not in timeline:
                timeline[interval_timestamp] = {
                    "timestamp": interval_timestamp,
                    "bytes_in": 0,
                    "bytes_out": 0,
                    "packets": 0,
                    "connections": 0
                }

            timeline[interval_timestamp]["bytes_in"] += flow.bytesIn
            timeline[interval_timestamp]["bytes_out"] += flow.bytesOut
            timeline[interval_timestamp]["packets"] += flow.packetsIn + flow.packetsOut
            timeline[interval_timestamp]["connections"] += 1

        result = list(timeline.values())
        result.sort(key=lambda x: x["timestamp"])
        return result

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
        # Use database filtering with both device_id and start_time
        flows = await self.storage.get_flows(
            limit=100000,
            device_id=device_id,
            start_time=start_time
        )

        protocols = defaultdict(lambda: {"bytes": 0, "connections": 0})
        domains = defaultdict(int)
        ports = defaultdict(int)

        total_bytes_in = 0
        total_bytes_out = 0
        threat_count = 0

        for flow in flows:
            protocols[flow.protocol]["bytes"] += flow.bytesIn + flow.bytesOut
            protocols[flow.protocol]["connections"] += 1

            if flow.domain:
                domains[flow.domain] += flow.bytesIn + flow.bytesOut

            ports[flow.destPort] += 1

            total_bytes_in += flow.bytesIn
            total_bytes_out += flow.bytesOut

            if flow.threatLevel in ["medium", "high", "critical"]:
                threat_count += 1

        return {
            "device": {
                "id": device.id,
                "name": device.name,
                "ip": device.ip,
                "type": device.type
            },
            "summary": {
                "total_bytes_in": total_bytes_in,
                "total_bytes_out": total_bytes_out,
                "total_bytes": total_bytes_in + total_bytes_out,
                "connections": len(flows),
                "threats": threat_count
            },
            "protocols": [
                {
                    "protocol": proto,
                    "bytes": data["bytes"],
                    "connections": data["connections"]
                }
                for proto, data in sorted(protocols.items(), key=lambda x: x[1]["bytes"], reverse=True)
            ],
            "top_domains": [
                {"domain": domain, "bytes": bytes}
                for domain, bytes in sorted(domains.items(), key=lambda x: x[1], reverse=True)[:10]
            ],
            "top_ports": [
                {"port": port, "connections": connections}
                for port, connections in sorted(ports.items(), key=lambda x: x[1], reverse=True)[:10]
            ]
        }

