#!/bin/bash
# Verify NetInsight deployment status
# Checks backend, tunnel, and connectivity

set -e

echo "========================================="
echo "NetInsight Deployment Verification"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check Docker containers
echo "1. Checking Docker Containers..."
echo ""

BACKEND_RUNNING=false
TUNNEL_RUNNING=false

if docker ps | grep -q netinsight-backend; then
    print_status 0 "Backend container is running"
    BACKEND_RUNNING=true

    # Get backend status
    BACKEND_STATUS=$(docker ps --filter "name=netinsight-backend" --format "{{.Status}}")
    echo "   Status: $BACKEND_STATUS"
else
    print_status 1 "Backend container is NOT running"
    echo "   Start with: docker-compose -f docker-compose.backend-with-tunnel.yml up -d backend"
fi

if docker ps | grep -q netinsight-cloudflared; then
    print_status 0 "Cloudflared container is running"
    TUNNEL_RUNNING=true

    # Get tunnel status
    TUNNEL_STATUS=$(docker ps --filter "name=netinsight-cloudflared" --format "{{.Status}}")
    echo "   Status: $TUNNEL_STATUS"
else
    print_status 1 "Cloudflared container is NOT running"
    echo "   Start with: docker-compose -f docker-compose.backend-with-tunnel.yml up -d cloudflared"
fi

echo ""

# 2. Check backend health (local)
echo "2. Checking Backend Health (Local)..."
echo ""

