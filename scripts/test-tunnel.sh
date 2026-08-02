#!/bin/bash
# Quick test script for Cloudflare Tunnel

echo "Testing Cloudflare Tunnel..."
echo ""

# Test local backend
echo "1. Testing local backend..."
if curl -s -f http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "   ✓ Backend is responding locally"
    curl -s http://localhost:8000/api/health | jq '.' 2>/dev/null || curl -s http://localhost:8000/api/health
else
    echo "   ✗ Backend is NOT responding locally"
    echo "   Troubleshooting:"
    echo "     - Is the service running? sudo systemctl status netinsight-backend"
    echo "     - Check logs: sudo journalctl -u netinsight-backend --tail 50"
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

