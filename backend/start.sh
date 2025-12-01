#!/bin/bash
# Startup script for NetInsight Backend
# Usage: ./start.sh

cd "$(dirname "$0")"

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "Virtual environment not found. Creating..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found."
    if [ -f ".env.example" ]; then
        echo "Copying .env.example to .env..."
        cp .env.example .env
        echo "✅ Created .env file. Please review configuration."
    else
        echo "Creating .env file with default configuration..."
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
        echo "✅ Created .env file with defaults"
        echo "⚠️  Please review NETWORK_INTERFACE (currently: eth0)"
    fi
fi

# Start the application
echo "Starting NetInsight Backend..."
python main.py