if curl -s -f -o /dev/null --max-time 5 http://localhost:8000/api/health > /dev/null 2>&1; then
    print_status 0 "Backend is responding locally"

    # Get health data
    HEALTH=$(curl -s http://localhost:8000/api/health)
    STATUS=$(echo "$HEALTH" | grep -o '"status":"[^"]*' | cut -d'"' -f4 || echo "unknown")
    CAPTURE_RUNNING=$(echo "$HEALTH" | grep -o '"running":[^,]*' | cut -d':' -f2 || echo "unknown")

    echo "   Status: $STATUS"
    echo "   Capture Running: $CAPTURE_RUNNING"

    if [ "$CAPTURE_RUNNING" = "true" ]; then
        PACKETS=$(echo "$HEALTH" | grep -o '"packets_captured":[^,]*' | cut -d':' -f2 || echo "0")
        FLOWS=$(echo "$HEALTH" | grep -o '"flows_detected":[^,]*' | cut -d':' -f2 || echo "0")
        echo "   Packets Captured: $PACKETS"
        echo "   Flows Detected: $FLOWS"
    fi
else
    print_status 1 "Backend is NOT responding locally"
    if [ "$BACKEND_RUNNING" = "true" ]; then
        echo "   Container is running but not responding - check logs:"
        echo "   docker logs netinsight-backend"
    fi
fi

echo ""

# 3. Check tunnel connectivity
echo "3. Checking Cloudflare Tunnel..."
echo ""

if [ "$TUNNEL_RUNNING" = "true" ]; then
    # Check tunnel logs for connection status
    TUNNEL_LOGS=$(docker logs netinsight-cloudflared --tail 20 2>&1)

    if echo "$TUNNEL_LOGS" | grep -qi "tunnel is now running\|INF.*Your tunnel"; then
        print_status 0 "Tunnel appears to be connected"

        # Try to extract tunnel URL from logs
        TUNNEL_URL=$(echo "$TUNNEL_LOGS" | grep -oE 'https://[a-zA-Z0-9.-]+\.(cfargotunnel\.com|trycloudflare\.com|andernet\.dev)' | head -1)
        if [ -n "$TUNNEL_URL" ]; then
            echo "   Tunnel URL found: $TUNNEL_URL"
        fi
    else
        print_warning "Tunnel is running but connection status unclear"
        echo "   Check logs: docker logs netinsight-cloudflared"
    fi

    # Check for errors in tunnel logs
    if echo "$TUNNEL_LOGS" | grep -qi "error\|failed\|fatal"; then
        print_warning "Errors found in tunnel logs"
        echo "   Recent errors:"
        echo "$TUNNEL_LOGS" | grep -i "error\|failed\|fatal" | tail -3 | sed 's/^/     /'
    fi
else
    print_warning "Cannot check tunnel - container not running"
fi

echo ""

# 4. Check tunnel domain (if configured)
echo "4. Checking Tunnel Domain (net-backend.andernet.dev)..."
echo ""

if curl -s -f -o /dev/null --max-time 10 https://net-backend.andernet.dev/api/health > /dev/null 2>&1; then
    print_status 0 "Tunnel domain is accessible"

    # Get health from tunnel
    TUNNEL_HEALTH=$(curl -s https://net-backend.andernet.dev/api/health)
    TUNNEL_STATUS=$(echo "$TUNNEL_HEALTH" | grep -o '"status":"[^"]*' | cut -d'"' -f4 || echo "unknown")
    echo "   Backend status via tunnel: $TUNNEL_STATUS"
else
    print_status 1 "Tunnel domain is NOT accessible"
    echo "   This could mean:"
    echo "   - Tunnel is not fully connected"
    echo "   - DNS not propagated yet (wait a few minutes)"
    echo "   - SSL certificate not ready (wait 1-5 minutes)"
    echo "   - Config file issue"
fi

echo ""

# 5. Check DNS resolution
echo "5. Checking DNS Resolution..."
echo ""

if command -v dig > /dev/null 2>&1; then
    DNS_RESULT=$(dig +short net-backend.andernet.dev CNAME 2>&1)
    if echo "$DNS_RESULT" | grep -q "cfargotunnel\|trycloudflare"; then
        print_status 0 "DNS is correctly configured"
        echo "   DNS points to: $DNS_RESULT"
    else
        print_warning "DNS may not be configured correctly"
        echo "   Result: $DNS_RESULT"
        echo "   Should point to: *.cfargotunnel.com or *.trycloudflare.com"
    fi
else
    print_warning "dig not available - skipping DNS check"
fi

echo ""

# 6. Check CORS configuration
echo "6. Checking CORS Configuration..."
echo ""

if [ "$BACKEND_RUNNING" = "true" ]; then
    CORS_ENV=$(docker exec netinsight-backend env | grep ALLOWED_ORIGINS || echo "")
    if [ -n "$CORS_ENV" ]; then
        echo "   $CORS_ENV"

        if echo "$CORS_ENV" | grep -q "net-backend.andernet.dev\|net.andernet.dev"; then
            print_status 0 "CORS includes required domains"
        else
            print_warning "CORS may be missing required domains"
            echo "   Should include: net-backend.andernet.dev and net.andernet.dev"
        fi
    else
        print_warning "ALLOWED_ORIGINS not found in container"
    fi
fi

echo ""

# 7. Summary
echo "========================================="
echo "Summary"
echo "========================================="
echo ""

if [ "$BACKEND_RUNNING" = "true" ] && [ "$TUNNEL_RUNNING" = "true" ]; then
    print_info "Both backend and tunnel containers are running"
    echo ""
    echo "Next steps:"
    echo "1. Verify tunnel domain is accessible: curl https://net-backend.andernet.dev/api/health"
    echo "2. Update frontend VITE_API_BASE_URL to: https://net-backend.andernet.dev"
    echo "3. Test frontend connection from browser"
    echo ""
    echo "View logs:"
    echo "  Backend:  docker logs -f netinsight-backend"
    echo "  Tunnel:   docker logs -f netinsight-cloudflared"
else
    echo "Issues found:"
    if [ "$BACKEND_RUNNING" = "false" ]; then
        echo "  - Backend container not running"
    fi
    if [ "$TUNNEL_RUNNING" = "false" ]; then
        echo "  - Tunnel container not running"
    fi
    echo ""
    echo "Start services:"
    echo "  docker-compose -f docker-compose.backend-with-tunnel.yml up -d"
fi

echo ""

