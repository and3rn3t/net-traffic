# Deployment Guide

This guide explains how to deploy NetInsight to Cloudflare Pages using GitHub Actions.

## Prerequisites

1. A Cloudflare account
2. A GitHub repository
3. Node.js 20+ installed locally (for testing)

## Step 1: Get Cloudflare Credentials

### Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click **"Create Token"**
3. Click **"Get started"** under **"Create Custom Token"**
4. Configure the token:
   - **Token name**: Give it a descriptive name (e.g., "GitHub Actions - Pages Deployment")
   - **Permissions**: 
     - **Account** → **Cloudflare Pages** → **Edit** (Required)
     - **Zone** → **Zone** → **Read** (Optional - only needed if using custom domains)
   - **Account Resources**: Select **"Include - All accounts"** or specify your specific account
5. Click **"Continue to summary"** and then **"Create Token"**
6. **Copy the token immediately** (you won't be able to see it again)

### Cloudflare Account ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select any domain or go to the overview page
3. Your **Account ID** is displayed in the right sidebar under "Account ID"
4. Copy this ID

## Step 2: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add the following secrets:

   | Secret Name | Value | Description |
   |------------|-------|-------------|
   | `CLOUDFLARE_API_TOKEN` | Your API token | Token for Cloudflare API access |
   | `CLOUDFLARE_ACCOUNT_ID` | Your Account ID | Your Cloudflare account identifier |

## Step 3: Verify Configuration

The following files are already configured:

- ✅ `.github/workflows/deploy.yml` - GitHub Actions workflow
- ✅ `wrangler.toml` - Cloudflare Pages configuration
- ✅ `public/_redirects` - SPA routing support

## Step 4: Deploy

### Automatic Deployment

Once the secrets are configured, deployments happen automatically:

- **Production**: Every push to `main` or `master` branch
- **Preview**: Every pull request to `main` or `master` branch

### Manual Deployment (Optional)

You can also deploy manually using Wrangler CLI:

```bash
# Install Wrangler (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Build the project
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=net-traffic
```

## Step 5: Verify Deployment

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages** in the sidebar
3. You should see your `net-traffic` project
4. Click on it to see deployment history and URLs

## Custom Domain (Optional)

To add a custom domain:

1. Go to your Cloudflare Pages project
2. Navigate to **Custom domains**
3. Click **"Set up a custom domain"**
4. Enter your domain name
5. Follow the DNS configuration instructions

## Troubleshooting

### Build Failures

- Check GitHub Actions logs for specific errors
- Verify Node.js version in workflow (currently set to 20)
- Ensure all dependencies are listed in `package.json`

### Deployment Failures

- Verify `CLOUDFLARE_API_TOKEN` has correct permissions
- Check that `CLOUDFLARE_ACCOUNT_ID` is correct
- Ensure the `dist` directory is being generated correctly

### SPA Routing Issues

- Verify `public/_redirects` file exists
- Check that it's being copied to `dist` during build
- Ensure Cloudflare Pages is configured to use the redirects file

## Environment Variables

If you need to set environment variables for your deployment:

1. Go to your Cloudflare Pages project
2. Navigate to **Settings** → **Environment variables**
3. Add your variables for Production, Preview, or both

Note: Variables prefixed with `VITE_` will be available in your React app during build time.

## Support

For more information:
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

