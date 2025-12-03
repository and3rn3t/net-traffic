# Architecture Changes Summary

## Overview

The NetInsight project has been rearchitected to deploy the frontend to Cloudflare Pages while keeping **all backend components** (database, packet capture, processing) on Raspberry Pi 5. This simplifies deployment and improves performance while maintaining privacy, low latency, and zero additional costs.

**Status**: ✅ Final architecture confirmed - frontend on Cloudflare, everything else on Pi.

## Changes Made

### 1. Cloudflare Configuration Files

- **`wrangler.toml`**: Cloudflare Workers/Pages configuration
- **`cloudflare-worker.js`**: Optional API proxy worker (for CORS/security)
- **`public/_redirects`**: Already exists for SPA routing

### 2. Updated Files

- **`src/lib/api.ts`**: Fixed WebSocket URL handling for HTTPS/WSS
- **`docker-compose.yml`**: Frontend service now uses `profiles: local-dev` (disabled by default)
- **`package.json`**: Added `deploy:cloudflare` script and `wrangler` dev dependency

### 3. New Files

- **`docker-compose.backend-only.yml`**: Simplified compose file for backend-only deployment
- **`docs/CLOUDFLARE_DEPLOYMENT.md`**: Complete deployment guide
- **`docs/MIGRATION_TO_CLOUDFLARE.md`**: Migration guide from Docker
- **`README_CLOUDFLARE.md`**: Quick reference for Cloudflare deployment
- **`scripts/deploy-cloudflare.sh`**: Deployment script (Linux/Mac)
- **`scripts/deploy-cloudflare.ps1`**: Deployment script (Windows)

### 4. Documentation Updates

- **`README.md`**: Added architecture overview and Cloudflare deployment section

## Architecture Diagram

```
┌─────────────────────────────────┐
│   Cloudflare Pages (Frontend)   │
│   - React App (Static Assets)    │
│   - Served via CDN               │
│   - Global Edge Network          │
└──────────────┬──────────────────┘
               │ HTTPS/WSS
               │ API Calls + WebSocket
               ▼
┌─────────────────────────────────┐
│   Raspberry Pi 5 (Backend)      │
│   - FastAPI Service             │
│   - Packet Capture (Scapy)      │
│   - SQLite Database             │
│   - WebSocket Server            │
│   - All Data Processing          │
└─────────────────────────────────┘
```

**Note**: Database and all backend components stay on Raspberry Pi. See [docs/ARCHITECTURE_DECISION_DATABASE.md](docs/ARCHITECTURE_DECISION_DATABASE.md) for detailed analysis of why this is the optimal architecture.

## Key Benefits

1. **Simplified Deployment**: Frontend is static, no Docker needed
2. **Better Performance**: Cloudflare CDN provides global edge caching
3. **Reduced Load on Pi**: Frontend serving doesn't consume Pi resources
4. **Easier Updates**: Frontend updates via Git push, automatic deployment
5. **Better Security**: Backend stays on local network, frontend on Cloudflare

## Migration Path

### For New Deployments

1. Deploy backend to Raspberry Pi using `docker-compose.backend-only.yml`
2. Deploy frontend to Cloudflare Pages
3. Configure CORS in backend
4. Set environment variables in Cloudflare

### For Existing Deployments

1. Follow [MIGRATION_TO_CLOUDFLARE.md](docs/MIGRATION_TO_CLOUDFLARE.md)
2. Stop frontend Docker container
3. Deploy to Cloudflare Pages
4. Update backend CORS configuration

## Configuration Requirements

### Backend (Raspberry Pi)

- Update `ALLOWED_ORIGINS` to include Cloudflare Pages domain
- Ensure backend is accessible (Cloudflare Tunnel recommended)
- Keep existing Docker setup for backend

### Frontend (Cloudflare Pages)

- Set `VITE_API_BASE_URL` environment variable
- Set `VITE_USE_REAL_API=true`
- Build command: `npm run build`
- Output directory: `dist`

## WebSocket Support

WebSocket connections work directly from Cloudflare Pages to Raspberry Pi backend:

- HTTPS → WSS (secure WebSocket)
- HTTP → WS (non-secure WebSocket)
- Automatic URL conversion in `src/lib/api.ts`

## Local Development

Local development remains unchanged:

```bash
# Backend
docker-compose up backend

# Frontend
npm run dev
```

Or use Docker for frontend (local dev only):

```bash
docker-compose --profile local-dev up frontend
```

## Files to Review

- [CLOUDFLARE_DEPLOYMENT.md](docs/CLOUDFLARE_DEPLOYMENT.md) - Complete deployment guide
- [MIGRATION_TO_CLOUDFLARE.md](docs/MIGRATION_TO_CLOUDFLARE.md) - Migration steps
- [docker-compose.backend-only.yml](docker-compose.backend-only.yml) - Backend-only compose file
- [wrangler.toml](wrangler.toml) - Cloudflare configuration

## Next Steps

1. **Review** the deployment documentation
2. **Set up** Cloudflare account and Pages project
3. **Configure** backend CORS for your Cloudflare domain
4. **Deploy** frontend to Cloudflare Pages
5. **Test** the deployment
6. **Monitor** performance and adjust as needed

## Support

For issues or questions:

1. Check [CLOUDFLARE_DEPLOYMENT.md](docs/CLOUDFLARE_DEPLOYMENT.md) troubleshooting section
2. Review backend logs: `docker-compose logs backend`
3. Check Cloudflare Pages deployment logs
4. Verify environment variables are set correctly
