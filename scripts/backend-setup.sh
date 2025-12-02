#!/bin/bash
# Backend Setup Script
# Sets up Python virtual environment and installs dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"

cd "$BACKEND_DIR"

echo "🐍 Setting up Python backend environment..."

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11 (recommended) or 3.12."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
PYTHON_FULL_VERSION=$PYTHON_VERSION
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
PYTHON_PATCH=$(echo $PYTHON_VERSION | cut -d. -f3)

echo "Detected Python version: $PYTHON_FULL_VERSION"

# Check for Python 3.13+ (has compatibility issues)
if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 13 ]; then
    echo "❌ ERROR: Python $PYTHON_VERSION detected."
    echo "   Python 3.13+ has compatibility issues with pydantic-core and other packages."
    echo ""
    echo "   Solutions:"
    echo "   1. Use the system Python 3.11 (if available):"
    echo "      python3.11 -m venv venv"
    echo ""
    echo "   2. Or downgrade Python (advanced, not recommended)"
    echo ""
    echo "   3. Or install build dependencies and compile from source (slow):"
    echo "      sudo apt install build-essential python3-dev libpcap-dev libffi-dev libssl-dev rustc cargo"
    read -p "Continue anyway? (NOT recommended - may fail) (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    echo "⚠️  Proceeding with Python 3.13 - installation may fail or be very slow"
elif [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]); then
    echo "❌ ERROR: Python $PYTHON_VERSION is too old."
    echo "   Python 3.10 or higher is required."
    exit 1
elif [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -eq 10 ]; then
    echo "✅ Python 3.10 detected (compatible, but 3.11+ recommended)"
    PYTHON_CMD="python3"
elif [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -eq 11 ]; then
    echo "✅ Python 3.11 detected (recommended)"
    PYTHON_CMD="python3"
elif [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -eq 12 ]; then
    echo "✅ Python 3.12 detected (compatible)"
    PYTHON_CMD="python3"
else
    echo "✅ Python $PYTHON_VERSION detected (assuming compatible)"
    PYTHON_CMD="python3"
fi

# Remove old venv if it exists and has issues
if [ -d "venv" ]; then
    echo "Existing virtual environment found."
    read -p "Remove and recreate? (recommended if having installation issues) (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing old virtual environment..."
        rm -rf venv
    fi
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment with $PYTHON_CMD..."
    $PYTHON_CMD -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install system build dependencies (needed for some packages)
echo "Installing system build dependencies..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update -qq

    # Base build dependencies
    BUILD_DEPS="build-essential python3-dev libpcap-dev libffi-dev libssl-dev"

    # If Python 3.13+, also need Rust for compiling pydantic-core
    if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 13 ]; then
        echo "⚠️  Python 3.13 detected - installing Rust compiler (this may take a while)..."
        BUILD_DEPS="$BUILD_DEPS rustc cargo"
    fi

    sudo apt-get install -y -qq $BUILD_DEPS || {
        echo "⚠️  Could not install all build dependencies"
        if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 13 ]; then
            echo "   For Python 3.13, Rust is required to compile pydantic-core"
            echo "   Try: sudo apt install rustc cargo"
        fi
    }
fi

# Install dependencies
echo "Installing Python dependencies..."
echo "This may take several minutes on Raspberry Pi..."
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found."
    if [ -f ".env.example" ]; then
        echo "Copying .env.example to .env..."
        cp .env.example .env
        echo "✅ Created .env file. Please edit it with your configuration."
    elif [ -f "$SCRIPT_DIR/ensure-env.sh" ]; then
        echo "Creating .env file with defaults..."
        bash "$SCRIPT_DIR/ensure-env.sh"
    else
        echo "⚠️  .env.example not found. Creating .env with defaults..."
        cat > .env << 'EOF'
# NetInsight Backend Configuration
NETWORK_INTERFACE=eth0
HOST=0.0.0.0
PORT=8000
DEBUG=false
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:80
DB_PATH=netinsight.db
DATA_RETENTION_DAYS=30
RATE_LIMIT_PER_MINUTE=120
ENABLE_DNS_TRACKING=true
ENABLE_REVERSE_DNS=true
REVERSE_DNS_TIMEOUT=2.0
REVERSE_DNS_RETRIES=2
ENABLE_SERVICE_FINGERPRINTING=true
ENABLE_DEEP_PACKET_INSPECTION=true
ENABLE_HTTP_HOST_EXTRACTION=true
ENABLE_ALPN_DETECTION=true
LOG_LEVEL=INFO
USE_JSON_LOGGING=true
REDIS_HOST=localhost
REDIS_PORT=6379
EOF
        echo "✅ Created .env file with default configuration"
        echo "⚠️  Please review and update NETWORK_INTERFACE if needed"
    fi
fi

echo ""
echo "✅ Backend setup complete!"
echo ""
echo "To activate the virtual environment:"
echo "  source backend/venv/bin/activate"
echo ""
echo "To start the backend:"
echo "  cd backend && python main.py"
echo "  or"
echo "  cd backend && ./start.sh"

