#!/bin/bash
# Setup custom domain for Cloudflare Pages
# Usage: ./scripts/setup-custom-domain.sh [domain] [project-name]

set -e

DOMAIN="${1:-net.andernet.dev}"
PROJECT_NAME="${2:-net-traffic}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}"
API_TOKEN="${CLOUDFLARE_API_TOKEN}"

if [ -z "$ACCOUNT_ID" ] || [ -z "$API_TOKEN" ]; then
    echo "❌ Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set"
    echo ""
    echo "Usage:"
    echo "  export CLOUDFLARE_ACCOUNT_ID=your_account_id"
    echo "  export CLOUDFLARE_API_TOKEN=your_api_token"
    echo "  ./scripts/setup-custom-domain.sh [domain] [project-name]"
    exit 1
fi

echo "🌐 Setting up custom domain: $DOMAIN"
echo "   Project: $PROJECT_NAME"
echo ""

# Check if domain already exists
echo "Checking if domain is already configured..."
EXISTING_DOMAINS=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/domains" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json")

if echo "$EXISTING_DOMAINS" | grep -q "\"${DOMAIN}\""; then
    echo "✅ Domain $DOMAIN is already configured"
    exit 0
fi

# Add custom domain
echo "Adding custom domain..."
RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/domains" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"domain\":\"${DOMAIN}\"}")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Custom domain added successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Go to Cloudflare Dashboard > DNS"
    echo "   2. Add a CNAME record:"
    echo "      Name: net (or @ for root domain)"
    echo "      Target: ${PROJECT_NAME}.pages.dev"
    echo "      Proxy: Enabled (orange cloud)"
    echo ""
    echo "   3. Wait for DNS propagation (usually a few minutes)"
    echo "   4. Your site will be available at: https://${DOMAIN}"
else
    echo "❌ Failed to add custom domain"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

