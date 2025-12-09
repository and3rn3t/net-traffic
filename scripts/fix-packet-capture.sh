#!/bin/bash
# Diagnostic and fix script for packet capture issues

echo "========================================="
echo "Packet Capture Diagnostic & Fix Script"
echo "========================================="
echo ""

# 1. Check what's running on port 8000
echo "1. Checking what's running on port 8000..."
PORT_PROCESS=$(sudo lsof -i :8000 2>/dev/null || sudo netstat -tulpn | grep :8000 | head -1)
if [ -n "$PORT_PROCESS" ]; then
    echo "   Found process on port 8000:"
    echo "   $PORT_PROCESS"
else
    echo "   ✗ No process found on port 8000"
fi

# 2. Check Docker containers
echo ""
echo "2. Checking Docker containers..."
if docker ps | grep -q netinsight-backend; then
    echo "   ✓ Backend container is running"
    docker ps | grep netinsight-backend
else
    echo "   ⚠️  Backend container not found by name"
    echo "   Checking all containers..."
    docker ps
fi

# 3. Check packet capture status via API
echo ""
echo "3. Checking packet capture status..."
CAPTURE_STATUS=$(curl -s http://localhost:8000/api/capture/status 2>/dev/null)
if [ -n "$CAPTURE_STATUS" ]; then
    echo "$CAPTURE_STATUS" | jq '.' 2>/dev/null || echo "$CAPTURE_STATUS"
    IS_RUNNING=$(echo "$CAPTURE_STATUS" | grep -o '"running":[^,}]*' | cut -d':' -f2 | tr -d ' ')
    if [ "$IS_RUNNING" = "true" ]; then
        echo "   ✓ Packet capture is running"
    else
        echo "   ✗ Packet capture is NOT running"
        echo ""
        echo "   Attempting to start packet capture..."
        START_RESULT=$(curl -s -X POST http://localhost:8000/api/capture/start 2>/dev/null)
        echo "$START_RESULT" | jq '.' 2>/dev/null || echo "$START_RESULT"

        # Wait a moment and check again
        sleep 2
        CAPTURE_STATUS=$(curl -s http://localhost:8000/api/capture/status 2>/dev/null)
        IS_RUNNING=$(echo "$CAPTURE_STATUS" | grep -o '"running":[^,}]*' | cut -d':' -f2 | tr -d ' ')
        if [ "$IS_RUNNING" = "true" ]; then
            echo "   ✓ Packet capture started successfully!"
        else
            echo "   ✗ Failed to start packet capture"
            echo ""
            echo "   Checking backend logs for errors..."
            if docker ps | grep -q netinsight-backend; then
                echo "   Last 20 lines of backend logs:"
                docker logs netinsight-backend --tail 20 2>&1 | grep -i "scapy\|capture\|error" || docker logs netinsight-backend --tail 20
            fi
        fi
    fi
else
    echo "   ✗ Cannot connect to backend API"
fi

# 4. Check SCAPY installation
echo ""
echo "4. Checking SCAPY availability..."
if docker ps | grep -q netinsight-backend; then
    SCAPY_CHECK=$(docker exec netinsight-backend python3 -c "import scapy; print('SCAPY_OK')" 2>&1)
    if echo "$SCAPY_CHECK" | grep -q "SCAPY_OK"; then
        echo "   ✓ SCAPY is installed in container"
    else
        echo "   ✗ SCAPY is NOT available in container"
        echo "   Error: $SCAPY_CHECK"
    fi
else
    echo "   ⚠️  Cannot check SCAPY (container not running or not found)"
fi

# 5. Check network interface
echo ""
echo "5. Checking network interface..."
HEALTH=$(curl -s http://localhost:8000/api/health 2>/dev/null)
if [ -n "$HEALTH" ]; then
    INTERFACE=$(echo "$HEALTH" | grep -o '"interface":"[^"]*' | cut -d'"' -f4)
    if [ -n "$INTERFACE" ]; then
        echo "   Backend is configured to use: $INTERFACE"
        if ip link show "$INTERFACE" >/dev/null 2>&1; then
            echo "   ✓ Interface $INTERFACE exists"
        else
            echo "   ✗ Interface $INTERFACE does NOT exist"
            echo "   Available interfaces:"
            ip link show | grep -E "^[0-9]+:" | awk -F': ' '{print "     - " $2}'
        fi
    fi
fi

# 6. Final health check
echo ""
echo "6. Final health check..."
HEALTH=$(curl -s http://localhost:8000/api/health 2>/dev/null)
if [ -n "$HEALTH" ]; then
    STATUS=$(echo "$HEALTH" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    CAPTURE_RUNNING=$(echo "$HEALTH" | grep -o '"running":[^,}]*' | cut -d':' -f2 | tr -d ' ')
    PACKETS=$(echo "$HEALTH" | grep -o '"packets_captured":[^,}]*' | cut -d':' -f2 | tr -d ' ')

    echo "   Backend status: $STATUS"
    echo "   Capture running: $CAPTURE_RUNNING"
    echo "   Packets captured: $PACKETS"

    if [ "$STATUS" = "healthy" ] && [ "$CAPTURE_RUNNING" = "true" ]; then
        echo ""
        echo "========================================="
        echo "✓ Everything is working correctly!"
        echo "========================================="
    elif [ "$CAPTURE_RUNNING" = "false" ]; then
        echo ""
        echo "========================================="
        echo "⚠️  Backend is running but capture is not"
        echo "========================================="
        echo ""
        echo "Recommended actions:"
        echo "  1. Try starting capture manually:"
        echo "     curl -X POST http://localhost:8000/api/capture/start"
        echo ""
        echo "  2. If that fails, restart the backend container:"
        echo "     docker compose -f docker-compose.backend-only.yml restart backend"
        echo ""
        echo "  3. Check backend logs for SCAPY errors:"
        echo "     docker logs netinsight-backend | grep -i scapy"
    fi
else
    echo "   ✗ Cannot get health status"
fi

echo ""

