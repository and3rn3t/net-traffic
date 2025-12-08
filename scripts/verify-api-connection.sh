#!/bin/bash
# Verify API connection between Cloudflare Frontend and Raspberry Pi Backend
# Usage: ./scripts/verify-api-connection.sh [backend-url]

set -e

BACKEND_URL="${1:-http://localhost:8000}"
FRONTEND_URL="${2:-}"

echo "========================================="
echo "API Connection Verification"
echo "========================================="
echo "Backend URL: $BACKEND_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "1. Testing Backend Connectivity..."
if curl -s -f -o /dev/null --max-time 5 "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    print_status 0 "Backend is reachable"
else
    print_status 1 "Backend is not reachable at $BACKEND_URL"
    echo "   Check if backend is running and accessible"
    exit 1
fi

echo ""
echo "2. Testing Health Endpoint..."
HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/api/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status"'; then
    print_status 0 "Health endpoint responding"

    # Parse JSON response
    STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    CAPTURE_RUNNING=$(echo "$HEALTH_RESPONSE" | grep -o '"running":[^,]*' | cut -d':' -f2)

    echo "   Status: $STATUS"
    echo "   Capture Running: $CAPTURE_RUNNING"
else
    print_status 1 "Health endpoint returned invalid response"
    echo "   Response: $HEALTH_RESPONSE"
    exit 1
fi

echo ""
echo "3. Testing Packet Capture Status..."
CAPTURE_RESPONSE=$(curl -s "$BACKEND_URL/api/capture/status")
if echo "$CAPTURE_RESPONSE" | grep -q '"running"'; then
    RUNNING=$(echo "$CAPTURE_RESPONSE" | grep -o '"running":[^,]*' | cut -d':' -f2)
    INTERFACE=$(echo "$CAPTURE_RESPONSE" | grep -o '"interface":"[^"]*' | cut -d'"' -f4)
    PACKETS=$(echo "$CAPTURE_RESPONSE" | grep -o '"packets_captured":[^,]*' | cut -d':' -f2)

    if [ "$RUNNING" = "true" ]; then
        print_status 0 "Packet capture is running"
        echo "   Interface: $INTERFACE"
        echo "   Packets Captured: $PACKETS"

        if [ "$PACKETS" = "0" ] || [ -z "$PACKETS" ]; then
            print_warning "No packets captured yet. Generate some network traffic."
        fi
    else
        print_status 1 "Packet capture is not running"
        echo "   Check backend logs for errors"
    fi
else
    print_status 1 "Failed to get capture status"
fi

echo ""
echo "4. Testing API Endpoints..."

# Test devices endpoint
if curl -s -f -o /dev/null "$BACKEND_URL/api/devices" > /dev/null 2>&1; then
    DEVICE_COUNT=$(curl -s "$BACKEND_URL/api/devices" | grep -o '"id"' | wc -l)
    print_status 0 "Devices endpoint accessible ($DEVICE_COUNT devices)"
else
    print_status 1 "Devices endpoint not accessible"
fi

# Test flows endpoint
if curl -s -f -o /dev/null "$BACKEND_URL/api/flows?limit=1" > /dev/null 2>&1; then
    FLOW_COUNT=$(curl -s "$BACKEND_URL/api/flows?limit=100" | grep -o '"id"' | wc -l)
    print_status 0 "Flows endpoint accessible ($FLOW_COUNT flows)"
else
    print_status 1 "Flows endpoint not accessible"
fi

# Test analytics endpoint
if curl -s -f -o /dev/null "$BACKEND_URL/api/analytics?hours=1" > /dev/null 2>&1; then
    print_status 0 "Analytics endpoint accessible"
else
    print_status 1 "Analytics endpoint not accessible"
fi

echo ""
echo "5. Testing CORS Configuration..."
if [ -n "$FRONTEND_URL" ]; then
    CORS_HEADERS=$(curl -s -I -H "Origin: $FRONTEND_URL" "$BACKEND_URL/api/health" | grep -i "access-control")
    if echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin"; then
        print_status 0 "CORS headers present"
        echo "$CORS_HEADERS" | while IFS= read -r line; do
            echo "   $line"
        done
    else
        print_warning "CORS headers not found. Check ALLOWED_ORIGINS configuration."
    fi
else
    print_warning "Skipping CORS test (no frontend URL provided)"
    echo "   Run with: $0 $BACKEND_URL https://your-frontend.pages.dev"
fi

echo ""
echo "6. Testing WebSocket Endpoint..."
WS_URL=$(echo "$BACKEND_URL" | sed 's|^http://|ws://|;s|^https://|wss://|')/ws
if timeout 3 curl -s -N -H "Connection: Upgrade" -H "Upgrade: websocket" "$WS_URL" > /dev/null 2>&1; then
    print_status 0 "WebSocket endpoint accessible"
else
    print_warning "WebSocket test inconclusive (may require proper WebSocket client)"
fi

echo ""
echo "7. Checking SCAPY Availability..."
# If running locally or in Docker
if command -v docker > /dev/null 2>&1; then
    if docker ps | grep -q netinsight-backend; then
        SCAPY_CHECK=$(docker exec netinsight-backend python3 -c "from scapy.all import sniff; print('OK')" 2>&1)
        if [ "$SCAPY_CHECK" = "OK" ]; then
            print_status 0 "SCAPY is installed in backend container"
        else
            print_status 1 "SCAPY not available: $SCAPY_CHECK"
        fi
    else
        print_warning "Backend container not found, skipping SCAPY check"
    fi
else
    print_warning "Docker not available, skipping SCAPY check"
fi

echo ""
echo "========================================="
echo "Summary"
echo "========================================="
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: ${FRONTEND_URL:-Not provided}"

if [ -n "$FRONTEND_URL" ]; then
    echo ""
    echo "Frontend Configuration:"
    echo "  VITE_API_BASE_URL=$BACKEND_URL"
    echo "  VITE_USE_REAL_API=true"
    echo ""
    echo "Backend Configuration:"
    echo "  ALLOWED_ORIGINS should include: $FRONTEND_URL"
fi

echo ""
echo "Next Steps:"
echo "1. If capture is not running, check backend logs:"
echo "   docker logs netinsight-backend"
echo ""
echo "2. If CORS errors occur, update ALLOWED_ORIGINS in backend:"
echo "   ALLOWED_ORIGINS=$FRONTEND_URL"
echo ""
echo "3. Generate network traffic to see data:"
echo "   curl https://www.google.com"
echo "   ping 8.8.8.8"
echo ""
echo "4. Check frontend can connect:"
echo "   Open browser console and check for API requests"

