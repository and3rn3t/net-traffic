# Project Guidelines (AGENTS.md)

<!--
  Single source of truth for AI assistant instructions in this repo.
  CLAUDE.md is a thin pointer to this file — edit HERE.
  AGENT_INSTRUCTIONS.md is the older long-form guide (coding patterns, examples).
-->

## Project Overview

**NetInsight** is a home-network traffic analysis dashboard. A Raspberry Pi 5 captures
packets (Scapy), fingerprints devices, detects threats and stores flows in SQLite; a
React dashboard on Cloudflare Pages reads it over HTTPS + WebSocket.

```
Cloudflare Pages (React app, net-traffic.andernet.dev)
        │ HTTPS / WSS
        ▼
Raspberry Pi 5 (FastAPI backend, exposed via cloudflared tunnel)
  packet capture · device fingerprinting · threat detection · analytics · SQLite
```

Processing and the database stay on the Pi on purpose (raw NIC access, latency, privacy) —
see `docs/ARCHITECTURE.md` before proposing a move to D1/Workers.

## Stack

- **Frontend** (repo root): React 19 + TypeScript 5.7 + Vite 6, Tailwind CSS 4, Radix/shadcn
  UI (`src/components/ui/`), TanStack Query, Recharts. **npm** (`package-lock.json`),
  Node `24.13.0` (`.nvmrc`).
- **Backend** (`backend/`): Python, FastAPI, aiosqlite (WAL), Scapy, Pydantic.
- Tests: Vitest + Testing Library (unit), a separate Vitest integration config, Playwright
  (e2e); pytest for the backend.

## Layout

```
src/
  App.tsx, main.tsx
  components/           # dashboard views; ui/ = shadcn primitives
  hooks/                # useApiData (main data hook), useDataSource (real vs mock), useFlowFilters, …
  lib/api/              # typed API client: httpClient.ts, wsClient.ts, one module per resource
  lib/mockData.ts       # mock data used when VITE_USE_REAL_API !== 'true'
  contexts/             # AppContext, AuthContext, WebSocketContext
  test/                 # setup + integration tests
tests/e2e/              # Playwright specs
backend/
  main.py               # FastAPI app + lifespan (python main.py → uvicorn on HOST:PORT)
  routers/              # alerts, analytics, auth, capture, devices, flows, threats, websocket, …
  services/             # packet_capture/, storage/, device_fingerprinting, threat_detection, …
  models/, utils/       # Pydantic models; config, migrations, rate limiting, logging
  tests/                # pytest
scripts/                # Pi setup, systemd/cloudflared service setup, env checks, DB backup
docs/                   # ARCHITECTURE, DATABASE_SCHEMA, DEPLOYMENT_RASPBERRY_PI, ROADMAP, PRD, …
```

## Commands

```bash
npm install
npm run dev               # Vite on :5173 (mock data unless VITE_USE_REAL_API=true)
npm run validate          # type-check + lint + format:check
npm run test:run          # vitest unit tests (npm test = watch mode)
npm run test:integration  # vitest.integration.config.ts
npm run test:e2e          # Playwright
npm run build             # tsc -b && vite build → dist/
npm run format            # prettier on src/

cd backend
pip install -r requirements-dev.txt
ruff check .              # CI gate is E9 + F only (see backend/pyproject.toml)
python -m pytest          # asyncio_mode=auto, 30s per-test timeout
python main.py            # run the API locally (config from backend/.env)
```

CI (`ci-cd.yml`) runs backend ruff + compileall + pytest, then type-check, lint,
format:check, unit + integration tests and build; e2e runs on push only.

## Configuration

- Frontend (`.env`, see `.env.example`): `VITE_USE_REAL_API`, `VITE_API_BASE_URL`.
- Backend (`backend/.env`, see `backend/.env.example` and `docs/ENV_FILE_REQUIREMENTS.md`):
  `NETWORK_INTERFACE`, `PORT`, `DB_PATH`, `ALLOWED_ORIGINS`, `DATA_RETENTION_DAYS`, feature
  toggles for DNS tracking / DPI / fingerprinting.

## Database

Tables are defined in **two** places (`docs/DATABASE_SCHEMA.md`):
`backend/services/storage/base.py` `_create_tables()` for fresh databases, and
`backend/utils/migrations.py` `MIGRATIONS` for upgrading the Pi's live DB. A schema change
usually needs both, and `backend/tests/test_migrations.py` coverage.

## Deployment

- **Frontend:** CI deploys `dist/` to Cloudflare Pages project `net-traffic` on push to
  `main` after unit tests pass. Manual: `npm run deploy:cloudflare`.
- **Backend:** runs on the Pi as systemd unit `netinsight-backend.service`
  (`scripts/netinsight-backend.service`, `CAP_NET_RAW`/`CAP_NET_ADMIN` instead of root),
  behind a `cloudflared` tunnel. See `docs/DEPLOYMENT_RASPBERRY_PI.md` and
  `docs/CLOUDFLARE_TUNNEL_SETUP.md`.
- Never deploy, restart Pi services, commit or push unless explicitly asked.

## Conventions

- TypeScript strict, no `any`; functional components; reusable logic in hooks; `@/` alias.
- Backend: type hints, Pydantic request/response models, async I/O, `HTTPException` for API
  errors, `logging` not `print`.
- Conventional commits enforced by commitlint (`.husky/commit-msg`, header ≤ 100 chars).
- Traffic data is private: never log payloads, credentials or API keys.
