# NetInsight - Cloudflare Pages Deployment

This project has been rearchitected to deploy the frontend to Cloudflare Pages while keeping the backend on Raspberry Pi 5.

## Architecture

- **Frontend**: Deployed to Cloudflare Pages (CDN, global distribution)
- **Backend**: Runs on Raspberry Pi 5 (packet capture, database, API)

## Quick Start

### For Backend (Raspberry Pi)

```bash
# Use the backend-only compose file
docker-compose -f docker-compose.backend-only.yml up -d

# Or use the main compose file (frontend service is disabled by default)
docker-compose up backend
```

### For Frontend (Cloudflare Pages)

See [docs/CLOUDFLARE_DEPLOYMENT.md](docs/CLOUDFLARE_DEPLOYMENT.md) for detailed deployment instructions.

Quick steps:
1. Build: `npm run build`
2. Deploy via Cloudflare Dashboard or `wrangler pages deploy dist`

## Benefits of This Architecture

1. **Simplified Deployment**: Frontend is static and doesn't need Docker
2. **Better Performance**: Cloudflare CDN provides global edge caching
3. **Reduced Load on Pi**: Frontend serving doesn't consume Pi resources
4. **Easier Updates**: Frontend updates via Git push, automatic deployment
5. **Better Security**: Backend stays on local network, frontend on Cloudflare

## Configuration

### Backend CORS

Update `ALLOWED_ORIGINS` in your backend environment to include your Cloudflare Pages domain:

```env
ALLOWED_ORIGINS=https://your-app.pages.dev,https://your-custom-domain.com
```

### Frontend API URL

Set in Cloudflare Pages environment variables:

```env
VITE_API_BASE_URL=https://your-backend-url.com
VITE_USE_REAL_API=true
```

## Local Development

For local development, you can still run both services:

```bash
# Backend
docker-compose up backend

# Frontend (local dev server)
npm run dev
```

Or use the frontend Docker service for local testing:

```bash
docker-compose --profile local-dev up frontend
```

## Migration Notes

If migrating from the old Docker-based deployment:

1. **Stop frontend container**: `docker-compose stop frontend`
2. **Deploy to Cloudflare**: Follow deployment guide
3. **Update backend CORS**: Add Cloudflare domain to `ALLOWED_ORIGINS`
4. **Test**: Verify frontend can connect to backend

## Documentation

- [Cloudflare Deployment Guide](docs/CLOUDFLARE_DEPLOYMENT.md) - Complete deployment instructions
- [Backend README](backend/README.md) - Backend API documentation

