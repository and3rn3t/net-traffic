#!/bin/bash
# Build and Push NetInsight Images to Registry
# Usage: ./scripts/build-and-push-images.sh [registry]
# Example: ./scripts/build-and-push-images.sh ghcr.io/username
#          ./scripts/build-and-push-images.sh docker.io/username
#          ./scripts/build-and-push-images.sh registry.example.com

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Get registry from argument or prompt
REGISTRY="${1:-}"

if [ -z "$REGISTRY" ]; then
    echo "=========================================="
    echo "NetInsight Image Build and Push"
    echo "=========================================="
    echo ""
    echo "Registry options:"
    echo "  1. Docker Hub: docker.io/your-username"
    echo "  2. GitHub Container Registry: ghcr.io/your-username"
    echo "  3. Private registry: registry.example.com"
    echo ""
    read -p "Enter registry (e.g., ghcr.io/username or docker.io/username): " REGISTRY
    
    if [ -z "$REGISTRY" ]; then
        echo "❌ Registry is required"
        exit 1
    fi
fi

# Remove trailing slash
REGISTRY="${REGISTRY%/}"

echo ""
echo "Building and pushing images to: $REGISTRY"
echo ""

# Check if docker buildx is available
if ! docker buildx version &> /dev/null; then
    echo "⚠️  docker buildx not found. Installing..."
    docker buildx install || {
        echo "❌ Could not install buildx. Please install manually."
        exit 1
    }
fi

# Create buildx builder for multi-platform if needed
BUILDER_NAME="netinsight-builder"
if ! docker buildx inspect "$BUILDER_NAME" &> /dev/null; then
    echo "Creating buildx builder..."
    docker buildx create --name "$BUILDER_NAME" --use --bootstrap || {
        echo "⚠️  Could not create builder, using default"
        BUILDER_NAME="default"
    }
else
    docker buildx use "$BUILDER_NAME"
fi

# Login to registry if needed
echo ""
read -p "Do you need to login to the registry? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [[ "$REGISTRY" == *"ghcr.io"* ]]; then
        echo "Logging in to GitHub Container Registry..."
        echo "You'll need a GitHub Personal Access Token with 'write:packages' permission"
        docker login ghcr.io
    elif [[ "$REGISTRY" == *"docker.io"* ]] || [[ "$REGISTRY" == *"dockerhub"* ]]; then
        echo "Logging in to Docker Hub..."
        docker login docker.io
    else
        echo "Logging in to $REGISTRY..."
        docker login "$REGISTRY"
    fi
fi

# Build and push backend image
echo ""
echo "🔨 Building backend image for ARM64..."
docker buildx build \
    --platform linux/arm64 \
    --tag "$REGISTRY/netinsight-backend:latest" \
    --tag "$REGISTRY/netinsight-backend:$(date +%Y%m%d-%H%M%S)" \
    --file backend/Dockerfile \
    --push \
    ./backend

echo "✅ Backend image pushed: $REGISTRY/netinsight-backend:latest"

# Build and push frontend image
echo ""
echo "🔨 Building frontend image for ARM64..."
docker buildx build \
    --platform linux/arm64 \
    --tag "$REGISTRY/netinsight-frontend:latest" \
    --tag "$REGISTRY/netinsight-frontend:$(date +%Y%m%d-%H%M%S)" \
    --build-arg VITE_API_BASE_URL=http://localhost:8000 \
    --build-arg VITE_USE_REAL_API=true \
    --file Dockerfile \
    --push \
    .

echo "✅ Frontend image pushed: $REGISTRY/netinsight-frontend:latest"

# Create docker-compose.registry.yml
echo ""
echo "📝 Creating docker-compose.registry.yml..."
cat > docker-compose.registry.yml <<EOF
version: '3.8'

# Docker Compose configuration for registry-based deployment
# Images are pulled from registry instead of built locally

services:
  # Backend API Service
  backend:
    image: $REGISTRY/netinsight-backend:latest
    pull_policy: always
    platform: linux/arm64
    container_name: netinsight-backend
    restart: unless-stopped
    ports:
      - '8000:8000'
    environment:
      - NETWORK_INTERFACE=\${NETWORK_INTERFACE:-eth0}
      - HOST=0.0.0.0
      - PORT=8000
      - DB_PATH=/app/data/netinsight.db
      - ALLOWED_ORIGINS=\${ALLOWED_ORIGINS:-http://localhost,http://localhost:80,http://localhost:3000}
      - DEBUG=\${DEBUG:-false}
      - DATA_RETENTION_DAYS=\${DATA_RETENTION_DAYS:-30}
      - RATE_LIMIT_PER_MINUTE=\${RATE_LIMIT_PER_MINUTE:-120}
    volumes:
      - backend-data:/app/data
    networks:
      - netinsight-network
    cap_add:
      - NET_ADMIN
      - NET_RAW
    privileged: false
    healthcheck:
      test:
        ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:8000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Frontend Web Application
  frontend:
    image: $REGISTRY/netinsight-frontend:latest
    pull_policy: always
    platform: linux/arm64
    container_name: netinsight-frontend
    restart: unless-stopped
    ports:
      - '80:80'
    networks:
      - netinsight-network
    healthcheck:
      test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost/health']
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    depends_on:
      - backend

volumes:
  backend-data:
    driver: local
    name: netinsight-backend-data

networks:
  netinsight-network:
    driver: bridge
    name: netinsight-network
EOF

echo "✅ Created docker-compose.registry.yml"
echo ""
echo "=========================================="
echo "✅ Images built and pushed successfully!"
echo "=========================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Copy docker-compose.registry.yml to docker-compose.yml on your Pi:"
echo "   cp docker-compose.registry.yml docker-compose.yml"
echo ""
echo "2. Or update your existing docker-compose.yml to use:"
echo "   image: $REGISTRY/netinsight-backend:latest"
echo "   image: $REGISTRY/netinsight-frontend:latest"
echo "   pull_policy: always"
echo ""
echo "3. On your Raspberry Pi, run:"
echo "   ./scripts/raspberry-pi-start.sh"
echo ""
echo "The Pi will automatically pull the latest images from the registry!"
echo ""

