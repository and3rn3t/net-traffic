#!/bin/bash
# Setup Cloudflare Pages environment variables
# This script helps configure environment variables in Cloudflare Pages
# Usage: ./scripts/setup-cloudflare-env.sh

set -e

PROJECT_NAME="${CLOUDFLARE_PROJECT_NAME:-net-traffic}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}"
API_TOKEN="${CLOUDFLARE_API_TOKEN}"
BACKEND_URL="${BACKEND_URL}"

if [ -z "$ACCOUNT_ID" ] || [ -z "$API_TOKEN" ]; then
    echo "❌ Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set"
    echo ""
    echo "Usage:"
    echo "  export CLOUDFLARE_ACCOUNT_ID=your_account_id"
    echo "  export CLOUDFLARE_API_TOKEN=your_api_token"
    echo "  export BACKEND_URL=https://your-backend.example.com"
    echo "  ./scripts/setup-cloudflare-env.sh"
    exit 1
fi

if [ -z "$BACKEND_URL" ]; then
    echo "⚠️  Warning: BACKEND_URL not set"
    read -p "Enter your backend URL (e.g., https://your-backend.example.com): " BACKEND_URL
fi

echo "🔧 Setting up Cloudflare Pages environment variables..."
echo "   Project: $PROJECT_NAME"
echo "   Backend URL: $BACKEND_URL"
echo ""

# Set VITE_API_BASE_URL
echo "Setting VITE_API_BASE_URL..."
RESPONSE=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/vars" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"vars\": {
      \"VITE_API_BASE_URL\": \"${BACKEND_URL}\"
    }
  }")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ VITE_API_BASE_URL set successfully"
else
    echo "❌ Failed to set VITE_API_BASE_URL"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

# Set VITE_USE_REAL_API
echo "Setting VITE_USE_REAL_API..."
RESPONSE=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/vars" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"vars\": {
      \"VITE_USE_REAL_API\": \"true\"
    }
  }")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ VITE_USE_REAL_API set successfully"
else
    echo "❌ Failed to set VITE_USE_REAL_API"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

echo ""
echo "✅ Environment variables configured!"
echo ""
echo "📝 Note: You may need to trigger a new deployment for changes to take effect:"
echo "   1. Go to Cloudflare Dashboard > Pages > $PROJECT_NAME"
echo "   2. Click 'Retry deployment' on the latest deployment"
echo "   Or push a new commit to trigger automatic deployment"

