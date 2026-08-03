"""Flow repository: CRUD, search, and analytics aggregates over the `flows` table."""
from typing import Dict, List, Optional

from models.types import NetworkFlow
from services.storage.base import Repository, log_slow_query


class FlowRepository(Repository):
    async def add_flow(self, flow: NetworkFlow):
        """Add network flow"""
        # Convert TCP flags list to comma-separated string
        tcp_flags_str = ",".join(flow.tcpFlags) if flow.tcpFlags else None

        await self.base._execute_with_retry("""
            INSERT OR REPLACE INTO flows
            (id, timestamp, source_ip, source_port, dest_ip, dest_port, protocol,
             bytes_in, bytes_out, packets_in, packets_out, duration, status,
             country, city, asn, domain, sni, threat_level, device_id,
             tcp_flags, ttl, connection_state, rtt, retransmissions, jitter,
             application, user_agent, http_method, url, dns_query_type, dns_response_code,
             http_host, http_status_code, dns_query_name, dns_answers, tls_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            flow.id, flow.timestamp, flow.sourceIp, flow.sourcePort, flow.destIp,
            flow.destPort, flow.protocol, flow.bytesIn, flow.bytesOut,
            flow.packetsIn, flow.packetsOut, flow.duration, flow.status,
            flow.country, flow.city, flow.asn, flow.domain, flow.sni, flow.threatLevel, flow.deviceId,
            tcp_flags_str, flow.ttl, flow.connectionState, flow.rtt, flow.retransmissions, flow.jitter,
            flow.application, flow.userAgent, flow.httpMethod, flow.url, flow.dnsQueryType, flow.dnsResponseCode,
            flow.httpHost, flow.httpStatusCode, flow.dnsQueryName,
            ",".join(flow.dnsAnswers) if flow.dnsAnswers else None, flow.tlsVersion
        ))
        await self.base._ensure_connection()
        await self.base.db.commit()

    async def add_flows_batch(self, flows: List[NetworkFlow]):
        """Insert multiple flows in a single transaction (Pi optimization: fewer commits/fsyncs)."""
        if not flows:
            return

        query = """
            INSERT OR REPLACE INTO flows
            (id, timestamp, source_ip, source_port, dest_ip, dest_port, protocol,
             bytes_in, bytes_out, packets_in, packets_out, duration, status,
             country, city, asn, domain, sni, threat_level, device_id,
             tcp_flags, ttl, connection_state, rtt, retransmissions, jitter,
             application, user_agent, http_method, url, dns_query_type, dns_response_code,
             http_host, http_status_code, dns_query_name, dns_answers, tls_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = [
            (
                flow.id, flow.timestamp, flow.sourceIp, flow.sourcePort, flow.destIp,
                flow.destPort, flow.protocol, flow.bytesIn, flow.bytesOut,
                flow.packetsIn, flow.packetsOut, flow.duration, flow.status,
                flow.country, flow.city, flow.asn, flow.domain, flow.sni, flow.threatLevel, flow.deviceId,
                ",".join(flow.tcpFlags) if flow.tcpFlags else None, flow.ttl, flow.connectionState,
                flow.rtt, flow.retransmissions, flow.jitter,
                flow.application, flow.userAgent, flow.httpMethod, flow.url,
                flow.dnsQueryType, flow.dnsResponseCode,
                flow.httpHost, flow.httpStatusCode, flow.dnsQueryName,
                ",".join(flow.dnsAnswers) if flow.dnsAnswers else None, flow.tlsVersion
            )
            for flow in flows
        ]

        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                await conn.executemany(query, params)
                await conn.commit()
        else:
            await self.base._ensure_connection()
            await self.base.db.executemany(query, params)
            await self.base.db.commit()

    @log_slow_query("get_flows")
    async def get_flows(self, limit: int = 100, device_id: Optional[str] = None,
                       status: Optional[str] = None, protocol: Optional[str] = None,
                       start_time: Optional[int] = None, end_time: Optional[int] = None,
                       source_ip: Optional[str] = None, dest_ip: Optional[str] = None,
                       threat_level: Optional[str] = None, min_bytes: Optional[int] = None,
                       offset: int = 0,
                       # New enhanced filters
                       country: Optional[str] = None,
                       city: Optional[str] = None,
                       application: Optional[str] = None,
                       min_rtt: Optional[int] = None,
                       max_rtt: Optional[int] = None,
                       max_jitter: Optional[float] = None,
                       max_retransmissions: Optional[int] = None,
                       sni: Optional[str] = None,
                       connection_state: Optional[str] = None) -> List[NetworkFlow]:
        """Get flows with advanced filters including enhanced data fields"""
        query = "SELECT * FROM flows WHERE 1=1"
        params = []

        if device_id:
            query += " AND device_id = ?"
            params.append(device_id)

        if status:
            query += " AND status = ?"
            params.append(status)

        if protocol:
            query += " AND protocol = ?"
            params.append(protocol)

        if start_time:
            query += " AND timestamp >= ?"
            params.append(start_time)

        if end_time:
            query += " AND timestamp <= ?"
            params.append(end_time)

        if source_ip:
            query += " AND source_ip = ?"
            params.append(source_ip)

        if dest_ip:
            query += " AND dest_ip = ?"
            params.append(dest_ip)

        if threat_level:
            query += " AND threat_level = ?"
            params.append(threat_level)

        if min_bytes:
            query += " AND (bytes_in + bytes_out) >= ?"
            params.append(min_bytes)

        # New enhanced filters
        if country:
            query += " AND country = ?"
            params.append(country)

        if city:
            query += " AND city LIKE ?"
            params.append(f"%{city}%")

        if application:
            query += " AND application = ?"
            params.append(application)

        if min_rtt is not None:
            query += " AND rtt >= ?"
            params.append(min_rtt)

        if max_rtt is not None:
            query += " AND rtt <= ?"
            params.append(max_rtt)

        if max_jitter is not None:
            query += " AND jitter <= ?"
            params.append(max_jitter)

        if max_retransmissions is not None:
            query += " AND retransmissions <= ?"
            params.append(max_retransmissions)

        if sni:
            query += " AND sni LIKE ?"
            params.append(f"%{sni}%")

        if connection_state:
            query += " AND connection_state = ?"
            params.append(connection_state)

        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_flow(row) for row in rows]
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_flow(row) for row in rows]

    @log_slow_query("aggregate_geographic")
    async def aggregate_geographic(self, start_time: int) -> List[dict]:
        """Aggregate connections by country in SQL (avoids loading flows)."""
        rows = await self.base._aggregate_fetchall(
            """
            SELECT country,
                   COUNT(*) AS connections,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes,
                   SUM(CASE WHEN threat_level IN ('medium','high','critical')
                            THEN 1 ELSE 0 END) AS threats
            FROM flows
            WHERE timestamp >= ? AND country IS NOT NULL AND country <> ''
            GROUP BY country
            ORDER BY connections DESC
            """,
            (start_time,),
        )
        return [
            {
                "country": r["country"],
                "connections": r["connections"],
                "bytes": r["bytes"],
                "threats": r["threats"],
            }
            for r in rows
        ]

    @log_slow_query("aggregate_top_domains")
    async def aggregate_top_domains(
        self, start_time: int, limit: int = 20
    ) -> List[dict]:
        """Aggregate top domains by traffic in SQL."""
        rows = await self.base._aggregate_fetchall(
            """
            SELECT domain,
                   COUNT(*) AS connections,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes,
                   COUNT(DISTINCT device_id) AS unique_devices
            FROM flows
            WHERE timestamp >= ? AND domain IS NOT NULL AND domain <> ''
            GROUP BY domain
            ORDER BY bytes DESC
            LIMIT ?
            """,
            (start_time, limit),
        )
        return [
            {
                "domain": r["domain"],
                "connections": r["connections"],
                "bytes": r["bytes"],
                "unique_devices": r["unique_devices"],
            }
            for r in rows
        ]

    @log_slow_query("aggregate_top_devices")
    async def aggregate_top_devices(self, start_time: int) -> List[dict]:
        """Aggregate per-device traffic in SQL. Enrichment done by caller."""
        rows = await self.base._aggregate_fetchall(
            """
            SELECT device_id,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes,
                   COUNT(*) AS connections,
                   SUM(CASE WHEN threat_level IN ('medium','high','critical')
                            THEN 1 ELSE 0 END) AS threats
            FROM flows
            WHERE timestamp >= ?
            GROUP BY device_id
            """,
            (start_time,),
        )
        return [
            {
                "device_id": r["device_id"],
                "bytes": r["bytes"],
                "connections": r["connections"],
                "threats": r["threats"],
            }
            for r in rows
        ]

    @log_slow_query("aggregate_bandwidth_timeline")
    async def aggregate_bandwidth_timeline(
        self, start_time: int, interval_ms: int
    ) -> List[dict]:
        """Aggregate bandwidth into fixed time buckets in SQL."""
        rows = await self.base._aggregate_fetchall(
            """
            SELECT (timestamp / ?) * ? AS bucket,
                   COALESCE(SUM(bytes_in), 0) AS bytes_in,
                   COALESCE(SUM(bytes_out), 0) AS bytes_out,
                   COALESCE(SUM(packets_in + packets_out), 0) AS packets,
                   COUNT(*) AS connections
            FROM flows
            WHERE timestamp >= ?
            GROUP BY bucket
            ORDER BY bucket ASC
            """,
            (interval_ms, interval_ms, start_time),
        )
        return [
            {
                "timestamp": r["bucket"],
                "bytes_in": r["bytes_in"],
                "bytes_out": r["bytes_out"],
                "packets": r["packets"],
                "connections": r["connections"],
            }
            for r in rows
        ]

    @log_slow_query("aggregate_device_analytics")
    async def aggregate_device_analytics(
        self, device_id: str, start_time: int
    ) -> dict:
        """Aggregate per-device breakdowns in SQL for a single device."""
        summary_rows = await self.base._aggregate_fetchall(
            """
            SELECT COALESCE(SUM(bytes_in), 0) AS bytes_in,
                   COALESCE(SUM(bytes_out), 0) AS bytes_out,
                   COUNT(*) AS connections,
                   SUM(CASE WHEN threat_level IN ('medium','high','critical')
                            THEN 1 ELSE 0 END) AS threats
            FROM flows
            WHERE device_id = ? AND timestamp >= ?
            """,
            (device_id, start_time),
        )
        protocol_rows = await self.base._aggregate_fetchall(
            """
            SELECT protocol,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes,
                   COUNT(*) AS connections
            FROM flows
            WHERE device_id = ? AND timestamp >= ?
            GROUP BY protocol
            ORDER BY bytes DESC
            """,
            (device_id, start_time),
        )
        domain_rows = await self.base._aggregate_fetchall(
            """
            SELECT domain, COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes
            FROM flows
            WHERE device_id = ? AND timestamp >= ?
                  AND domain IS NOT NULL AND domain <> ''
            GROUP BY domain
            ORDER BY bytes DESC
            LIMIT 10
            """,
            (device_id, start_time),
        )
        port_rows = await self.base._aggregate_fetchall(
            """
            SELECT dest_port AS port, COUNT(*) AS connections
            FROM flows
            WHERE device_id = ? AND timestamp >= ?
            GROUP BY dest_port
            ORDER BY connections DESC
            LIMIT 10
            """,
            (device_id, start_time),
        )
        s = summary_rows[0] if summary_rows else None
        return {
            "summary": {
                "total_bytes_in": s["bytes_in"] if s else 0,
                "total_bytes_out": s["bytes_out"] if s else 0,
                "connections": s["connections"] if s else 0,
                "threats": s["threats"] if s else 0,
            },
            "protocols": [
                {
                    "protocol": r["protocol"],
                    "bytes": r["bytes"],
                    "connections": r["connections"],
                }
                for r in protocol_rows
            ],
            "top_domains": [
                {"domain": r["domain"], "bytes": r["bytes"]} for r in domain_rows
            ],
            "top_ports": [
                {"port": r["port"], "connections": r["connections"]}
                for r in port_rows
            ],
        }

    @log_slow_query("aggregate_rtt_trends")
    async def aggregate_rtt_trends(
        self,
        start_time: int,
        interval_ms: int,
        device_id: Optional[str] = None,
        country: Optional[str] = None,
    ) -> List[dict]:
        """Aggregate RTT into fixed time buckets in SQL (avoids loading flows)."""
        query = """
            SELECT (timestamp / ?) * ? AS bucket,
                   AVG(rtt) AS avg_rtt,
                   MIN(rtt) AS min_rtt,
                   MAX(rtt) AS max_rtt,
                   COUNT(*) AS count
            FROM flows
            WHERE timestamp >= ? AND rtt IS NOT NULL
        """
        params: list = [interval_ms, interval_ms, start_time]
        if device_id:
            query += " AND device_id = ?"
            params.append(device_id)
        if country:
            query += " AND country = ?"
            params.append(country)
        query += " GROUP BY bucket ORDER BY bucket ASC"

        rows = await self.base._aggregate_fetchall(query, params)
        return [
            {
                "timestamp": r["bucket"],
                "avg_rtt": round(r["avg_rtt"], 2),
                "min_rtt": round(r["min_rtt"], 2),
                "max_rtt": round(r["max_rtt"], 2),
                "count": r["count"],
            }
            for r in rows
        ]

    @log_slow_query("aggregate_jitter_stats")
    async def aggregate_jitter_stats(
        self, start_time: int, device_id: Optional[str] = None
    ) -> dict:
        """Aggregate jitter summary + distribution buckets in SQL."""
        summary_query = """
            SELECT AVG(jitter) AS avg_jitter, MIN(jitter) AS min_jitter,
                   MAX(jitter) AS max_jitter, COUNT(*) AS count
            FROM flows
            WHERE timestamp >= ? AND jitter IS NOT NULL
        """
        bucket_query = """
            SELECT
                CASE
                    WHEN jitter <= 10 THEN '0-10ms'
                    WHEN jitter <= 20 THEN '10-20ms'
                    WHEN jitter <= 30 THEN '20-30ms'
                    WHEN jitter <= 50 THEN '30-50ms'
                    WHEN jitter <= 100 THEN '50-100ms'
                    WHEN jitter <= 200 THEN '100-200ms'
                    ELSE '200-∞ms'
                END AS bucket,
                COUNT(*) AS count
            FROM flows
            WHERE timestamp >= ? AND jitter IS NOT NULL
        """
        params: list = [start_time]
        if device_id:
            summary_query += " AND device_id = ?"
            bucket_query += " AND device_id = ?"
            params.append(device_id)
        bucket_query += " GROUP BY bucket"

        summary_rows = await self.base._aggregate_fetchall(summary_query, params)
        bucket_rows = await self.base._aggregate_fetchall(bucket_query, params)

        s = summary_rows[0] if summary_rows else None
        if not s or not s["count"]:
            return {
                "avg_jitter": 0.0, "min_jitter": 0.0, "max_jitter": 0.0,
                "count": 0, "distribution": [],
            }
        return {
            "avg_jitter": round(s["avg_jitter"], 2),
            "min_jitter": round(s["min_jitter"], 2),
            "max_jitter": round(s["max_jitter"], 2),
            "count": s["count"],
            "distribution": sorted(
                [{"range": r["bucket"], "count": r["count"]} for r in bucket_rows],
                key=lambda d: d["range"],
            ),
        }

    @log_slow_query("aggregate_retransmission_stats")
    async def aggregate_retransmission_stats(
        self, start_time: int, device_id: Optional[str] = None
    ) -> dict:
        """Aggregate retransmission totals + per-protocol breakdown in SQL."""
        overall_query = """
            SELECT
                COUNT(*) AS total_flows,
                COALESCE(SUM(CASE WHEN retransmissions IS NOT NULL AND retransmissions > 0
                         THEN 1 ELSE 0 END), 0) AS flows_with_retrans,
                COALESCE(SUM(retransmissions), 0) AS total_retransmissions,
                COALESCE(SUM(packets_in + packets_out), 0) AS total_packets
            FROM flows
            WHERE timestamp >= ?
        """
        protocol_query = """
            SELECT protocol,
                   COUNT(*) AS flows,
                   COALESCE(SUM(retransmissions), 0) AS retransmissions,
                   COALESCE(SUM(packets_in + packets_out), 0) AS packets
            FROM flows
            WHERE timestamp >= ? AND retransmissions IS NOT NULL
        """
        params: list = [start_time]
        if device_id:
            overall_query += " AND device_id = ?"
            protocol_query += " AND device_id = ?"
            params.append(device_id)
        protocol_query += " GROUP BY protocol"

        overall_rows = await self.base._aggregate_fetchall(overall_query, params)
        protocol_rows = await self.base._aggregate_fetchall(protocol_query, params)

        o = overall_rows[0] if overall_rows else None
        total_flows = o["total_flows"] if o else 0
        total_retransmissions = o["total_retransmissions"] if o else 0
        total_packets = o["total_packets"] if o else 0
        retransmission_rate = (
            (total_retransmissions / total_packets * 100) if total_packets > 0 else 0
        )

        protocol_stats = []
        for r in protocol_rows:
            rate = (r["retransmissions"] / r["packets"] * 100) if r["packets"] > 0 else 0
            protocol_stats.append({
                "protocol": r["protocol"],
                "flows": r["flows"],
                "retransmissions": r["retransmissions"],
                "rate": round(rate, 2),
            })
        protocol_stats.sort(key=lambda x: x["rate"], reverse=True)

        return {
            "total_flows": total_flows,
            "flows_with_retransmissions": o["flows_with_retrans"] if o else 0,
            "total_retransmissions": total_retransmissions,
            "total_packets": total_packets,
            "retransmission_rate": round(retransmission_rate, 2),
            "by_protocol": protocol_stats[:10],
        }

    @log_slow_query("aggregate_connection_quality")
    async def aggregate_connection_quality(
        self, start_time: int, device_id: Optional[str] = None
    ) -> dict:
        """Aggregate the full connection-quality summary in SQL (avoids loading
        up to 100k flows into Pydantic objects per call - this endpoint is
        polled every ~60s by the frontend)."""
        overall_query = """
            SELECT
                COUNT(*) AS total_flows,
                AVG(duration) AS avg_duration,
                AVG(CASE WHEN (packets_in + packets_out) > 0
                         THEN 1.0 * (bytes_in + bytes_out) / (packets_in + packets_out)
                         ELSE 0 END) AS avg_packet_size,
                AVG(CASE WHEN duration > 0
                         THEN 1.0 * (bytes_in + bytes_out) / (duration / 1000.0)
                         ELSE 0 END) AS avg_bandwidth_utilization
            FROM flows
            WHERE timestamp >= ?
        """
        metrics_query = """
            SELECT COUNT(*) AS flows_with_metrics,
                   AVG(rtt) AS avg_rtt, AVG(jitter) AS avg_jitter,
                   AVG(retransmissions) AS avg_retransmissions
            FROM flows
            WHERE timestamp >= ?
                  AND (rtt IS NOT NULL OR jitter IS NOT NULL OR retransmissions IS NOT NULL)
        """
        protocol_query = """
            SELECT protocol, COUNT(*) AS total,
                   SUM(CASE WHEN duration < 10000 AND (bytes_in + bytes_out) > 1000
                            THEN 1 ELSE 0 END) AS efficient
            FROM flows
            WHERE timestamp >= ?
        """
        distribution_query = """
            SELECT
                CASE
                    WHEN COALESCE(rtt, 0) < 50 AND COALESCE(jitter, 0) < 10
                         AND COALESCE(retransmissions, 0) = 0 THEN 'excellent'
                    WHEN COALESCE(rtt, 0) < 100 AND COALESCE(jitter, 0) < 30
                         AND COALESCE(retransmissions, 0) < 3 THEN 'good'
                    WHEN COALESCE(rtt, 0) < 200 AND COALESCE(jitter, 0) < 100
                         AND COALESCE(retransmissions, 0) < 10 THEN 'fair'
                    ELSE 'poor'
                END AS bucket,
                COUNT(*) AS count
            FROM flows
            WHERE timestamp >= ?
                  AND (rtt IS NOT NULL OR jitter IS NOT NULL OR retransmissions IS NOT NULL)
        """
        params: list = [start_time]
        if device_id:
            overall_query += " AND device_id = ?"
            metrics_query += " AND device_id = ?"
            protocol_query += " AND device_id = ?"
            distribution_query += " AND device_id = ?"
            params.append(device_id)
        protocol_query += " GROUP BY protocol"
        distribution_query += " GROUP BY bucket"

        overall_rows = await self.base._aggregate_fetchall(overall_query, params)
        metrics_rows = await self.base._aggregate_fetchall(metrics_query, params)
        protocol_rows = await self.base._aggregate_fetchall(protocol_query, params)
        distribution_rows = await self.base._aggregate_fetchall(distribution_query, params)

        o = overall_rows[0] if overall_rows else None
        m = metrics_rows[0] if metrics_rows else None
        quality_dist = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
        for r in distribution_rows:
            quality_dist[r["bucket"]] = r["count"]

        return {
            "total_flows": o["total_flows"] if o else 0,
            "avg_duration": (o["avg_duration"] or 0.0) if o else 0.0,
            "avg_packet_size": (o["avg_packet_size"] or 0.0) if o else 0.0,
            "avg_bandwidth_utilization": (o["avg_bandwidth_utilization"] or 0.0) if o else 0.0,
            "flows_with_metrics": m["flows_with_metrics"] if m else 0,
            "avg_rtt": (m["avg_rtt"] or 0.0) if m else 0.0,
            "avg_jitter": (m["avg_jitter"] or 0.0) if m else 0.0,
            "avg_retransmissions": (m["avg_retransmissions"] or 0.0) if m else 0.0,
            "protocol_efficiency": {
                r["protocol"]: {"total": r["total"], "efficient": r["efficient"]}
                for r in protocol_rows
            },
            "quality_distribution": quality_dist,
        }

    @log_slow_query("aggregate_analytics_hourly")
    async def aggregate_analytics_hourly(self, start_time: int) -> Dict[int, dict]:
        """Aggregate bytes/connections/active-devices/threat-flagged-flows into
        epoch-hour-aligned buckets in SQL (avoids loading flows; also matches the
        alignment used by aggregate_threat_counts_by_hour so the two can be merged)."""
        hour_ms = 60 * 60 * 1000
        rows = await self.base._aggregate_fetchall(
            """
            SELECT (timestamp / ?) * ? AS bucket,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS total_bytes,
                   COUNT(*) AS total_connections,
                   COUNT(DISTINCT device_id) AS active_devices,
                   SUM(CASE WHEN threat_level IN ('medium','high','critical')
                            THEN 1 ELSE 0 END) AS threat_count
            FROM flows
            WHERE timestamp >= ?
            GROUP BY bucket
            """,
            (hour_ms, hour_ms, start_time),
        )
        return {
            r["bucket"]: {
                "total_bytes": r["total_bytes"],
                "total_connections": r["total_connections"],
                "active_devices": r["active_devices"],
                "threat_count": r["threat_count"],
            }
            for r in rows
        }

    @log_slow_query("aggregate_protocol_stats")
    async def aggregate_protocol_stats(
        self, start_time: Optional[int] = None
    ) -> List[dict]:
        """Aggregate bytes/connections by protocol in SQL (avoids loading flows)."""
        query = """
            SELECT protocol,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes,
                   COUNT(*) AS connections
            FROM flows
            WHERE 1=1
        """
        params: list = []
        if start_time:
            query += " AND timestamp >= ?"
            params.append(start_time)
        query += " GROUP BY protocol ORDER BY bytes DESC"

        rows = await self.base._aggregate_fetchall(query, params)
        return [
            {"protocol": r["protocol"], "bytes": r["bytes"], "connections": r["connections"]}
            for r in rows
        ]

    @log_slow_query("aggregate_application_breakdown")
    async def aggregate_application_breakdown(
        self, start_time: int, device_id: Optional[str] = None
    ) -> List[dict]:
        """Aggregate per-application traffic stats in SQL (avoids loading flows)."""
        query = """
            SELECT application,
                   COUNT(*) AS connections,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes,
                   COALESCE(SUM(packets_in + packets_out), 0) AS packets,
                   COUNT(DISTINCT device_id) AS unique_devices,
                   AVG(rtt) AS avg_rtt
            FROM flows
            WHERE timestamp >= ? AND application IS NOT NULL AND application <> ''
        """
        params: list = [start_time]
        if device_id:
            query += " AND device_id = ?"
            params.append(device_id)
        query += " GROUP BY application ORDER BY bytes DESC"

        rows = await self.base._aggregate_fetchall(query, params)
        return [
            {
                "application": r["application"],
                "connections": r["connections"],
                "bytes": r["bytes"],
                "packets": r["packets"],
                "unique_devices": r["unique_devices"],
                "avg_rtt": r["avg_rtt"],
            }
            for r in rows
        ]

    @log_slow_query("aggregate_application_trends")
    async def aggregate_application_trends(
        self, start_time: int, interval_ms: int, application: Optional[str] = None
    ) -> List[dict]:
        """Aggregate per-application traffic into time buckets in SQL (avoids loading flows)."""
        query = """
            SELECT (timestamp / ?) * ? AS bucket,
                   application,
                   COUNT(*) AS connections,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes
            FROM flows
            WHERE timestamp >= ? AND application IS NOT NULL AND application <> ''
        """
        params: list = [interval_ms, interval_ms, start_time]
        if application:
            query += " AND application = ?"
            params.append(application)
        query += " GROUP BY bucket, application ORDER BY bucket ASC"

        rows = await self.base._aggregate_fetchall(query, params)
        return [
            {
                "bucket": r["bucket"],
                "application": r["application"],
                "connections": r["connections"],
                "bytes": r["bytes"],
            }
            for r in rows
        ]

    @log_slow_query("aggregate_device_application_profile")
    async def aggregate_device_application_profile(
        self, device_id: str, start_time: int
    ) -> List[dict]:
        """Aggregate a single device's per-application usage in SQL (avoids loading flows)."""
        rows = await self.base._aggregate_fetchall(
            """
            SELECT application,
                   COUNT(*) AS connections,
                   COALESCE(SUM(bytes_in + bytes_out), 0) AS bytes,
                   COALESCE(SUM(duration), 0) AS duration
            FROM flows
            WHERE device_id = ? AND timestamp >= ?
                  AND application IS NOT NULL AND application <> ''
            GROUP BY application
            """,
            (device_id, start_time),
        )
        return [
            {
                "application": r["application"],
                "connections": r["connections"],
                "bytes": r["bytes"],
                "duration": r["duration"],
            }
            for r in rows
        ]

    async def search_flows(self, query_text: str, limit: int = 50) -> List[NetworkFlow]:
        """Search flows by IP address or domain"""
        query = """
            SELECT * FROM flows
            WHERE source_ip LIKE ?
               OR dest_ip LIKE ?
               OR domain LIKE ?
            ORDER BY timestamp DESC
            LIMIT ?
        """
        search_pattern = f"%{query_text}%"
        params = [search_pattern, search_pattern, search_pattern, limit]

        async with self.base.db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [self._row_to_flow(row) for row in rows]

    async def get_flow(self, flow_id: str) -> Optional[NetworkFlow]:
        """Get flow by ID"""
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute("SELECT * FROM flows WHERE id = ?", (flow_id,)) as cursor:
                    row = await cursor.fetchone()
                    return self._row_to_flow(row) if row else None
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute("SELECT * FROM flows WHERE id = ?", (flow_id,)) as cursor:
                row = await cursor.fetchone()
                return self._row_to_flow(row) if row else None

    async def count_flows(self) -> int:
        """Count total flows"""
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute("SELECT COUNT(*) FROM flows") as cursor:
                    row = await cursor.fetchone()
                    return row[0] if row else 0
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute("SELECT COUNT(*) FROM flows") as cursor:
                row = await cursor.fetchone()
                return row[0] if row else 0

    async def get_total_bytes_since(self, since_ms: int) -> int:
        """Sum bytes_in + bytes_out across all flows with timestamp >= since_ms"""
        query = "SELECT COALESCE(SUM(bytes_in + bytes_out), 0) FROM flows WHERE timestamp >= ?"
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query, (since_ms,)) as cursor:
                    row = await cursor.fetchone()
                    return int(row[0]) if row else 0
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query, (since_ms,)) as cursor:
                row = await cursor.fetchone()
                return int(row[0]) if row else 0

    @log_slow_query("get_device_flow_aggregates")
    async def get_device_flow_aggregates(self, start_time: int, end_time: int) -> List[dict]:
        """Aggregate flow activity per device over [start_time, end_time) for baseline learning.

        Uses SQL-level aggregation (not per-flow Python loops) since this only
        runs periodically (hourly), not on the packet-capture hot path.
        """
        query = """
            SELECT
                device_id,
                SUM(bytes_in + bytes_out) AS bytes_total,
                COUNT(*) AS connections,
                AVG(rtt) AS avg_rtt,
                AVG(jitter) AS avg_jitter,
                SUM(COALESCE(retransmissions, 0)) AS total_retransmissions,
                SUM(packets_in + packets_out) AS total_packets
            FROM flows
            WHERE timestamp >= ? AND timestamp < ?
            GROUP BY device_id
        """
        params = (start_time, end_time)

        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
                    return [dict(row) for row in rows]
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    def _row_to_flow(self, row) -> NetworkFlow:
        """Convert database row to NetworkFlow model"""
        # Parse TCP flags from comma-separated string
        tcp_flags = None
        if row["tcp_flags"]:
            tcp_flags = [f.strip() for f in row["tcp_flags"].split(",") if f.strip()]

        return NetworkFlow(
            id=row["id"],
            timestamp=row["timestamp"],
            sourceIp=row["source_ip"],
            sourcePort=row["source_port"],
            destIp=row["dest_ip"],
            destPort=row["dest_port"],
            protocol=row["protocol"],
            bytesIn=row["bytes_in"],
            bytesOut=row["bytes_out"],
            packetsIn=row["packets_in"],
            packetsOut=row["packets_out"],
            duration=row["duration"],
            status=row["status"],
            country=row["country"],
            city=row["city"],
            asn=row["asn"],
            domain=row["domain"],
            sni=row["sni"],
            threatLevel=row["threat_level"],
            deviceId=row["device_id"],
            tcpFlags=tcp_flags,
            ttl=row["ttl"],
            connectionState=row["connection_state"],
            rtt=row["rtt"],
            retransmissions=row["retransmissions"],
            jitter=row["jitter"],
            application=row["application"],
            userAgent=row["user_agent"],
            httpMethod=row["http_method"],
            url=row["url"],
            dnsQueryType=row["dns_query_type"],
            dnsResponseCode=row["dns_response_code"],
            httpHost=row["http_host"],
            httpStatusCode=row["http_status_code"],
            dnsQueryName=row["dns_query_name"],
            dnsAnswers=(
                [a.strip() for a in row["dns_answers"].split(",") if a.strip()]
                if row["dns_answers"] else None
            ),
            tlsVersion=row["tls_version"]
        )
