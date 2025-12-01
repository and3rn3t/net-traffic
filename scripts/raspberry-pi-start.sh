#!/bin/bash
# Raspberry Pi Startup Script for NetInsight
# This script ensures the latest container images are pulled before starting
# Usage: ./scripts/raspberry-pi-start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "=========================================="
echo "NetInsight Raspberry Pi Startup Script"
echo "=========================================="
echo ""

# Ensure .env file exists for backend
if [ -f "$PROJECT_DIR/scripts/ensure-env.sh" ]; then
    echo "Ensuring .env file exists..."
    bash "$PROJECT_DIR/scripts/ensure-env.sh" || echo "Warning: Could not create .env file"
    echo ""
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH"
    exit 1
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

echo "Using: $COMPOSE_CMD"
echo ""

# Check if using registry mode (has pull_policy or image from registry, no build:)
if grep -q "pull_policy:" docker-compose.yml || (grep -q "image:" docker-compose.yml && ! grep -q "build:" docker-compose.yml); then
    # Using registry - pull images
    echo "Pulling latest images from registry..."
    $COMPOSE_CMD pull --ignore-pull-failures || {
        echo "Warning: Could not pull images from registry"
        echo "Falling back to build mode..."
        $COMPOSE_CMD build --pull
    }
else
    # Using local build - build images with --pull for latest base images
    echo "Building/updating images (pulling latest base images)..."
    $COMPOSE_CMD build --pull --no-cache || {
        echo "Warning: Build with --pull failed, trying without --pull..."
        $COMPOSE_CMD build
    }
fi

# Stop existing containers if running
echo ""
echo "Stopping existing containers (if any)..."
$COMPOSE_CMD down || true

# Start containers with always pull policy
echo ""
echo "Starting containers with latest images..."
$COMPOSE_CMD up -d

# Show status
echo ""
echo "Container status:"
$COMPOSE_CMD ps

echo ""
echo "=========================================="
echo "NetInsight is starting up!"
echo "=========================================="
echo ""
echo "View logs with: $COMPOSE_CMD logs -f"
echo "Check status with: $COMPOSE_CMD ps"
echo "Stop services with: $COMPOSE_CMD down"
echo ""
echo "Backend API: http://localhost:8000"
echo "Frontend: http://localhost:80"
echo ""

