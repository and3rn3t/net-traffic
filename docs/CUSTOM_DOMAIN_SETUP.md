# Custom Domain Setup Guide

This guide explains how to configure a custom domain for your NetInsight deployment on Cloudflare Pages.

## Quick Setup

### Option 1: Using GitHub Secret (Automatic)

1. **Add GitHub Secret:**
   - Go to your repository > **Settings** > **Secrets and variables** > **Actions**
   - Add secret: `CLOUDFLARE_CUSTOM_DOMAIN` = `net.andernet.dev`

2. **Deploy:**
   - Push to main branch
   - The workflow will automatically configure the domain

### Option 2: Using Script (Manual)

```bash
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_API_TOKEN=your_api_token
./scripts/setup-custom-domain.sh net.andernet.dev
```

### Option 3: Cloudflare Dashboard (Manual)

1. Go to **Cloudflare Dashboard** > **Pages** > **Your Project**
2. Navigate to **Custom Domains**
3. Click **Set up a custom domain**
4. Enter: `net.andernet.dev`
5. Follow DNS setup instructions

## DNS Configuration

### Step 1: Add CNAME Record

In Cloudflare DNS (for `andernet.dev` domain):

1. Go to **DNS** > **Records**
2. Click **Add record**
3. Configure:
   - **Type**: CNAME
   - **Name**: `net` (or `@` for root domain)
   - **Target**: `net-traffic.pages.dev`
   - **Proxy status**: Proxied (orange cloud) ✅
   - **TTL**: Auto

4. Click **Save**

### Step 2: Verify DNS

Wait a few minutes for DNS propagation, then verify:

```bash
# Check DNS record
dig net.andernet.dev CNAME

# Should show: net-traffic.pages.dev
```

### Step 3: SSL/TLS Configuration

Cloudflare automatically provisions SSL certificates:

- **SSL/TLS mode**: Full (strict) recommended
- **Automatic HTTPS Rewrites**: Enabled
- Certificate is usually ready within a few minutes

## Verification

### Check Domain Status

1. **Cloudflare Dashboard:**
   - Go to **Pages** > **Your Project** > **Custom Domains**
   - Check domain status (should show "Active")

2. **Test Access:**

   ```bash
   curl -I https://net.andernet.dev
   # Should return 200 OK
   ```

3. **Browser:**
   - Visit: `https://net.andernet.dev`
   - Should load your application

## Backend CORS Configuration

**Important:** Update your backend's `ALLOWED_ORIGINS` to include the custom domain:

```bash
# In docker-compose.yml or .env
ALLOWED_ORIGINS=https://net.andernet.dev,https://net-traffic.pages.dev
```

Then restart your backend:

```bash
docker-compose restart backend
```

## Troubleshooting

### Domain Not Resolving

1. **Check DNS:**

   ```bash
   dig net.andernet.dev
   nslookup net.andernet.dev
   ```

2. **Verify CNAME:**
   - Should point to `net-traffic.pages.dev`
   - Proxy should be enabled (orange cloud)

3. **Wait for Propagation:**
   - DNS changes can take up to 24 hours (usually < 5 minutes)

### SSL Certificate Issues

1. **Check SSL/TLS Mode:**
   - Go to **SSL/TLS** > **Overview**
   - Set to **Full (strict)**

2. **Wait for Certificate:**
   - Cloudflare auto-provisions certificates
   - Usually ready within 5-15 minutes

3. **Check Certificate Status:**
   - Go to **SSL/TLS** > **Edge Certificates**
   - Look for your domain

### CORS Errors

1. **Verify Backend CORS:**

   ```bash
   # Check backend logs
   docker-compose logs backend | grep CORS
   ```

2. **Update ALLOWED_ORIGINS:**
   - Include `https://net.andernet.dev`
   - Restart backend

3. **Test:**
   ```bash
   curl -H "Origin: https://net.andernet.dev" \
        -H "Access-Control-Request-Method: GET" \
        -X OPTIONS \
        https://your-backend-url/api/health
   ```

### Domain Already Exists Error

If you see "domain already exists":

- Domain is already configured
- Check Cloudflare Dashboard > Pages > Custom Domains
- No action needed

## Advanced Configuration

### Multiple Domains

You can add multiple custom domains:

1. **Via Dashboard:**
   - Add each domain in **Custom Domains** section

2. **Via API:**
   ```bash
   ./scripts/setup-custom-domain.sh domain1.example.com
   ./scripts/setup-custom-domain.sh domain2.example.com
   ```

### Subdomain vs Root Domain

- **Subdomain** (`net.andernet.dev`): Use CNAME record
- **Root domain** (`andernet.dev`): Use CNAME or A record
  - Cloudflare Pages supports root domains
  - May require additional DNS configuration

### Redirects

Configure redirects in Cloudflare:

- **Page Rules**: Set up redirects if needed
- **Workers**: Use Workers for advanced redirect logic

## Security Considerations

1. **HTTPS Only:**
   - Cloudflare automatically redirects HTTP to HTTPS
   - Ensure SSL/TLS mode is set correctly

2. **Security Headers:**
   - Configure in Cloudflare Dashboard
   - Or use Workers for custom headers

3. **Access Control:**
   - Use Cloudflare Access for authentication
   - Or implement in your application

## Monitoring

### Check Domain Health

1. **Cloudflare Analytics:**
   - View traffic and performance
   - Monitor SSL certificate status

2. **Uptime Monitoring:**
   - Set up external monitoring
   - Use Cloudflare's built-in monitoring

## Related Documentation

- [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) - Main deployment guide
- [ENHANCED_DEPLOYMENT.md](./ENHANCED_DEPLOYMENT.md) - Enhanced deployment features
