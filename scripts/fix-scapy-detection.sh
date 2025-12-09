#!/bin/bash
# Fix SCAPY detection issue

echo "========================================="
echo "SCAPY Detection Fix"
echo "========================================="
echo ""

BACKEND_DIR="/home/pi/net-traffic/backend"
VENV_PYTHON="$BACKEND_DIR/venv/bin/python"

cd "$BACKEND_DIR"
source venv/bin/activate

# Test SCAPY import exactly as the backend does
echo "1. Testing SCAPY import (as backend does)..."
PYTHON_TEST='
try:
    from scapy.all import sniff, get_if_list, IP, IPv6, TCP, UDP, ICMP, ARP
    from scapy.layers.l2 import Ether
    from scapy.layers.dns import DNS
    try:
        from scapy.layers.http import HTTPRequest
    except ImportError:
        HTTPRequest = None
    SCAPY_AVAILABLE = True
    print("SCAPY_AVAILABLE = True")
    print("✓ All SCAPY imports successful")
except ImportError as e:
    SCAPY_AVAILABLE = False
    print(f"SCAPY_AVAILABLE = False")
    print(f"✗ Import error: {e}")
    exit(1)
'

$VENV_PYTHON -c "$PYTHON_TEST"

if [ $? -ne 0 ]; then
    echo ""
    echo "SCAPY import failed. Reinstalling SCAPY..."
    pip install --upgrade --force-reinstall scapy
    echo ""
    echo "Testing again..."
    $VENV_PYTHON -c "$PYTHON_TEST"
fi

echo ""
echo "2. Testing SCAPY capture capability..."
$VENV_PYTHON -c "
from scapy.all import get_if_list
interfaces = get_if_list()
print(f'Found {len(interfaces)} interfaces: {interfaces}')
"

echo ""
echo "3. Making sure port 8000 is free..."
if lsof -ti:8000 > /dev/null 2>&1 || netstat -tuln | grep -q ':8000 '; then
    echo "   Port 8000 is in use. Finding process..."
    PID=$(lsof -ti:8000 2>/dev/null || netstat -tulpn 2>/dev/null | grep ':8000 ' | awk '{print $7}' | cut -d'/' -f1 | head -1)
    if [ -n "$PID" ]; then
        echo "   Process using port 8000: PID $PID"
        ps aux | grep "$PID" | grep -v grep
        echo ""
        read -p "   Kill this process? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill "$PID" 2>/dev/null || sudo kill "$PID" 2>/dev/null
            sleep 2
            echo "   Process killed"
        else
            echo "   Skipping. You'll need to stop it manually."
        fi
    fi
else
    echo "   ✓ Port 8000 is free"
fi

echo ""
echo "========================================="
echo "Next Steps"
echo "========================================="
echo ""
echo "1. Set capabilities on Python executable:"
echo "   sudo setcap cap_net_raw,cap_net_admin+eip $($VENV_PYTHON -c 'import sys; print(sys.executable)')"
echo ""
echo "2. Start backend:"
echo "   cd $BACKEND_DIR"
echo "   source venv/bin/activate"
echo "   python main.py"
echo ""

