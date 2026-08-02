# NetInsight - Roadmap

**Last updated:** 2026-08-02. Solo-maintained project — features are picked up and shipped one at a time rather than on a fixed schedule, so this tracks status/priority, not calendar dates.

## Shipped

### Foundation
Frontend (React/Vite/TS) ↔ backend (FastAPI on a Raspberry Pi 5) integration via REST + WebSocket, real-time flow/device/threat updates, device management UI, search, CSV/JSON export, advanced flow filtering with saved presets, mock-data fallback when the backend is unreachable.

### Auth
Minimal JWT auth (`AuthContext`, login dialog, account menu), required for device edits and filter-preset endpoints; frontend falls back to localStorage-only behavior when signed out. Default `admin` account auto-created on first boot.

### Alert Rules
Configurable threshold-based alert rules with severity, cooldown, and a triggered-alerts history; webhook delivery (Slack/Discord/generic HTTP POST) for outbound notifications.

### Baseline / Predictive Analytics
Per-device EMA baseline (mean + stddev) for bytes/connections/RTT/jitter/retransmission rate, learned hourly from SQL-aggregated flow data. Anomalies (z-score > 3, spikes only) surface as `Threat` records automatically — no separate UI needed. `AnomalyDetection.tsx` prefers the learned baseline over the old static heuristic once a device has ≥3 samples.

### Deep Protocol Decoding
HTTP Host header + response status code, DNS query name + resolved A/AAAA/CNAME answers, and real TLS version detection (via the `supported_versions` ClientHello extension, since the legacy record version stays `0x0303` even for TLS 1.3).

### DB / dataflow observability pass
Slow/large-query logging on hot storage paths, global exception handler + `X-Request-ID` propagation, structured periodic health heartbeat log, fire-and-forget task exception logging, unbounded-materialization queries replaced with SQL aggregates (see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md#known-incidents-context-for-future-debugging) for the incidents that motivated this).

### Capture architecture
Remote SSH packet capture (`capture_mode=remote_ssh`) as the primary method, after confirming UniFi UDM Pro port mirroring doesn't work on this hardware — see [NETWORK_TOPOLOGY_AND_PLACEMENT.md](./NETWORK_TOPOLOGY_AND_PLACEMENT.md).

## Backlog

### High priority
- **Cross-browser / performance testing** — unit + E2E test infra exists ([TESTING_STRATEGY.md](./TESTING_STRATEGY.md)); load/stress testing and explicit cross-browser coverage don't.
- **Setup wizard for first-time users** — currently requires manually editing `.env` / following [DEPLOYMENT_RASPBERRY_PI.md](./DEPLOYMENT_RASPBERRY_PI.md).
- **Threat intelligence feed integration** — no external IP/domain reputation lookups yet (see [NETWORK_TRAFFIC_ANALYSIS.md](./NETWORK_TRAFFIC_ANALYSIS.md#genuine-remaining-gaps)).

### Medium priority
- **Remaining deep protocol coverage**: DHCP, SMTP/POP3/IMAP, FTP/TFTP analysis (HTTP/DNS/TLS already shipped).
- **True ML-based anomaly detection** — current baseline system is EMA/z-score, not a trained model; behavioral profiling and auto-classification are still open.
- **Configuration UI in Settings** (network interface, retention, rate limits) instead of editing `.env` by hand.
- **Interactive API reference** beyond FastAPI's built-in `/docs` Swagger UI (e.g. curated examples per endpoint).
- **Compliance/PII features** — credential/PII detection in traffic, data exfiltration compliance reporting (GDPR/CCPA-style).
- **Role refinement** — current roles are basic (`admin`/`viewer`); no 2FA, SSO, or fine-grained permissions yet.
- **Distributed/multi-sensor capture** — today assumes a single Pi/single network; no multi-site aggregation.

### Low priority / exploratory
PostgreSQL or time-series DB migration option, packet sampling tuning for very high-traffic links (basic `sampling_rate` support already exists in `packet_capture.py`), customizable/drag-and-drop dashboards, SIEM/Grafana/Prometheus integrations, mobile-optimized views, plugin architecture. None of these are committed — revisit if a real need comes up.

## Notes for future roadmap edits
- Update the "Shipped" section in the same commit as the feature that ships it.
- Prefer priority tiers over calendar/week estimates — this project doesn't have a fixed schedule, and previous week-based estimates in this doc's history all silently became stale.
- Before assuming something is/isn't done, check the actual code/routers and recent git log rather than trusting an older draft of this doc — several previous versions of this roadmap were wrong about what had shipped.
