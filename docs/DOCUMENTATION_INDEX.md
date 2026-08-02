# NetInsight Documentation Index

Index of all documentation in this project. All 27 docs below are living reference material — there's no separate "historical/status" bucket anymore; superseded write-ups were removed and folded into these.

## Getting Started

- **[README.md](../README.md)** — Main project overview, quick start
- **[USER_GUIDE.md](./USER_GUIDE.md)** — Feature/usage guide for end users
- **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)** — Step-by-step setup checklist for new developers
- **[AGENT_INSTRUCTIONS.md](../AGENT_INSTRUCTIONS.md)** — Instructions for AI agents/developers working on this repo
- **[PRD.md](./PRD.md)** — Product requirements / experience goals

## Planning

- **[ROADMAP.md](./ROADMAP.md)** — What's shipped and what's next, by priority (not calendar dates)

## Architecture & Data

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Deployment topology, why the DB/processing stay on the Pi
- **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** — SQLite schema, migration history, the "tables in 3 places" gotcha
- **[NETWORK_TOPOLOGY_AND_PLACEMENT.md](./NETWORK_TOPOLOGY_AND_PLACEMENT.md)** — Where to place the Pi, capture methods, known UniFi UDM Pro port-mirroring issue
- **[NETWORK_TRAFFIC_ANALYSIS.md](./NETWORK_TRAFFIC_ANALYSIS.md)** — What's actually extracted from traffic today vs. genuine gaps
- **[SCAPY_PACKET_CAPTURE_EXPLAINED.md](./SCAPY_PACKET_CAPTURE_EXPLAINED.md)** — How Scapy-based capture works in this project

## Backend

- **[backend/README.md](../backend/README.md)** — Backend API docs, setup, hardening history
- **[API_ENHANCEMENTS.md](./API_ENHANCEMENTS.md)** — Stats/filtering/export endpoint reference + frontend usage
- **[ADVANCED_IDENTIFICATION_CONFIG.md](./ADVANCED_IDENTIFICATION_CONFIG.md)** — Device identification configuration

## Frontend

- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** — Wiring the frontend to the backend, enhanced analytics components/hook
- **[PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md)** — React Query caching, debouncing, lazy loading
- **[ANALYTICS_DASHBOARDS_GUIDE.md](./ANALYTICS_DASHBOARDS_GUIDE.md)** — Analytics dashboard features

## Testing

- **[TESTING_STRATEGY.md](./TESTING_STRATEGY.md)** — Unit/integration/E2E setup, CI workflows, coverage
- **[tests/e2e/README.md](../tests/e2e/README.md)** — Playwright E2E guide

## Deployment

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — General deployment overview
- **[DEPLOYMENT_RASPBERRY_PI.md](./DEPLOYMENT_RASPBERRY_PI.md)** — Backend on Raspberry Pi 5: pre-install, Docker/manual install, systemd, network config, performance tuning
- **[CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md)** — Frontend on Cloudflare Pages
- **[CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md)** — Exposing the backend via Cloudflare Tunnel (systemd + Docker variants, troubleshooting)
- **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** — Running everything in Docker, build optimizations
- **[REGISTRY_DEPLOYMENT_GUIDE.md](./REGISTRY_DEPLOYMENT_GUIDE.md)** — Pulling pre-built images from a container registry instead of building on-device
- **[WINDOWS_BUILD_GUIDE.md](./WINDOWS_BUILD_GUIDE.md)** — Building images from Windows

## Configuration

- **[ENV_FILE_REQUIREMENTS.md](./ENV_FILE_REQUIREMENTS.md)** — `.env` variables, when it's required vs. optional
- **[WORKSPACE_CONFIG.md](./WORKSPACE_CONFIG.md)** — Editor/workspace configuration
- **[SCRIPTS_REFERENCE.md](./SCRIPTS_REFERENCE.md)** — What's in `scripts/` and when to use each

## Troubleshooting

- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** — Cloudflare Pages deploy issues, backend systemd service issues
- **[CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md#troubleshooting)** — Tunnel-specific issues

## Quick paths

- **New developer**: [README.md](../README.md) → [AGENT_INSTRUCTIONS.md](../AGENT_INSTRUCTIONS.md) → [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) → [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
- **Deploying to a Pi**: [DEPLOYMENT_RASPBERRY_PI.md](./DEPLOYMENT_RASPBERRY_PI.md) → [CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md) → [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md)
- **Touching the database**: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) first, always
- **Planning work**: [ROADMAP.md](./ROADMAP.md)

## Maintenance

Update `ROADMAP.md`'s "Shipped" section in the same commit as the feature that ships it. When a doc's content is fully superseded by a code change, update it in place rather than leaving a stale copy — this repo has previously accumulated 90+ overlapping docs from not doing that; keep it from happening again.
