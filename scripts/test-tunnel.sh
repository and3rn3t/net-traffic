#!/bin/bash
# Quick test script for Cloudflare Tunnel

echo "Testing Cloudflare Tunnel..."
echo ""

# Test local backend
echo "1. Testing local backend..."
echo "   Checking if backend container is running..."
if docker ps | grep -q netinsight-backend; then
    echo "   ✓ Backend container is running"
else
    echo "   ✗ Backend container is NOT running"
    echo "   Start it with: docker compose -f docker-compose.backend-only.yml up -d backend"
fi

echo ""
echo "   Testing backend API..."
if curl -s -f http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "   ✓ Backend is responding locally"
    curl -s http://localhost:8000/api/health | jq '.' 2>/dev/null || curl -s http://localhost:8000/api/health
else
    echo "   ✗ Backend is NOT responding locally"
    echo "   Troubleshooting:"
    echo "     - Is container running? docker ps | grep backend"
    echo "     - Is port 8000 exposed? docker port netinsight-backend"
    echo "     - Check logs: docker logs netinsight-backend"
fi

echo ""
echo "2. Testing tunnel domain (net-backend.andernet.dev)..."
if curl -s -f --max-time 10 https://net-backend.andernet.dev/api/health > /dev/null 2>&1; then
    echo "✓ Tunnel domain is accessible"
    curl -s https://net-backend.andernet.dev/api/health | jq '.' 2>/dev/null || curl -s https://net-backend.andernet.dev/api/health
else
    echo "✗ Tunnel domain is NOT accessible"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check tunnel is running:"
    echo "     sudo systemctl status cloudflared"
    echo ""
    echo "  2. Check tunnel logs for 'Unable to reach origin service':"
    echo "     sudo journalctl -u cloudflared -n 50 | grep -i error"
    echo ""
    echo "  3. Verify config file uses correct service URL:"
    echo "     cat ~/.cloudflared/config.yml | grep service"
    echo "     (Should be: http://localhost:8000 for systemd service)"
    echo ""
    echo "  4. Verify backend is accessible:"
    echo "     curl http://localhost:8000/api/health"
    echo ""
    echo "  5. Check DNS:"
    echo "     dig net-backend.andernet.dev CNAME"
    echo ""
    echo "  6. Wait a few minutes for DNS/SSL propagation"
fi

echo ""

