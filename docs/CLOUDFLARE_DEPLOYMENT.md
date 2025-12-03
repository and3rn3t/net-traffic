# Cloudflare Pages Deployment Guide

This guide explains how to deploy the NetInsight frontend to Cloudflare Pages while keeping the backend on your Raspberry Pi 5.

## Architecture Overview

```
┌─────────────────────────────────┐
│   Cloudflare Pages (Frontend)  │
│   - React App (Static Assets)   │
│   - Served via CDN              │
└──────────────┬──────────────────┘
               │ HTTPS
               │ API Calls + WebSocket
               ▼
┌─────────────────────────────────┐
│   Raspberry Pi 5 (Backend)      │
│   - FastAPI Service             │
│   - Packet Capture              │
│   - SQLite Database             │
└─────────────────────────────────┘
```

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://www.cloudflare.com)
2. **Wrangler CLI**: Install Cloudflare's CLI tool
   ```bash
   npm install -g wrangler
   ```
3. **Raspberry Pi Backend**: Ensure your backend is running and accessible
4. **Public IP/Domain**: Your Raspberry Pi needs to be accessible from the internet (or use a VPN/tunnel)

## Step 1: Prepare Your Raspberry Pi Backend

### 1.1 Update CORS Configuration

Update your backend's `ALLOWED_ORIGINS` environment variable to include your Cloudflare Pages domain:

```bash
# In your backend .env or docker-compose.yml
ALLOWED_ORIGINS=https://your-app.pages.dev,https://your-custom-domain.com
```

Or if using docker-compose.yml:

```yaml
environment:
  - ALLOWED_ORIGINS=https://your-app.pages.dev,https://your-custom-domain.com
```

### 1.2 Ensure Backend is Accessible

Your Raspberry Pi backend must be accessible from the internet. Options:

**Option A: Direct Public IP (Not Recommended for Security)**

- Configure port forwarding on your router
- Use your public IP: `http://your-public-ip:8000`

**Option B: Cloudflare Tunnel (Recommended)**

