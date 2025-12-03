# Migration Guide: Docker to Cloudflare Pages

This guide helps you migrate from the Docker-based deployment to the new Cloudflare Pages architecture.

## Why Migrate?

The new architecture offers several benefits:

1. **Simplified Deployment**: Frontend is static and doesn't need Docker
2. **Better Performance**: Cloudflare CDN provides global edge caching
3. **Reduced Load on Pi**: Frontend serving doesn't consume Pi resources
4. **Easier Updates**: Frontend updates via Git push, automatic deployment
5. **Better Security**: Backend stays on local network, frontend on Cloudflare

## Migration Steps

### Step 1: Prepare Your Backend

1. **Stop the frontend container** (if running):

   ```bash
   docker-compose stop frontend
   docker-compose rm frontend
   ```

2. **Update backend CORS configuration**:

   Edit your `docker-compose.yml` or `.env` file to update `ALLOWED_ORIGINS`:

   ```yaml
   environment:
     - ALLOWED_ORIGINS=https://your-app.pages.dev,https://your-custom-domain.com
   ```

   Or in `.env`:

   ```env
   ALLOWED_ORIGINS=https://your-app.pages.dev,https://your-custom-domain.com
   ```

   **Note**: Replace `your-app.pages.dev` with your actual Cloudflare Pages domain.

3. **Restart backend**:
   ```bash
   docker-compose up -d backend
   ```

### Step 2: Set Up Cloudflare Pages

1. **Create Cloudflare Account** (if you don't have one):
   - Go to [cloudflare.com](https://www.cloudflare.com) and sign up

2. **Install Wrangler CLI**:

   ```bash
   npm install -g wrangler
   ```

3. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

### Step 3: Deploy Frontend

#### Option A: Via Cloudflare Dashboard (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** > **Create a project**
3. Connect your Git repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Add environment variables:
   - `VITE_API_BASE_URL`: Your backend URL (e.g., `https://your-backend.example.com`)
   - `VITE_USE_REAL_API`: `true`
6. Click **Save and Deploy**

#### Option B: Via CLI

```bash
# Build the application
npm run build

# Deploy
wrangler pages deploy dist --project-name=netinsight
```

Then set environment variables in Cloudflare Dashboard.

### Step 4: Configure Backend Access

Your Raspberry Pi backend needs to be accessible from the internet. Choose one:

#### Option A: Cloudflare Tunnel (Recommended)

1. Install `cloudflared` on Raspberry Pi:

   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o cloudflared
   chmod +x cloudflared
   sudo mv cloudflared /usr/local/bin/
   ```

2. Authenticate:

   ```bash
   cloudflared tunnel login
   ```

3. Create tunnel:

   ```bash
   cloudflared tunnel create netinsight-backend
   ```

4. Configure tunnel (create `/etc/cloudflared/config.yml`):

   ```yaml
   tunnel: <tunnel-id>
   credentials-file: /home/pi/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: your-backend.example.com
       service: http://localhost:8000
     - service: http_status:404
   ```

5. Run tunnel:

   ```bash
   sudo cloudflared service install
   sudo systemctl start cloudflared
   ```

6. Update DNS in Cloudflare Dashboard to point to your tunnel

#### Option B: Port Forwarding (Less Secure)

1. Configure port forwarding on your router (port 8000)
2. Use your public IP address
3. **Warning**: This exposes your backend to the internet

### Step 5: Update Frontend Configuration

1. In Cloudflare Dashboard, go to **Pages** > **Your Project** > **Settings** > **Environment Variables**
2. Set `VITE_API_BASE_URL` to your backend URL
3. Trigger a new deployment

### Step 6: Verify Deployment

1. Visit your Cloudflare Pages URL
2. Open browser DevTools > Network tab
3. Verify API calls are going to your backend
4. Check WebSocket connection in Console

## Rollback Plan

If you need to rollback to Docker deployment:

1. **Start frontend container**:

   ```bash
   docker-compose --profile local-dev up -d frontend
   ```

2. **Update backend CORS** to include localhost:

   ```yaml
   ALLOWED_ORIGINS=http://localhost,http://localhost:80
   ```

3. **Restart backend**:
   ```bash
   docker-compose restart backend
   ```

## Troubleshooting

### CORS Errors

- Verify `ALLOWED_ORIGINS` includes your Cloudflare Pages domain
- Check domain matches exactly (including `https://`)
- Restart backend after changing CORS

### WebSocket Connection Failed

- Verify WebSocket URL is correct (check browser console)
- Ensure backend WebSocket endpoint is accessible
- If using Cloudflare Tunnel, ensure it's running

### API Timeout Errors

- Check backend is running: `curl http://your-backend-url/api/health`
- Verify network connectivity
- Check backend logs for errors

## Post-Migration

After successful migration:

1. **Remove frontend from docker-compose.yml** (optional):
   - The frontend service is already disabled by default
   - You can remove it entirely if desired

2. **Update documentation**:
   - Update any deployment docs
   - Update team documentation

3. **Monitor**:
   - Check Cloudflare Pages analytics
   - Monitor backend logs
   - Verify WebSocket connections

## Benefits Realized

After migration, you should see:

- ✅ Faster page loads (CDN caching)
- ✅ Reduced Raspberry Pi resource usage
- ✅ Easier frontend updates (Git push)
- ✅ Better global performance
- ✅ Simplified deployment process

## Support

If you encounter issues:

1. Check [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) for detailed setup
2. Review backend logs: `docker-compose logs backend`
3. Check Cloudflare Pages deployment logs
4. Verify environment variables are set correctly
