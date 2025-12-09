#!/bin/bash
# Fix SCAPY installation and permissions for host backend

echo "========================================="
echo "SCAPY & Permissions Fix Script"
echo "========================================="
echo ""

BACKEND_DIR="/home/pi/net-traffic/backend"
VENV_PYTHON="$BACKEND_DIR/venv/bin/python"

# 1. Check if venv exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo "✗ Virtual environment not found at: $VENV_PYTHON"
    echo "  Creating virtual environment..."
    cd "$BACKEND_DIR"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment found"
fi

# 2. Install SCAPY in venv
echo ""
echo "1. Installing SCAPY in virtual environment..."
cd "$BACKEND_DIR"
source venv/bin/activate

if "$VENV_PYTHON" -c "import scapy" 2>/dev/null; then
    SCAPY_VERSION=$("$VENV_PYTHON" -c "import scapy; print(scapy.__version__)" 2>&1)
    echo "   ✓ SCAPY is already installed (version: $SCAPY_VERSION)"
else
    echo "   Installing SCAPY..."
    pip install scapy 2>&1 | grep -E "(Requirement|Installing|Successfully|ERROR)" || pip install scapy

    # Verify installation
    if "$VENV_PYTHON" -c "import scapy" 2>/dev/null; then
        SCAPY_VERSION=$("$VENV_PYTHON" -c "import scapy; print(scapy.__version__)" 2>&1)
        echo "   ✓ SCAPY installed successfully (version: $SCAPY_VERSION)"
    else
        echo "   ✗ Failed to install SCAPY"
        echo "   Try manually: cd $BACKEND_DIR && source venv/bin/activate && pip install scapy"
        exit 1
    fi
fi

# 3. Set capabilities on venv Python
echo ""
echo "2. Setting network capture capabilities..."
VENV_PYTHON_ABS=$(readlink -f "$VENV_PYTHON" || realpath "$VENV_PYTHON")

if [ -f "$VENV_PYTHON_ABS" ]; then
    echo "   Setting capabilities on: $VENV_PYTHON_ABS"
    sudo setcap cap_net_raw,cap_net_admin+eip "$VENV_PYTHON_ABS" 2>&1

    # Verify capabilities
    CAPS=$(getpcaps "$(pgrep -f "$VENV_PYTHON" | head -1)" 2>/dev/null || getcap "$VENV_PYTHON_ABS" 2>/dev/null)
    if echo "$CAPS" | grep -q "cap_net_raw\|cap_net_admin"; then
        echo "   ✓ Capabilities set successfully"
        echo "   Capabilities: $CAPS"
    else
        echo "   ⚠️  Could not verify capabilities (may need to restart backend to see effect)"
    fi
else
    echo "   ✗ Could not find Python executable: $VENV_PYTHON_ABS"
    echo "   You may need to set capabilities manually:"
    echo "     sudo setcap cap_net_raw,cap_net_admin+eip $VENV_PYTHON_ABS"
fi

# 4. Test SCAPY in venv
echo ""
echo "3. Testing SCAPY in virtual environment..."
TEST_RESULT=$("$VENV_PYTHON" -c "
import sys
try:
    from scapy.all import get_if_list, sniff
    interfaces = get_if_list()
    print(f'SCAPY_OK: Found {len(interfaces)} interfaces')
    if 'eth0' in interfaces:
        print('Interface eth0 found')
    else:
        print(f'Available: {interfaces[:3]}...')
except ImportError as e:
    print(f'SCAPY_IMPORT_ERROR: {e}')
    sys.exit(1)
except Exception as e:
    print(f'SCAPY_ERROR: {e}')
    sys.exit(1)
" 2>&1)

echo "$TEST_RESULT" | while IFS= read -r line; do
    echo "   $line"
done

if echo "$TEST_RESULT" | grep -q "SCAPY_OK"; then
    echo "   ✓ SCAPY test passed"
else
    echo "   ✗ SCAPY test failed"
    exit 1
fi

# 5. Instructions
echo ""
echo "========================================="
echo "Next Steps"
echo "========================================="
echo ""
echo "SCAPY is installed and capabilities are set."
echo "You need to restart the backend for changes to take effect:"
echo ""
echo "1. Stop the current backend:"
echo "   pkill -f 'python.*main.py'"
echo ""
echo "2. Start the backend:"
echo "   cd $BACKEND_DIR"
echo "   source venv/bin/activate"
echo "   python main.py"
echo ""
echo "   Or run in background:"
echo "   nohup python main.py > backend.log 2>&1 &"
echo ""
echo "3. Verify packet capture is running:"
echo "   curl http://localhost:8000/api/capture/status"
echo ""
echo "4. Check health:"
echo "   curl http://localhost:8000/api/health | jq '.capture.running'"
echo ""

