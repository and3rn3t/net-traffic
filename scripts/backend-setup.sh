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
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
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

