#!/bin/bash
# Diagnostic script for NetInsight Backend on Raspberry Pi
# Run this on your Raspberry Pi to diagnose issues
# Usage: ./scripts/diagnose-backend.sh

set -e

echo "=========================================="
echo "NetInsight Backend Diagnostic Tool"
echo "=========================================="
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

# 1. Check current directory
echo "1. Checking current directory..."
CURRENT_DIR=$(pwd)
echo "   Current directory: $CURRENT_DIR"
echo ""

# 2. Check if backend directory exists
echo "2. Checking backend directory..."
if [ -d "backend" ]; then
    print_status 0 "Backend directory exists"
    cd backend
    BACKEND_DIR=$(pwd)
else
    print_status 1 "Backend directory not found"
    echo "   Looking for backend in common locations..."
    if [ -d "/home/pi/net-traffic/backend" ]; then
        echo "   Found at /home/pi/net-traffic/backend"
        cd /home/pi/net-traffic/backend
        BACKEND_DIR=$(pwd)
    elif [ -d "~/net-traffic/backend" ]; then
        echo "   Found at ~/net-traffic/backend"
        cd ~/net-traffic/backend
        BACKEND_DIR=$(pwd)
    else
        echo "   Please navigate to your project directory and run this script again"
        exit 1
    fi
fi
echo "   Backend directory: $BACKEND_DIR"
echo ""

# 3. Check for main.py
echo "3. Checking for main.py..."
if [ -f "main.py" ]; then
    print_status 0 "main.py found"
else
    print_status 1 "main.py not found"
    exit 1
fi
echo ""

# 4. Check for virtual environment
echo "4. Checking virtual environment..."
if [ -d "venv" ]; then
    print_status 0 "Virtual environment exists"
    if [ -f "venv/bin/python3" ]; then
        print_status 0 "Python executable found in venv"
        PYTHON_VERSION=$(venv/bin/python3 --version 2>&1)
        echo "   Python version: $PYTHON_VERSION"
    else
        print_status 1 "Python executable not found in venv"
    fi
else
    print_status 1 "Virtual environment not found"
    echo "   Creating virtual environment..."
    python3 -m venv venv
    print_status $? "Virtual environment created"
fi
echo ""

# 5. Check if dependencies are installed
echo "5. Checking dependencies..."
if [ -f "venv/bin/python3" ]; then
    if venv/bin/python3 -c "import fastapi" 2>/dev/null; then
        print_status 0 "FastAPI is installed"
    else
        print_status 1 "FastAPI not installed"
        echo "   Installing dependencies..."
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
        print_status $? "Dependencies installed"
    fi
else
    print_status 1 "Cannot check dependencies - venv/bin/python3 not found"
fi
echo ""

# 6. Check for .env file
echo "6. Checking configuration..."
if [ -f ".env" ]; then
    print_status 0 ".env file exists"
    echo "   Configuration:"
    grep -E "^(NETWORK_INTERFACE|HOST|PORT|DEBUG)=" .env 2>/dev/null | sed 's/^/     /' || echo "     (no key config found)"
else
    print_status 1 ".env file not found"
    if [ -f ".env.example" ]; then
        echo "   Copying .env.example to .env..."
        cp .env.example .env
        print_status $? ".env file created"
    else
        echo "   Creating default .env file..."
        cat > .env << 'EOF'
NETWORK_INTERFACE=eth0
HOST=0.0.0.0
PORT=8000
DEBUG=false
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:80
DB_PATH=netinsight.db
DATA_RETENTION_DAYS=30
RATE_LIMIT_PER_MINUTE=120
LOG_LEVEL=INFO
USE_JSON_LOGGING=true
EOF
        print_status $? ".env file created with defaults"
    fi
fi
echo ""

# 7. Check systemd service
echo "7. Checking systemd service..."
if systemctl list-unit-files | grep -q "netinsight-backend.service"; then
    print_status 0 "Service file exists in systemd"
    echo "   Service status:"
    systemctl status netinsight-backend --no-pager -l | head -20 || true
else
    print_status 1 "Service not found in systemd"
    echo "   Service needs to be installed"
fi
echo ""

