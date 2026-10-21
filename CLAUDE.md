# CLAUDE.md — NetInsight (net-traffic)

**Read `AGENTS.md` first** — it holds the architecture, commands, schema gotcha and deploy
flow. `AGENT_INSTRUCTIONS.md` has longer coding-pattern examples (some file paths there
predate the `src/lib/api/` split). This file only adds Claude-specific notes.

React dashboard on Cloudflare Pages + FastAPI/Scapy backend on a Raspberry Pi 5. npm, not pnpm.

## Claude-specific notes

- Frontend done gate: `npm run validate && npm run test:run`. Backend: `cd backend && ruff check . && python -m pytest`.
- Schema changes touch both `services/storage/base.py` and `utils/migrations.py`.
- Pushing to `main` deploys the frontend — don't commit or push unless asked; never SSH to
  the Pi or restart its services unprompted.
- When a Cloudflare MCP connector is available, use it to inspect the Pages project rather
  than guessing from `wrangler.toml`.
