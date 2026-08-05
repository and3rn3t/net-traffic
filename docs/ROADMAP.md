# NetInsight Roadmap

> **Last updated:** 2026-08-03 · Solo-maintained project — features ship one at a time, so this tracks **status and priority**, not calendar dates.

## At a Glance

| Tier                                          | Theme                                                                   | Items |
| --------------------------------------------- | ----------------------------------------------------------------------- | ----- |
| [Shipped](#shipped)                           | Foundation, auth, alerting, analytics, protocol decoding, observability | 7     |
| [High priority](#high-priority)               | Testing, onboarding, threat intel                                       | 3     |
| [Frontend refactor](#frontend-refactor)       | Data fetching, module splits, navigation                                | 6     |
| [Interactive features](#interactive-features) | Visualizations, playback, command palette                               | 8     |
| [Dashboard widgets](#dashboard-widgets)       | Composable widgets for the customizable dashboard                       | 8     |
| [Backend refactor](#backend-refactor)         | Module splits, schema consolidation, tests                              | 5     |
| [CI/CD pipeline](#cicd-pipeline)              | Dedupe workflows, caching, faster feedback, deploy hardening            | 13    |
| [Medium priority](#medium-priority)           | Protocol coverage, ML, config UI, compliance                            | 8     |
| [Exploratory](#exploratory)                   | Uncommitted ideas                                                       | —     |

---

## Shipped

| Feature                             | Summary                                                                                                                                                                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Foundation**                      | React/Vite/TS frontend ↔ FastAPI backend (Raspberry Pi 5) via REST + WebSocket. Real-time flow/device/threat updates, device management, search, CSV/JSON export, saved filter presets, mock-data fallback.                                                                       |
| **Auth**                            | Minimal JWT auth (`AuthContext`, login dialog, account menu) guarding device edits and filter presets; localStorage-only fallback when signed out. Default `admin` auto-created on first boot.                                                                                    |
| **Alert rules**                     | Threshold-based rules with severity, cooldown, triggered-alerts history; webhook delivery (Slack/Discord/generic HTTP POST).                                                                                                                                                      |
| **Baseline / predictive analytics** | Per-device EMA baseline (mean + stddev) for bytes/connections/RTT/jitter/retransmissions, learned hourly from SQL aggregates. Anomalies (z-score > 3, spikes only) surface as `Threat` records; `AnomalyDetection.tsx` prefers the learned baseline once a device has ≥3 samples. |
| **Deep protocol decoding**          | HTTP Host + status code, DNS query name + A/AAAA/CNAME answers, real TLS version detection via the `supported_versions` ClientHello extension.                                                                                                                                    |
| **Observability pass**              | Slow/large-query logging, global exception handler + `X-Request-ID` propagation, periodic health heartbeat, task exception logging, SQL aggregates replacing unbounded queries — see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md#known-incidents-context-for-future-debugging).     |
| **Capture architecture**            | Remote SSH packet capture (`capture_mode=remote_ssh`) as the primary method after UDM Pro port mirroring proved unworkable — see [NETWORK_TOPOLOGY_AND_PLACEMENT.md](./NETWORK_TOPOLOGY_AND_PLACEMENT.md).                                                                        |

---

## Backlog

### High priority

- [ ] **Cross-browser / performance testing** — unit + E2E infra exists ([TESTING_STRATEGY.md](./TESTING_STRATEGY.md)); load/stress testing and explicit cross-browser coverage don't.
- [ ] **Setup wizard for first-time users** — currently requires hand-editing `.env` / following [DEPLOYMENT_RASPBERRY_PI.md](./DEPLOYMENT_RASPBERRY_PI.md).
- [ ] **Threat intelligence feed integration** — no external IP/domain reputation lookups yet ([NETWORK_TRAFFIC_ANALYSIS.md](./NETWORK_TRAFFIC_ANALYSIS.md#genuine-remaining-gaps)).

### Frontend refactor

- [x] **Standardize data fetching on TanStack Query** — `useApiData.ts` rewritten internally to use `useQuery` (6 queries: health + devices/flows/threats/analytics/protocolStats) instead of hand-rolled fetch/poll/retry state, matching the pattern already used by `SearchBar.tsx`/`useFlowFilters.ts`. Public API/return shape unchanged, so `useDataSource.ts` (→ App.tsx), `AnomalyDetection.tsx`, and `MaintenancePanel.tsx` needed no changes.
- [x] **Split `src/lib/api.ts`** (~920 lines) — now `src/lib/api/`: `httpClient.ts` (fetch-with-retry + auth token + `ApiError`), `wsClient.ts` (WebSocket connect/reconnect/pub-sub), and 10 per-domain modules (`devices`, `flows`, `threats`, `analytics`, `capture`, `auth`, `filterPresets`, `alerts`, `baselines`, `search`, `maintenance`). `client.ts`'s `ApiClient` facade composes them all and exposes the exact same methods (`apiClient.getDevices()`, `apiClient.connectWebSocket()`, etc.), so none of the 26 files importing `apiClient` needed changes.
- [x] **WebSocket provider/context** — new `src/contexts/WebSocketContext.tsx` (`WebSocketProvider` + `useWebSocket`/`useWebSocketSubscription`), mounted once at the app root in `main.tsx`. `useAlerts.ts` now subscribes to `alert_triggered` declaratively instead of importing `apiClient` and calling `.on()` directly, fixing an implicit fragility where that subscription only worked because `useApiData` happened to already have opened the shared WS connection elsewhere in the tree.
- [x] **Consolidate duplicate table components** — `ConnectionsTableEnhanced`/`ConnectionsTableVirtualized` merged into a single `ConnectionsTable.tsx`, fixing a real bug where the virtualized path rendered a duplicate "Network Connections" header (each component rendered its own `Card` + header). The other 5 `*Enhanced` components (`DataExporter`, `DevicesList`, `GeographicDistribution`, `TopSites`, `TopUsers`) had no non-Enhanced counterpart to merge with, so the `-Enhanced` suffix was simply dropped repo-wide.
- [x] **URL-synced navigation** — new `useUrlTab` hook syncs the active tab with the `?tab=` URL search param (no router dependency needed for a single flat tab set); `App.tsx`'s `Tabs` is now controlled. Views are deep-linkable and survive refresh/back/forward.
- [x] **Make `tsc -b` green** — re-verified 2026-08-03: `npx tsc -b --force` and `npm run build` both pass with exit 0 on current main. The previously-noted failures (`NetworkGraph.tsx` `SimNode` x/y, `useApiData` `maxRetries`) are stale — already fixed as a side effect of unrelated commits.

### Interactive features

- [ ] **Interactive network topology map** — force-directed graph of devices and their conversations; click a node to drill into its flows. Data already exists (devices + flows + fingerprinting).
- [ ] **Live world map with animated connection arcs** — geolocation already resolves external IPs; render active flows as arcs instead of a static list.
- [ ] **Traffic Sankey diagram** — device → protocol → destination, for "where is my bandwidth going" at a glance.
- [ ] **Timeline scrubbing / playback** — slider to replay historical traffic windows; flow data and hourly aggregates are already persisted.
- [ ] **Per-device drill-down view** — sparklines of a device's metrics plotted against its learned baseline (baselines shipped; only anomaly detection consumes them today).
- [x] **Command palette (Cmd+K)** — new `CommandPalette.tsx` (built on the existing `ui/command.tsx`/cmdk primitive) lets you jump to any tab or device and run quick actions (toggle capture, switch theme) from one fuzzy-searchable list. Repurposed the `⌘K` shortcut that `SearchBar.tsx` previously used to just focus its input — that focus behavior is superseded by the palette's own search/filter box, so the old handler was removed to avoid both firing at once.
- [x] **Customizable dashboard** — drag-and-drop widget layout with per-user persisted arrangement; the widget catalog below plugs into this. New `src/components/dashboard/` (`widgetRegistry.ts` for widget metadata, `DashboardGrid.tsx` on `react-grid-layout` v2, `WidgetShell.tsx` for the Card chrome, `AddWidgetDialog.tsx`, `DashboardTab.tsx` composing it all). `useDashboardLayout.ts` persists the widget set + grid positions to `localStorage` (`netinsight_dashboard_layout`, versioned schema). Existing dashboard content (metrics, traffic chart, connections table) became the 3 default widgets — default view is visually unchanged; an "Edit dashboard" toggle reveals drag handles, remove buttons, and an "Add widget" catalog.
- [ ] **Live activity ticker** — compact real-time feed of notable events (new device, threat, anomaly, alert trigger) fed by existing WS message types.

### Dashboard widgets

Composable widgets for the customizable dashboard (each also viable standalone):

- [ ] **Network health score** — single 0–100 gauge blending threat count, anomaly rate, retransmission rate, and latency vs. baseline.
- [ ] **Live throughput gauge** — speedometer-style up/down bandwidth with peak-hold markers.
- [ ] **Top talkers leaderboard** — ranked device list with live rank-change indicators and per-device sparklines.
- [ ] **Device presence heatmap** — online/offline grid by device × hour ("who's home"), from existing device last-seen data.
- [ ] **DNS insights** — top queried domains, NXDOMAIN/failure rate, unusual TLD flags, from the shipped DNS decoding.
- [ ] **Latency quality calendar** — RTT/jitter heatmap by hour-of-day × day-of-week, from existing quality metrics.
- [ ] **This week vs. last week** — overlay comparison of traffic volume with delta callouts, from hourly aggregates.
- [ ] **Data budget tracker** — monthly usage against a configurable cap with end-of-month projection.

### Backend refactor

- [x] **Split `services/storage.py`** (~2100 lines) — replaced by a `services/storage/` package: `base.py` (connection/pool lifecycle, retry, schema, maintenance), one repository module per domain (`devices.py`, `flows.py`, `threats.py`, `filter_presets.py`, `alerts.py`, `baselines.py`), and `service.py` (thin `StorageService` facade delegating to each repo). Public API unchanged — no router/service call sites needed edits.
- [x] **Split `services/packet_capture.py`** (~1800 lines) — now a `services/packet_capture/` package: `protocol_decoders.py` holds the stateless per-packet TCP/TLS/HTTP/DNS extraction functions (moved out of the class since they only read the packet argument), `service.py` keeps `PacketCaptureService` (capture-session/SSH management, queueing, RTT/jitter/retransmission tracking, flow finalization). Public API unchanged.
- [x] **Single source of truth for schema** — `users`/`api_keys` (previously created by `auth_service.py`'s own separate connection) moved into `services/storage/base.py`'s `_create_tables()`, since `state.storage.initialize()` always runs before `AuthService` connects. Down to two places: `_create_tables()` (fresh DBs) and `utils/migrations.py` (upgrades) — see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).
- [x] **Backend pytest infrastructure** — `backend/tests/` (pytest + pytest-asyncio + httpx, `requirements-dev.txt`, `pyproject.toml` config with a 30s per-test timeout). `conftest.py` provides a temp-sqlite `storage` fixture and an `api_client` fixture that runs the real app lifespan via `TestClient`. Seed coverage: migrations (fresh DB → `CURRENT_SCHEMA_VERSION`, multi-statement `up` SQL), storage CRUD + SQL aggregates + threat dedup, auth login/401, and router smoke tests. Wired into the `backend-checks` CI job (see [CI/CD pipeline](#cicd-pipeline)). Building this surfaced and fixed a real bug: `StorageService.close()` used `if pool: ... elif self.db: ...`, so a stray non-pooled connection opened by several write methods' `_ensure_connection()` fallback (even in pool mode) was never closed — its aiosqlite writer thread hung process exit indefinitely. Also fixed the default-admin bootstrap password (`secrets.token_urlsafe(12)` had no guarantee of upper+lower+digit, occasionally failing its own strength validator on first boot) to be guaranteed-valid by construction. Prerequisite for the splits below — not yet started.
- [x] **Consolidate analytics services** — `analytics.py`, `advanced_analytics.py`, `application_analytics.py`, `network_quality_analytics.py` merged into a single `AnalyticsService` class in `analytics.py` (shared `_start_time_ms()` helper replaces ~15 duplicated `datetime.now() - timedelta(...)` computations). `service_manager.py` constructs one instance; `state.analytics`/`state.advanced_analytics`/`state.network_quality_analytics`/`state.application_analytics` all alias it, so no router call sites changed.

### CI/CD pipeline

- [x] **Deduplicate `ci-cd.yml` and `tests.yml`** — `tests.yml` deleted (no branch-protection required checks referenced it); `ci-cd.yml` is now the single push/PR pipeline, `nightly-tests.yml` keeps the cron.
- [x] **Add `concurrency` groups with `cancel-in-progress`** — added to `ci-cd.yml`, `codeql.yml`, `actionlint.yml`, `consistency.yml`, `gitleaks.yml`, `dependency-review.yml`, `release-drafter.yml` (skipped `nightly-tests.yml`/`lighthouse.yml`, cron-only or manual-dispatch-only).
- [x] **Path filters** — `paths-ignore: ['docs/**', '**/*.md']` added to `ci-cd.yml`. Full frontend/backend mutual exclusion would need per-job path filtering (`dorny/paths-filter`) since a single workflow's `paths-ignore` applies to every job in it — left as a future refinement, not done here.
- [x] **Cache Playwright browsers** — `actions/cache` on `~/.cache/ms-playwright` keyed on the installed `@playwright/test` version from `package-lock.json`.
- [x] **Stop masking failures with `continue-on-error`** — removed from E2E (verified 47/47 passing locally, `retries: 2` already set in CI). Integration tests (`npm run test:integration`) are NOT unmasked: verified via `git stash` on unmodified main that 16/71 tests fail consistently (not flaky), a real pre-existing gap much bigger than assumed — tracked as a new item below instead of silently masking it forever.
- [x] **Replace deploy curl scripting with `cloudflare/wrangler-action`** — one-time project/custom-domain setup moved to [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md); the deploy job now just calls `wrangler-action@v3`.
- [x] **Build once, deploy the artifact** — `unit-tests` builds and uploads `dist/`; `deploy` downloads it instead of re-running `npm ci` + build.
- [x] **Backend CI job** — `backend-checks` job runs `ruff check` (minimal `E9,F` gate via `backend/pyproject.toml` — the full default rule set surfaced ~788 findings, opt into more incrementally) + `python -m compileall` + `pytest` (see [Backend refactor](#backend-refactor) for the test infra). Fixed the 22 real ruff findings this surfaced, including a genuine bug: dead/unreachable duplicate decorator code in `utils/error_handler.py` referencing an undefined `func`. Line endings now come from `.gitattributes` (already existed) — removed the redundant `sed` step from `ci-cd.yml`/`nightly-tests.yml`.
- [ ] **Fix the integration test suite** — 16/71 tests fail consistently on unmodified main (`useApiData.integration.test.tsx` almost entirely, plus `api.integration.test.tsx`'s "API Enabled Mode"/"Error Scenarios" blocks); currently masked by `continue-on-error` rather than fixed. Needed before that step can be unmasked.
- [x] **Job-level `timeout-minutes`** — added to every job in `ci-cd.yml`/`nightly-tests.yml` (only `labeler.yml` had one before); bounds runner cost if a job hangs, e.g. the `webServer` startup flake already documented in [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md#known-incidents-context-for-future-debugging)-adjacent repo notes.
- [x] **Least-privilege `permissions:`** — explicit top-level `permissions: contents: read` on `ci-cd.yml`/`nightly-tests.yml`; `deploy` keeps its own narrower override.
- [x] **`CI Success` aggregate check + branch protection** — new `ci-success` job in `ci-cd.yml` (treats `e2e-tests`' PR-only `skipped` as fine, fails on real failure/cancellation); set as the sole required status check on `main` via the GitHub API (previously none existed).
- [x] **Re-enable Renovate** — `renovate.json` restored to the shared `and3rn3t/.github` preset, reverting the 2026-07-17 "disable on inactive repo" decision now that the repo is under active development again.

### Medium priority

- [ ] **Remaining deep protocol coverage** — DHCP, SMTP/POP3/IMAP, FTP/TFTP (HTTP/DNS/TLS already shipped).
- [ ] **True ML-based anomaly detection** — current baseline is EMA/z-score, not a trained model; behavioral profiling and auto-classification still open.
- [ ] **Configuration UI in Settings** — network interface, retention, rate limits, instead of editing `.env` by hand.
- [ ] **Weekly digest report** — scheduled summary (top devices, new devices, threats, usage trend) delivered via the existing webhook infrastructure.
- [ ] **Interactive API reference** — curated examples per endpoint, beyond FastAPI's built-in `/docs`.
- [ ] **Compliance/PII features** — credential/PII detection in traffic, exfiltration compliance reporting (GDPR/CCPA-style).
- [ ] **Role refinement** — roles are basic (`admin`/`viewer`); no 2FA, SSO, or fine-grained permissions.
- [ ] **Distributed/multi-sensor capture** — single Pi/single network today; no multi-site aggregation.

### Exploratory

Uncommitted ideas — revisit if a real need comes up:

- PostgreSQL or time-series DB migration
- Packet sampling tuning for very high-traffic links (basic `sampling_rate` exists in `packet_capture.py`)
- SIEM / Grafana / Prometheus integrations
- Mobile-optimized views
- Plugin architecture
- Ambient status indicators (favicon badge / document title reflecting active threat count)

---

## Editing This Doc

- Update **Shipped** in the same commit as the feature that ships it; check the item's box (or move it) in the same commit too.
- Prefer priority tiers over calendar estimates — week-based estimates in this doc's history all silently went stale.
- Before assuming something is/isn't done, check the actual code/routers and recent git log — previous drafts of this roadmap were wrong about what had shipped.
