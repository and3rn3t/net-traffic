#!/bin/bash
# Deploy NetInsight frontend to Cloudflare Pages
# This script builds and deploys the frontend to Cloudflare Pages

set -e

echo "🚀 Deploying NetInsight to Cloudflare Pages..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Check if logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Not logged in to Cloudflare. Please run: wrangler login"
    exit 1
fi

# Check environment variables
if [ -z "$VITE_API_BASE_URL" ]; then
    echo "⚠️  WARNING: VITE_API_BASE_URL not set"
    echo "   Set it in Cloudflare Pages environment variables after deployment"
fi

# Build the application
echo "📦 Building application..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

# Deploy to Cloudflare Pages
echo "☁️  Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=netinsight

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Go to Cloudflare Dashboard > Pages > netinsight"
echo "   2. Set environment variables:"
echo "      - VITE_API_BASE_URL: Your backend URL"
echo "      - VITE_USE_REAL_API: true"
echo "   3. Update backend ALLOWED_ORIGINS to include your Cloudflare Pages domain"
echo ""
echo "🔗 Your app should be available at: https://netinsight.pages.dev"

