#!/bin/bash
# Comprehensive fix for SCAPY and port issues

echo "========================================="
echo "Comprehensive Backend Fix"
echo "========================================="
echo ""

BACKEND_DIR="/home/pi/net-traffic/backend"
VENV_PYTHON="$BACKEND_DIR/venv/bin/python"

cd "$BACKEND_DIR"
source venv/bin/activate

# 1. Kill any processes on port 8000
echo "1. Freeing port 8000..."
PIDS=$(lsof -ti:8000 2>/dev/null || netstat -tulpn 2>/dev/null | grep ':8000 ' | awk '{print $7}' | cut -d'/' -f1 | grep -E '^[0-9]+$' | head -1)
if [ -n "$PIDS" ]; then
    echo "   Found process(es) on port 8000: $PIDS"
    for PID in $PIDS; do
        echo "   Killing PID: $PID"
        kill "$PID" 2>/dev/null || sudo kill "$PID" 2>/dev/null
    done
    sleep 2
    echo "   ✓ Port 8000 freed"
else
    echo "   ✓ Port 8000 is already free"
fi

# Also kill any backend Python processes
echo "   Checking for backend Python processes..."
BACKEND_PIDS=$(pgrep -f "python.*main.py" 2>/dev/null || echo "")
if [ -n "$BACKEND_PIDS" ]; then
    echo "   Found backend processes: $BACKEND_PIDS"
    for PID in $BACKEND_PIDS; do
        kill "$PID" 2>/dev/null
    done
    sleep 1
fi

# 2. Check and fix SCAPY import
echo ""
echo "2. Testing SCAPY imports (exactly as backend does)..."
TEST_IMPORT=$($VENV_PYTHON -c "
try:
    from scapy.all import sniff, get_if_list, IP, IPv6, TCP, UDP, ICMP, ARP
    from scapy.layers.l2 import Ether
    from scapy.layers.dns import DNS
    from scapy.layers.tls.handshake import TLSClientHello
    try:
        from scapy.layers.http import HTTPRequest
    except ImportError:
        HTTPRequest = None
    print('SUCCESS: All imports worked')
    SCAPY_AVAILABLE = True
except ImportError as e:
    print(f'FAILED: Import error: {e}')
    import traceback
    traceback.print_exc()
    SCAPY_AVAILABLE = False
    exit(1)
" 2>&1)

echo "$TEST_IMPORT"

if echo "$TEST_IMPORT" | grep -q "FAILED"; then
    echo ""
    echo "   ✗ SCAPY import failed. Installing/upgrading dependencies..."
    pip install --upgrade scapy cryptography
    echo ""
    echo "   Testing again..."
    $VENV_PYTHON -c "
try:
    from scapy.all import sniff, get_if_list, IP, IPv6, TCP, UDP, ICMP, ARP
    from scapy.layers.l2 import Ether
    from scapy.layers.dns import DNS
    from scapy.layers.tls.handshake import TLSClientHello
    print('✓ SCAPY imports successful')
except Exception as e:
    print(f'✗ Still failing: {e}')
    exit(1)
" 2>&1
else
    echo "   ✓ SCAPY imports successful"
fi

# 3. Set capabilities
echo ""
echo "3. Setting network capture capabilities..."
ACTUAL_PYTHON=$($VENV_PYTHON -c "import sys; print(sys.executable)" 2>/dev/null)
# Resolve any symlinks to get the actual binary
RESOLVED_PYTHON=$(readlink -f "$ACTUAL_PYTHON" 2>/dev/null || realpath "$ACTUAL_PYTHON" 2>/dev/null || echo "$ACTUAL_PYTHON")
echo "   Python executable: $ACTUAL_PYTHON"
echo "   Resolved path: $RESOLVED_PYTHON"

if [ -f "$RESOLVED_PYTHON" ] && [ ! -L "$RESOLVED_PYTHON" ]; then
    echo "   Setting capabilities on binary..."
    sudo setcap cap_net_raw,cap_net_admin+eip "$RESOLVED_PYTHON" 2>&1
    CAPS=$(getcap "$RESOLVED_PYTHON" 2>/dev/null)
    if echo "$CAPS" | grep -q "cap_net_raw\|cap_net_admin"; then
        echo "   ✓ Capabilities set: $CAPS"
    else
        echo "   ⚠️  Could not verify capabilities (may need sudo to run backend)"
        echo "   Note: You can run backend with sudo if capabilities don't work"
    fi
elif [ -L "$RESOLVED_PYTHON" ]; then
    echo "   ⚠️  Python is a symlink, setting capabilities on the target..."
    TARGET=$(readlink -f "$RESOLVED_PYTHON")
    if [ -f "$TARGET" ]; then
        sudo setcap cap_net_raw,cap_net_admin+eip "$TARGET" 2>&1
        CAPS=$(getcap "$TARGET" 2>/dev/null)
        if echo "$CAPS" | grep -q "cap_net_raw\|cap_net_admin"; then
            echo "   ✓ Capabilities set on target: $CAPS"
        else
            echo "   ⚠️  Could not verify capabilities"
        fi
    fi
else
    echo "   ⚠️  Could not find Python executable at: $RESOLVED_PYTHON"
    echo "   You may need to run backend with sudo for packet capture"
fi

# 4. Verify everything
echo ""
echo "4. Final verification..."
echo "   Port 8000 status:"
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "   ✗ Port 8000 is still in use"
    lsof -i:8000 2>/dev/null || netstat -tulpn | grep :8000
else
    echo "   ✓ Port 8000 is free"
fi

echo ""
echo "   SCAPY status:"
$VENV_PYTHON -c "from scapy.all import get_if_list; print(f'  ✓ SCAPY working - {len(get_if_list())} interfaces found')" 2>&1 | grep -v "CryptographyDeprecationWarning" | head -1

echo ""
echo "========================================="
echo "Ready to Start Backend"
echo "========================================="
echo ""
echo "Start backend with:"
echo "  cd $BACKEND_DIR"
echo "  source venv/bin/activate"
echo "  python main.py"
echo ""
echo "Or in background:"
echo "  nohup python main.py > backend.log 2>&1 &"
echo "  tail -f backend.log"
echo ""

