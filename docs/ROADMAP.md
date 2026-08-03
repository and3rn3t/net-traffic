# NetInsight - Roadmap

**Last updated:** 2026-08-03. Solo-maintained project — features are picked up and shipped one at a time rather than on a fixed schedule, so this tracks status/priority, not calendar dates.

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

### Frontend refactor (added 2026-08-03)
- **Standardize data fetching on TanStack Query** — it's installed and used in a couple of spots (`SearchBar`, `main.tsx` provider), but most views go through the homegrown `useApiData` hook (~324 lines of bespoke retry/poll/cache logic). Pick one; delete the other.
- **Split `src/lib/api.ts`** (~920 lines) — REST client, WebSocket management, and per-domain endpoint methods all live in one file. Break into `rest.ts` / `ws.ts` / per-domain endpoint modules.
- **Extract a WebSocket provider/context** — components currently share the `ApiClient` singleton's pub-sub (`wsListeners`); a React context would make subscriptions declarative and testable.
- **Consolidate duplicate table components** — `ConnectionsTableEnhanced` vs `ConnectionsTableVirtualized` overlap; merge and retire the `-Enhanced` naming convention repo-wide.
- **URL-synced navigation** — tabs are pure component state today, so views aren't deep-linkable or back-button friendly. Lightweight router or search-param sync.
- **Make `tsc -b` green** — the project-references build fails on a few pre-existing type errors even though `tsc --noEmit` is clean; fix so `npm run build` doesn't need workarounds.

### New interactive features (added 2026-08-03)
- **Interactive network topology map** — force-directed graph of devices and their conversations, click a node to drill into that device's flows. Data already exists (devices + flows + fingerprinting).
- **Live world map with animated connection arcs** — geolocation service already resolves external IPs; render active flows as arcs on a map instead of just the static geographic distribution list.
- **Traffic Sankey diagram** — device → protocol → destination flow visualization for "where is my bandwidth going" at a glance.
- **Timeline scrubbing / playback** — slider to replay historical traffic windows; flow data and hourly aggregates are already persisted.
- **Per-device drill-down view** — sparklines of a device's metrics plotted against its learned baseline (baselines shipped; no dedicated UI consumes them beyond anomaly detection).
- **Command palette (Cmd+K)** — global fuzzy jump to device/flow/view; `KeyboardShortcuts.tsx` already establishes the shortcut pattern.
- **Customizable dashboard** — drag-and-drop widget layout (promoted from the exploratory tier below).
- **Live activity ticker** — compact real-time feed of notable events (new device, threat, anomaly, alert-rule trigger) fed by the existing WS message types.

### Backend refactor (added 2026-08-03)
- **Split `services/storage.py`** (~2100 lines) — one class owns every table. Extract per-domain repositories (flows, devices, threats, baselines, alert rules) sharing the connection pool.
- **Split `services/packet_capture.py`** (~1800 lines) — separate the protocol decoders (HTTP/DNS/TLS parsing) from capture-session/SSH management into their own modules.
- **Single source of truth for schema** — tables are currently defined in three places (`storage._create_tables()`, `utils/migrations.py`, `auth_service._create_tables()`; see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)). Consolidate so adding a table is a one-place change.
- **Backend pytest infrastructure** — zero backend tests exist today; changes are verified by hand with `TestClient`. Add pytest + fixtures for storage/routers as a prerequisite for the splits above.
- **Consolidate the analytics services** — `analytics.py`, `advanced_analytics.py`, `application_analytics.py`, and `network_quality_analytics.py` overlap in aggregation logic; unify around the SQL-aggregate patterns from the observability pass.

### Medium priority
- **Remaining deep protocol coverage**: DHCP, SMTP/POP3/IMAP, FTP/TFTP analysis (HTTP/DNS/TLS already shipped).
- **True ML-based anomaly detection** — current baseline system is EMA/z-score, not a trained model; behavioral profiling and auto-classification are still open.
- **Configuration UI in Settings** (network interface, retention, rate limits) instead of editing `.env` by hand.
- **Interactive API reference** beyond FastAPI's built-in `/docs` Swagger UI (e.g. curated examples per endpoint).
- **Compliance/PII features** — credential/PII detection in traffic, data exfiltration compliance reporting (GDPR/CCPA-style).
- **Role refinement** — current roles are basic (`admin`/`viewer`); no 2FA, SSO, or fine-grained permissions yet.
- **Distributed/multi-sensor capture** — today assumes a single Pi/single network; no multi-site aggregation.

### Low priority / exploratory
PostgreSQL or time-series DB migration option, packet sampling tuning for very high-traffic links (basic `sampling_rate` support already exists in `packet_capture.py`), SIEM/Grafana/Prometheus integrations, mobile-optimized views, plugin architecture. None of these are committed — revisit if a real need comes up.

## Notes for future roadmap edits
- Update the "Shipped" section in the same commit as the feature that ships it.
- Prefer priority tiers over calendar/week estimates — this project doesn't have a fixed schedule, and previous week-based estimates in this doc's history all silently became stale.
- Before assuming something is/isn't done, check the actual code/routers and recent git log rather than trusting an older draft of this doc — several previous versions of this roadmap were wrong about what had shipped.
