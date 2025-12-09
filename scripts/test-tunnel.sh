#!/bin/bash
# Quick test script for Cloudflare Tunnel

echo "Testing Cloudflare Tunnel..."
echo ""

# Test local backend
echo "1. Testing local backend..."
if curl -s -f http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✓ Backend is responding locally"
    curl -s http://localhost:8000/api/health | jq '.' 2>/dev/null || curl -s http://localhost:8000/api/health
else
    echo "✗ Backend is NOT responding locally"
    echo "   Check: docker ps | grep netinsight-backend"
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
    echo "     OR"
    echo "     docker ps | grep cloudflared"
    echo ""
    echo "  2. Check tunnel logs:"
    echo "     sudo journalctl -u cloudflared -n 20"
    echo "     OR"
    echo "     docker logs netinsight-cloudflared --tail 20"
    echo ""
    echo "  3. Check DNS:"
    echo "     dig net-backend.andernet.dev"
    echo ""
    echo "  4. Wait a few minutes for DNS/SSL propagation"
fi

echo ""