- Install `cloudflared` on your Raspberry Pi
- Create a tunnel to expose your backend securely
- See [Cloudflare Tunnel Setup](#cloudflare-tunnel-setup) below

**Option C: VPN**

- Connect to your home network via VPN
- Access backend via local IP

## Step 2: Build and Deploy to Cloudflare Pages

### 2.1 Install Dependencies

```bash
npm install
```

### 2.2 Configure Environment Variables

Create a `.env.production` file (or set in Cloudflare Dashboard):

```env
VITE_API_BASE_URL=https://your-backend-url.com
VITE_USE_REAL_API=true
```

**Important**: Replace `your-backend-url.com` with your actual backend URL.

### 2.3 Build the Application

```bash
npm run build
```

This creates a `dist` folder with the production build.

### 2.4 Deploy to Cloudflare Pages

#### Option A: Via Cloudflare Dashboard (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** > **Create a project**
3. Connect your Git repository (GitHub, GitLab, etc.)
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (or leave empty)
5. Add environment variables:
   - `VITE_API_BASE_URL`: Your backend URL
   - `VITE_USE_REAL_API`: `true`
6. Click **Save and Deploy**

#### Option B: Via Wrangler CLI

```bash
# Login to Cloudflare
wrangler login

# Deploy
wrangler pages deploy dist --project-name=netinsight
```

### 2.5 Set Environment Variables in Cloudflare

After deployment, set environment variables in Cloudflare Dashboard:

1. Go to **Pages** > **Your Project** > **Settings** > **Environment Variables**
2. Add:
   - `VITE_API_BASE_URL`: Your backend URL (e.g., `https://your-backend.example.com`)
   - `VITE_USE_REAL_API`: `true`

**Note**: After adding environment variables, you need to trigger a new deployment.

## Step 3: WebSocket Configuration

WebSocket connections require special handling. The frontend will connect directly to your Raspberry Pi backend.

### 3.1 WebSocket URL

The WebSocket URL is automatically derived from `VITE_API_BASE_URL`:

- If `VITE_API_BASE_URL` is `https://...`, WebSocket uses `wss://...`
- If `VITE_API_BASE_URL` is `http://...`, WebSocket uses `ws://...`

### 3.2 Using Cloudflare Tunnel for WebSocket

If using Cloudflare Tunnel, WebSocket support is built-in. Your WebSocket URL will be:

```
wss://your-tunnel-url.com/ws
```

## Step 4: Cloudflare Tunnel Setup (Recommended)

Cloudflare Tunnel provides secure access to your backend without exposing ports.

### 4.1 Install cloudflared on Raspberry Pi

```bash
# Download and install
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

### 4.2 Authenticate

```bash
cloudflared tunnel login
```

### 4.3 Create a Tunnel

```bash
cloudflared tunnel create netinsight-backend
```

### 4.4 Configure the Tunnel

Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: /home/pi/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: your-backend.example.com
    service: http://localhost:8000
  - service: http_status:404
```

### 4.5 Run the Tunnel

```bash
# Test run
cloudflared tunnel run netinsight-backend

# Or install as service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### 4.6 Update DNS

In Cloudflare Dashboard:

1. Go to **DNS** > **Records**
2. Add a CNAME record:
   - **Name**: `your-backend` (or subdomain)
   - **Target**: `<tunnel-id>.cfargotunnel.com`
   - **Proxy**: Enabled (orange cloud)

## Step 6: Update Frontend Configuration

After deployment, update your frontend's API base URL:

1. In Cloudflare Dashboard, go to **Pages** > **Your Project** > **Settings** > **Environment Variables**
2. Set `VITE_API_BASE_URL` to your backend URL
3. Trigger a new deployment

## Step 7: Verify Deployment

1. Visit your Cloudflare Pages URL
2. Open browser DevTools > Network tab
3. Check that API calls are going to your backend
4. Verify WebSocket connection in the Console

## Troubleshooting

### CORS Errors

If you see CORS errors:

1. Verify `ALLOWED_ORIGINS` in backend includes your Cloudflare Pages domain
2. Check that the domain matches exactly (including `https://`)
3. Restart your backend service

### WebSocket Connection Failed

1. Verify WebSocket URL is correct (check browser console)
2. Ensure backend WebSocket endpoint is accessible
3. If using Cloudflare Tunnel, ensure it's running
4. Check firewall rules on Raspberry Pi

### API Timeout Errors

1. Check backend is running: `curl http://your-backend-url/api/health`
2. Verify network connectivity from Cloudflare to your backend
3. Check backend logs for errors

### Environment Variables Not Working

1. Environment variables must be set in Cloudflare Dashboard
2. After setting variables, trigger a new deployment
3. Variables prefixed with `VITE_` are available at build time

## Security Considerations

1. **HTTPS Only**: Always use HTTPS/WSS for production
2. **API Authentication**: Consider adding API keys or authentication
3. **Rate Limiting**: Your backend already has rate limiting configured
4. **CORS**: Only allow your Cloudflare Pages domain
5. **Firewall**: Restrict backend access to necessary IPs if possible

## Updating the Deployment

To update your frontend:

1. Push changes to your Git repository
2. Cloudflare Pages will automatically rebuild and deploy
3. Or manually trigger: **Pages** > **Your Project** > **Deployments** > **Retry deployment**

## Local Development

For local development, continue using:

```bash
npm run dev
```

Set `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_REAL_API=true
```

## Migration from Docker Deployment

If you're migrating from Docker deployment:

1. **Remove frontend service** from `docker-compose.yml`
2. **Keep backend service** running on Raspberry Pi
3. **Update CORS** in backend configuration
4. **Deploy frontend** to Cloudflare Pages
5. **Test** the new deployment

## Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
