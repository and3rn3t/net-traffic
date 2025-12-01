#!/bin/bash
# Raspberry Pi Update Script for NetInsight
# This script pulls the latest code and rebuilds containers
# Usage: ./scripts/raspberry-pi-update.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "=========================================="
echo "NetInsight Raspberry Pi Update Script"
echo "=========================================="
echo ""

# Check if git is available and we're in a git repo
if command -v git &> /dev/null && [ -d ".git" ]; then
    echo "Pulling latest code from git..."
    git pull || echo "Warning: Could not pull from git (may not be a git repo or no remote configured)"
    echo ""
fi

# Use docker compose (v2) if available, otherwise docker-compose (v1)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif docker-compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "Error: docker-compose is not available"
    exit 1
fi

# Check if using registry mode (has pull_policy or image from registry, no build:)
if grep -q "pull_policy:" docker-compose.yml || (grep -q "image:" docker-compose.yml && ! grep -q "build:" docker-compose.yml); then
    # Using registry - pull images
    echo "Pulling latest images from registry..."
    $COMPOSE_CMD pull || echo "Warning: Could not pull images from registry"
else
    # Using local build - rebuild images with latest base images
    echo "Rebuilding images with latest base images..."
    $COMPOSE_CMD build --pull
fi

# Restart containers
echo ""
echo "Restarting containers..."
$COMPOSE_CMD up -d

# Show status
echo ""
echo "Container status:"
$COMPOSE_CMD ps

echo ""
echo "=========================================="
echo "Update complete!"
echo "=========================================="
echo ""

