#!/bin/bash
# Verify Cloudflare Pages deployment
# Usage: ./scripts/verify-cloudflare-deployment.sh [project-name] [account-id] [api-token]

set -e

PROJECT_NAME="${1:-net-traffic}"
ACCOUNT_ID="${2:-${CLOUDFLARE_ACCOUNT_ID}}"
API_TOKEN="${3:-${CLOUDFLARE_API_TOKEN}}"

if [ -z "$ACCOUNT_ID" ] || [ -z "$API_TOKEN" ]; then
    echo "❌ Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set"
    echo "Usage: $0 [project-name] [account-id] [api-token]"
    exit 1
fi

echo "🔍 Verifying Cloudflare Pages deployment for project: $PROJECT_NAME"

# Get latest deployment
DEPLOYMENTS=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json")

# Check if request was successful
if echo "$DEPLOYMENTS" | grep -q '"success":true'; then
    LATEST_DEPLOYMENT=$(echo "$DEPLOYMENTS" | jq -r '.result[0] // empty')

    if [ -n "$LATEST_DEPLOYMENT" ] && [ "$LATEST_DEPLOYMENT" != "null" ]; then
        URL=$(echo "$LATEST_DEPLOYMENT" | jq -r '.url // empty')
        STATUS=$(echo "$LATEST_DEPLOYMENT" | jq -r '.latest_stage.status // empty')
        CREATED=$(echo "$LATEST_DEPLOYMENT" | jq -r '.created_on // empty')

        echo "✅ Deployment found!"
        echo "   URL: $URL"
        echo "   Status: $STATUS"
        echo "   Created: $CREATED"

        # Check if deployment is live
        if [ "$STATUS" = "success" ]; then
            echo ""
            echo "🌐 Testing deployment URL..."
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

            if [ "$HTTP_CODE" = "200" ]; then
                echo "✅ Deployment is live and accessible!"
                echo "   Visit: $URL"
            else
                echo "⚠️  Deployment exists but returned HTTP $HTTP_CODE"
            fi
        else
            echo "⚠️  Deployment status: $STATUS"
        fi
    else
        echo "❌ No deployments found"
    fi
else
    echo "❌ Failed to fetch deployments"
    echo "$DEPLOYMENTS" | jq '.' 2>/dev/null || echo "$DEPLOYMENTS"
    exit 1
fi

