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
| [CI/CD pipeline](#cicd-pipeline)              | Dedupe workflows, caching, faster feedback, deploy hardening            | 9     |
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

- [ ] **Standardize data fetching on TanStack Query** — installed and used in a couple of spots (`SearchBar`, `main.tsx` provider), but most views go through the homegrown `useApiData` hook (~324 lines of bespoke retry/poll/cache logic). Pick one; delete the other.
- [ ] **Split `src/lib/api.ts`** (~920 lines) — REST client, WebSocket management, and per-domain endpoint methods all in one file. Break into `rest.ts` / `ws.ts` / per-domain modules.
- [ ] **WebSocket provider/context** — components share the `ApiClient` singleton's pub-sub (`wsListeners`); a React context makes subscriptions declarative and testable.
- [ ] **Consolidate duplicate table components** — `ConnectionsTableEnhanced` vs `ConnectionsTableVirtualized` overlap; merge and retire the `-Enhanced` naming convention repo-wide.
- [ ] **URL-synced navigation** — tabs are pure component state, so views aren't deep-linkable or back-button friendly. Lightweight router or search-param sync.
- [ ] **Make `tsc -b` green** — the project-references build fails on a few pre-existing type errors even though `tsc --noEmit` is clean.

### Interactive features

- [ ] **Interactive network topology map** — force-directed graph of devices and their conversations; click a node to drill into its flows. Data already exists (devices + flows + fingerprinting).
- [ ] **Live world map with animated connection arcs** — geolocation already resolves external IPs; render active flows as arcs instead of a static list.
- [ ] **Traffic Sankey diagram** — device → protocol → destination, for "where is my bandwidth going" at a glance.
- [ ] **Timeline scrubbing / playback** — slider to replay historical traffic windows; flow data and hourly aggregates are already persisted.
- [ ] **Per-device drill-down view** — sparklines of a device's metrics plotted against its learned baseline (baselines shipped; only anomaly detection consumes them today).
- [ ] **Command palette (Cmd+K)** — global fuzzy jump to device/flow/view; `KeyboardShortcuts.tsx` already establishes the shortcut pattern.
- [ ] **Customizable dashboard** — drag-and-drop widget layout with per-user persisted arrangement; the widget catalog below plugs into this.
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

- [ ] **Split `services/storage.py`** (~2100 lines) — extract per-domain repositories (flows, devices, threats, baselines, alert rules) sharing the connection pool.
- [ ] **Split `services/packet_capture.py`** (~1800 lines) — separate protocol decoders (HTTP/DNS/TLS) from capture-session/SSH management.
- [ ] **Single source of truth for schema** — tables are defined in three places (`storage._create_tables()`, `utils/migrations.py`, `auth_service._create_tables()`; see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)). Make adding a table a one-place change.
- [ ] **Backend pytest infrastructure** — zero backend tests today; changes are verified by hand with `TestClient`. Prerequisite for the splits above.
- [ ] **Consolidate analytics services** — `analytics.py`, `advanced_analytics.py`, `application_analytics.py`, `network_quality_analytics.py` overlap in aggregation logic; unify around the SQL-aggregate patterns from the observability pass.

### CI/CD pipeline

- [x] **Deduplicate `ci-cd.yml` and `tests.yml`** — `tests.yml` deleted (no branch-protection required checks referenced it); `ci-cd.yml` is now the single push/PR pipeline, `nightly-tests.yml` keeps the cron.
- [x] **Add `concurrency` groups with `cancel-in-progress`** — added to `ci-cd.yml`, `codeql.yml`, `actionlint.yml`, `consistency.yml`, `gitleaks.yml`, `dependency-review.yml`, `release-drafter.yml` (skipped `nightly-tests.yml`/`lighthouse.yml`, cron-only or manual-dispatch-only).
- [x] **Path filters** — `paths-ignore: ['docs/**', '**/*.md']` added to `ci-cd.yml`. Full frontend/backend mutual exclusion would need per-job path filtering (`dorny/paths-filter`) since a single workflow's `paths-ignore` applies to every job in it — left as a future refinement, not done here.
- [x] **Cache Playwright browsers** — `actions/cache` on `~/.cache/ms-playwright` keyed on the installed `@playwright/test` version from `package-lock.json`.
- [x] **Stop masking failures with `continue-on-error`** — removed from E2E (verified 47/47 passing locally, `retries: 2` already set in CI). Integration tests (`npm run test:integration`) are NOT unmasked: verified via `git stash` on unmodified main that 16/71 tests fail consistently (not flaky), a real pre-existing gap much bigger than assumed — tracked as a new item below instead of silently masking it forever.
- [x] **Replace deploy curl scripting with `cloudflare/wrangler-action`** — one-time project/custom-domain setup moved to [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md); the deploy job now just calls `wrangler-action@v3`.
- [x] **Build once, deploy the artifact** — `unit-tests` builds and uploads `dist/`; `deploy` downloads it instead of re-running `npm ci` + build.
- [x] **Backend CI job** — new `backend-checks` job runs `ruff check` (minimal `E9,F` gate via `backend/pyproject.toml` — the full default rule set surfaced ~788 findings, opt into more incrementally) + `python -m compileall`. Fixed the 22 real findings this surfaced, including a genuine bug: dead/unreachable duplicate decorator code in `utils/error_handler.py` referencing an undefined `func`. pytest lands with the backend test infra (see [Backend refactor](#backend-refactor)). Line endings now come from `.gitattributes` (already existed) — removed the redundant `sed` step from `ci-cd.yml`/`nightly-tests.yml`.
- [ ] **Fix the integration test suite** — 16/71 tests fail consistently on unmodified main (`useApiData.integration.test.tsx` almost entirely, plus `api.integration.test.tsx`'s "API Enabled Mode"/"Error Scenarios" blocks); currently masked by `continue-on-error` rather than fixed. Needed before that step can be unmasked.

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
