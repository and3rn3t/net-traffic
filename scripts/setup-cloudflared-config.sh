#!/bin/bash
# Setup script for Cloudflare Tunnel configuration
# Run this on your Raspberry Pi before starting Docker Compose

set -e

echo "========================================="
echo "Cloudflare Tunnel Configuration Setup"
echo "========================================="
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared is not installed"
    echo "   Install it first with:"
    echo "   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o ~/cloudflared"
    echo "   sudo mv ~/cloudflared /usr/local/bin/cloudflared"
    echo "   sudo chmod +x /usr/local/bin/cloudflared"
    exit 1
fi

echo "✓ cloudflared is installed"
echo ""

# Check if already logged in
if [ ! -f ~/.cloudflared/cert.pem ]; then
    echo "⚠️  Not authenticated with Cloudflare yet"
    echo ""
    echo "Step 1: Authenticate with Cloudflare"
    echo "Run: cloudflared tunnel login"
    echo "   (This will open a browser or provide a URL)"
    echo ""
    read -p "Have you completed authentication? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please run 'cloudflared tunnel login' first, then run this script again"
        exit 1
    fi
else
    echo "✓ Already authenticated with Cloudflare"
fi

echo ""

# Check if tunnel exists
echo "Checking for existing tunnel..."
TUNNELS=$(cloudflared tunnel list 2>/dev/null | grep -v "ID\|^$" || echo "")

if echo "$TUNNELS" | grep -q "netinsight-backend"; then
    echo "✓ Tunnel 'netinsight-backend' already exists"

    # Get tunnel UUID
    TUNNEL_UUID=$(cloudflared tunnel list 2>/dev/null | grep "netinsight-backend" | awk '{print $1}')
    echo "  Tunnel UUID: $TUNNEL_UUID"
else
    echo "⚠️  Tunnel 'netinsight-backend' does not exist"
    echo ""
    echo "Step 2: Create tunnel"
    echo "Run: cloudflared tunnel create netinsight-backend"
    echo ""
    read -p "Have you created the tunnel? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please run 'cloudflared tunnel create netinsight-backend' first, then run this script again"
        exit 1
    fi

    TUNNEL_UUID=$(cloudflared tunnel list 2>/dev/null | grep "netinsight-backend" | awk '{print $1}')
    echo "✓ Tunnel created: $TUNNEL_UUID"
fi

echo ""

# Check DNS route
echo "Checking DNS route..."
ROUTES=$(cloudflared tunnel route dns list 2>/dev/null || echo "")
if echo "$ROUTES" | grep -q "net-backend.andernet.dev"; then
    echo "✓ DNS route for net-backend.andernet.dev already exists"
else
    echo "⚠️  DNS route not found"
    echo ""
    echo "Step 3: Create DNS route"
    echo "Run: cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev"
    echo ""
    read -p "Have you created the DNS route? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Creating DNS route now..."
        cloudflared tunnel route dns netinsight-backend net-backend.andernet.dev
        echo "✓ DNS route created"
    fi
fi

echo ""

# Get or prompt for tunnel UUID if not already set
if [ -z "$TUNNEL_UUID" ]; then
    TUNNEL_UUID=$(cloudflared tunnel list 2>/dev/null | grep "netinsight-backend" | awk '{print $1}')
fi

if [ -z "$TUNNEL_UUID" ]; then
    echo "❌ Could not find tunnel UUID"
    echo "   Please ensure tunnel 'netinsight-backend' exists"
    exit 1
fi

# Check for credentials file
CREDS_FILE="$HOME/.cloudflared/$TUNNEL_UUID.json"
if [ ! -f "$CREDS_FILE" ]; then
    echo "❌ Credentials file not found: $CREDS_FILE"
    echo "   This should have been created when you ran 'cloudflared tunnel create'"
    echo "   Check: ls -la ~/.cloudflared/"
    exit 1
fi

echo "✓ Credentials file found: $CREDS_FILE"
echo ""

# Create config directory
CONFIG_DIR="$HOME/.cloudflared"
mkdir -p "$CONFIG_DIR"

# Check if config already exists
CONFIG_FILE="$CONFIG_DIR/config.yml"
if [ -f "$CONFIG_FILE" ]; then
    echo "⚠️  Config file already exists: $CONFIG_FILE"
    read -p "Do you want to overwrite it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing config file"
        echo "Current contents:"
        cat "$CONFIG_FILE"
        exit 0
    fi
fi

# Create config file
echo "Creating config file: $CONFIG_FILE"
cat > "$CONFIG_FILE" << EOF
tunnel: netinsight-backend
credentials-file: $CREDS_FILE

ingress:
  - hostname: net-backend.andernet.dev
    service: http://backend:8000
  - service: http_status:404
EOF

echo "✓ Config file created"
echo ""
echo "Configuration:"
echo "  Tunnel: netinsight-backend"
echo "  UUID: $TUNNEL_UUID"
echo "  Credentials: $CREDS_FILE"
echo "  Config: $CONFIG_FILE"
echo "  Hostname: net-backend.andernet.dev"
echo "  Service: http://backend:8000 (Docker service name)"
echo ""

# Validate config
echo "Validating configuration..."
if cloudflared tunnel validate --config "$CONFIG_FILE" 2>&1 | grep -q "Valid\|OK"; then
    echo "✓ Configuration is valid"
else
    echo "⚠️  Configuration validation had warnings (this may be OK)"
    cloudflared tunnel validate --config "$CONFIG_FILE"
fi

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Verify config file: cat $CONFIG_FILE"
echo "2. Start Docker Compose:"
echo "   docker-compose -f docker-compose.backend-with-tunnel.yml up -d"
echo "3. Check tunnel logs:"
echo "   docker logs -f netinsight-cloudflared"
echo "4. Test tunnel:"
echo "   curl https://net-backend.andernet.dev/api/health"
echo ""