# 8. Check if service is running
echo "8. Checking if service is running..."
if systemctl is-active --quiet netinsight-backend 2>/dev/null; then
    print_status 0 "Service is running"
    echo "   Process info:"
    ps aux | grep "[p]ython.*main.py" | head -2 || true
else
    print_status 1 "Service is not running"
    echo "   Recent logs:"
    journalctl -u netinsight-backend -n 20 --no-pager 2>/dev/null || echo "     (no logs available)"
fi
echo ""

# 9. Check port availability
echo "9. Checking port 8000..."
PORT=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2 || echo "8000")
if netstat -tuln 2>/dev/null | grep -q ":$PORT " || ss -tuln 2>/dev/null | grep -q ":$PORT "; then
    echo -e "${YELLOW}⚠${NC} Port $PORT is in use"
    echo "   Checking what's using it:"
    (sudo lsof -i :$PORT 2>/dev/null || sudo netstat -tulpn | grep ":$PORT " || echo "     (cannot determine)") | head -3
else
    print_status 0 "Port $PORT is available"
fi
echo ""

# 10. Check network interface
echo "10. Checking network interface..."
INTERFACE=$(grep "^NETWORK_INTERFACE=" .env 2>/dev/null | cut -d'=' -f2 || echo "eth0")
if ip link show "$INTERFACE" &>/dev/null; then
    print_status 0 "Network interface $INTERFACE exists"
    echo "   Interface status:"
    ip link show "$INTERFACE" | grep -E "(state|UP|DOWN)" | sed 's/^/     /'
else
    print_status 1 "Network interface $INTERFACE not found"
    echo "   Available interfaces:"
    ip link show | grep -E "^[0-9]+:" | sed 's/^/     /'
fi
echo ""

# 11. Check packet capture permissions
echo "11. Checking packet capture permissions..."
if [ -f "venv/bin/python3" ]; then
    CAPS=$(getcap venv/bin/python3 2>/dev/null || echo "")
    if echo "$CAPS" | grep -q "cap_net_raw"; then
        print_status 0 "Packet capture capabilities set"
        echo "   Capabilities: $CAPS"
    else
        print_status 1 "Packet capture capabilities not set"
        echo "   Run: sudo setcap cap_net_raw,cap_net_admin=eip $(pwd)/venv/bin/python3"
    fi
else
    print_status 1 "Cannot check - venv/bin/python3 not found"
fi
echo ""

# 12. Test manual run
echo "12. Testing manual execution..."
echo "   Attempting to import main modules..."
if [ -f "venv/bin/python3" ]; then
    if timeout 5 venv/bin/python3 -c "
import sys
sys.path.insert(0, '.')
try:
    from utils.config import config
    print('     Config loaded successfully')
    print('     Host:', config.host)
    print('     Port:', config.port)
except Exception as e:
    print('     Error loading config:', str(e))
    sys.exit(1)
" 2>&1; then
        print_status 0 "Config loads successfully"
    else
        print_status 1 "Config failed to load"
    fi
else
    print_status 1 "Cannot test - venv/bin/python3 not found"
fi
echo ""

# Summary and recommendations
echo "=========================================="
echo "Summary and Recommendations"
echo "=========================================="
echo ""

if ! systemctl is-active --quiet netinsight-backend 2>/dev/null; then
    echo "To start the service:"
    echo "  1. If service is not installed:"
    echo "     cd $(dirname $BACKEND_DIR)"
    echo "     sudo ./scripts/setup-backend-service.sh"
    echo ""
    echo "  2. If service is installed but not running:"
    echo "     sudo systemctl start netinsight-backend"
    echo "     sudo systemctl status netinsight-backend"
    echo ""
    echo "  3. To test manually first:"
    echo "     cd $BACKEND_DIR"
    echo "     source venv/bin/activate"
    echo "     python main.py"
    echo ""
fi

echo "Useful commands:"
echo "  Check service:  sudo systemctl status netinsight-backend"
echo "  View logs:      sudo journalctl -u netinsight-backend -f"
echo "  Restart:        sudo systemctl restart netinsight-backend"
echo "  Test API:       curl http://localhost:8000/api/health"
echo ""

