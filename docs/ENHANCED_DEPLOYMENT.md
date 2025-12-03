# Enhanced Cloudflare Pages Deployment

This guide covers the enhanced deployment setup with automated CI/CD, environment variable management, and deployment verification.

## Quick Start

### 1. GitHub Actions (Automatic Deployment)

The project includes a GitHub Actions workflow that automatically:

- ✅ Runs tests on every push/PR
- ✅ Builds the application
- ✅ Deploys to Cloudflare Pages
- ✅ Verifies deployment

**Setup:**

1. **Add GitHub Secrets:**
   - Go to your GitHub repository
   - Navigate to **Settings** > **Secrets and variables** > **Actions**
   - Add these secrets:
     - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
     - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID
     - `VITE_API_BASE_URL`: (Optional) Your backend URL for build-time
     - `VITE_USE_REAL_API`: (Optional) Set to `true` for build-time

2. **Push to main/master branch:**

   ```bash
   git push origin main
   ```

3. **Check deployment:**
   - Go to **Actions** tab in GitHub
   - Watch the workflow run
   - Deployment URL will be shown in the workflow output

### 2. Manual Deployment

If you prefer manual deployment:

```bash
# Build
npm run build

# Deploy
npm run deploy:cloudflare

# Or use wrangler directly
wrangler pages deploy dist --project-name=net-traffic
```

### 3. Environment Variables

#### Option A: Cloudflare Dashboard (Recommended)

1. Go to **Cloudflare Dashboard** > **Pages** > **Your Project**
2. Navigate to **Settings** > **Environment Variables**
3. Add:
   - `VITE_API_BASE_URL`: Your backend URL
   - `VITE_USE_REAL_API`: `true`

**Note:** After setting variables, trigger a new deployment.

#### Option B: Using Script

```bash
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_API_TOKEN=your_api_token
export BACKEND_URL=https://your-backend.example.com
./scripts/setup-cloudflare-env.sh
```

#### Option C: GitHub Secrets (Build-time)

Set in GitHub repository secrets (baked into build):

- `VITE_API_BASE_URL`
- `VITE_USE_REAL_API`

## Verification

### Verify Deployment

```bash
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_API_TOKEN=your_api_token
./scripts/verify-cloudflare-deployment.sh
```

### Check Deployment Status

1. **Cloudflare Dashboard:**
   - Go to **Pages** > **Your Project** > **Deployments**
   - Check latest deployment status

2. **GitHub Actions:**
   - Go to **Actions** tab
   - Check workflow run status

## Environment Variable Priority

Environment variables are resolved in this order:

1. **Cloudflare Pages Environment Variables** (Runtime)
   - Set in Cloudflare Dashboard
   - Available at runtime
   - Can be different per environment (production/preview)

2. **GitHub Secrets** (Build-time)
   - Set in GitHub repository secrets
   - Baked into the build
   - Same for all deployments

3. **Build-time defaults**
   - Fallback values in build scripts

**Recommendation:** Use Cloudflare Dashboard for environment variables (runtime) so you can change them without rebuilding.

## Backend Configuration

### Update CORS

Update your backend's `ALLOWED_ORIGINS` to include your Cloudflare Pages domain:

```bash
# In docker-compose.yml or .env
ALLOWED_ORIGINS=https://your-app.pages.dev,https://your-custom-domain.com
```

### Restart Backend

```bash
docker-compose restart backend
```

## Troubleshooting

### Deployment Fails

1. **Check GitHub Actions logs:**
   - Go to **Actions** > **Latest workflow run**
   - Check error messages

2. **Verify secrets:**
   - Ensure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set
   - Verify token has correct permissions

3. **Check build:**

   ```bash
   npm run build
   # Check for build errors
   ```

### Environment Variables Not Working

1. **Verify variables are set:**
   - Check Cloudflare Dashboard > Pages > Settings > Environment Variables
   - Or use verification script

2. **Trigger new deployment:**
   - Environment variables require a new deployment
   - Push a new commit or retry deployment

3. **Check variable names:**
   - Must be prefixed with `VITE_` to be available in frontend
   - Case-sensitive

### CORS Errors

1. **Verify backend CORS:**

   ```bash
   # Check backend logs
   docker-compose logs backend | grep CORS
   ```

2. **Update ALLOWED_ORIGINS:**
   - Include your Cloudflare Pages domain
   - Include `https://` prefix
   - Restart backend

### WebSocket Connection Failed

1. **Check WebSocket URL:**
   - Open browser DevTools > Console
   - Look for WebSocket connection errors
   - Verify URL is correct (wss:// for https://)

2. **Verify backend is accessible:**

   ```bash
   curl https://your-backend.example.com/api/health
   ```

3. **Check Cloudflare Tunnel** (if using):

   ```bash
   # On Raspberry Pi
   sudo systemctl status cloudflared
   ```

## Custom Domain Setup

### Quick Setup

1. **Add GitHub Secret:**
   - `CLOUDFLARE_CUSTOM_DOMAIN` = `net.andernet.dev`

2. **Deploy:** Domain is automatically configured

3. **Configure DNS:**
   - Add CNAME: `net` → `net-traffic.pages.dev`
   - Enable proxy (orange cloud)

See [CUSTOM_DOMAIN_SETUP.md](./CUSTOM_DOMAIN_SETUP.md) for complete guide.

## Advanced Configuration

### Custom Domain (Manual)

1. **Add domain in Cloudflare:**
   - Go to **Pages** > **Your Project** > **Custom Domains**
   - Add your domain

2. **Update DNS:**
   - Add CNAME record pointing to your Pages domain

3. **Update backend CORS:**
   - Add custom domain to `ALLOWED_ORIGINS`

### Preview Deployments

Preview deployments are automatically created for:

- Pull requests
- Non-main branches

Preview deployments use the same environment variables as production unless configured separately.

### Build Optimization

The build is optimized for Cloudflare Pages:

- Code splitting for faster loads
- Asset optimization
- SPA routing support (`_redirects` file)

## Monitoring

### Deployment Notifications

GitHub Actions will show deployment status:

- ✅ Success: Deployment URL in workflow output
- ❌ Failure: Error details in workflow logs

### Health Checks

After deployment, verify:

1. Frontend loads correctly
2. API calls work (check Network tab)
3. WebSocket connects (check Console)

## Related Documentation

- [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) - Basic deployment guide
- [MIGRATION_TO_CLOUDFLARE.md](./MIGRATION_TO_CLOUDFLARE.md) - Migration guide
- [FINAL_ARCHITECTURE.md](./FINAL_ARCHITECTURE.md) - Architecture overview
