#!/bin/bash
# Ensure .env file exists with proper configuration
# Creates .env from template if it doesn't exist

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
ENV_FILE="$BACKEND_DIR/.env"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"

cd "$BACKEND_DIR"

# Function to create .env file with defaults
create_env_file() {
    echo "Creating .env file with default configuration..."
    cat > "$ENV_FILE" << 'EOF'
# NetInsight Backend Configuration
# Generated automatically - edit as needed

# Network Interface (REQUIRED for packet capture)
# For port mirroring setups, typically eth0
NETWORK_INTERFACE=eth0

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=false

# CORS Configuration
# Comma-separated list of allowed origins
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:80

# Database Configuration
DB_PATH=netinsight.db

# Data Retention (days)
DATA_RETENTION_DAYS=30

# Rate Limiting (requests per minute)
RATE_LIMIT_PER_MINUTE=120

# Enhanced Identification Features
ENABLE_DNS_TRACKING=true
ENABLE_REVERSE_DNS=true
REVERSE_DNS_TIMEOUT=2.0
REVERSE_DNS_RETRIES=2
ENABLE_SERVICE_FINGERPRINTING=true
ENABLE_DEEP_PACKET_INSPECTION=true
ENABLE_HTTP_HOST_EXTRACTION=true
ENABLE_ALPN_DETECTION=true

# Logging
LOG_LEVEL=INFO
USE_JSON_LOGGING=true

# Redis (optional - caching will be disabled if not available)
REDIS_HOST=localhost
REDIS_PORT=6379
EOF
    echo "✅ Created .env file with default configuration"
    echo "⚠️  Please review and update NETWORK_INTERFACE if needed (currently: eth0)"
}

# Check if .env exists
if [ -f "$ENV_FILE" ]; then
    echo "✅ .env file already exists at $ENV_FILE"
    exit 0
fi

# Try to copy from .env.example if it exists
if [ -f "$ENV_EXAMPLE" ]; then
    echo "📋 Copying .env.example to .env..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "✅ Created .env from .env.example"
    echo "⚠️  Please review and update configuration as needed"
    exit 0
fi

# Create .env with defaults
create_env_file

