# Registry Deployment Guide

Complete guide for deploying NetInsight using pre-built images from a container registry.

## Overview

Instead of building images on the Raspberry Pi (which takes 5-10 minutes), you can:

1. Build images once on a development machine
2. Push them to a container registry
3. Pull pre-built images on the Pi (takes ~30 seconds)

## Quick Start

### Step 1: Build and Push Images

```bash
# Build and push to your registry
npm run build:images
# or
./scripts/build-and-push-images.sh ghcr.io/your-username
```

This will:

- Build ARM64 images for Raspberry Pi
- Push to your registry
- Create `docker-compose.registry.yml` with correct configuration

### Step 2: Configure Pi for Registry

On your Raspberry Pi:

```bash
# Setup registry deployment
npm run setup:registry ghcr.io/your-username
# or
./scripts/setup-registry-deployment.sh ghcr.io/your-username
```

This updates `docker-compose.yml` to pull from registry.

### Step 3: Start Services

```bash
# Pull and start (will pull images automatically)
./scripts/raspberry-pi-start.sh
```

## Registry Options

### GitHub Container Registry (Recommended)

**Pros:**

- Free for public repos
- Integrated with GitHub
- No rate limits for public images

**Setup:**

```bash
# Login with GitHub token
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Build and push
./scripts/build-and-push-images.sh ghcr.io/your-username
```

**Image URLs:**

- `ghcr.io/your-username/netinsight-backend:latest`
- `ghcr.io/your-username/netinsight-frontend:latest`

### Docker Hub

**Pros:**

- Most widely used
- Simple setup
- Free for public repos

**Setup:**

```bash
# Login
docker login docker.io

# Build and push
./scripts/build-and-push-images.sh docker.io/your-username
```

**Image URLs:**

- `docker.io/your-username/netinsight-backend:latest`
- `docker.io/your-username/netinsight-frontend:latest`

### Private Registry

**Pros:**

- Full control
- Private images
- Custom domain

**Setup:**

```bash
# Login
docker login registry.example.com

# Build and push
./scripts/build-and-push-images.sh registry.example.com
```

## Manual Setup

### 1. Build Images

```bash
# Backend
docker buildx build \
    --platform linux/arm64 \
    --tag your-registry/netinsight-backend:latest \
    --file backend/Dockerfile \
    --push \
    ./backend

# Frontend
docker buildx build \
    --platform linux/arm64 \
    --tag your-registry/netinsight-frontend:latest \
    --file Dockerfile \
    --push \
    .
```

### 2. Update docker-compose.yml

Replace `build:` sections with `image:`:

```yaml
services:
  backend:
    # Remove this:
    # build:
    #   context: ./backend
    #   dockerfile: Dockerfile

    # Add this:
    image: your-registry/netinsight-backend:latest
    pull_policy: always

  frontend:
    # Remove this:
    # build:
    #   context: .
    #   dockerfile: Dockerfile

    # Add this:
    image: your-registry/netinsight-frontend:latest
    pull_policy: always
```

### 3. Pull and Start

```bash
# Pull images
docker compose pull

# Start services
docker compose up -d
```

## Automatic Updates

With `pull_policy: always` configured:

### On Boot

- Systemd service runs `raspberry-pi-start.sh`
- Script detects registry mode
- Automatically pulls latest images
- Starts containers

### Manual Update

```bash
# Pull latest images
docker compose pull

# Restart services
docker compose up -d
```

Or use the update script:

```bash
./scripts/raspberry-pi-update.sh
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Push Images

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push backend
        run: |
          docker buildx build \
            --platform linux/arm64 \
            --tag ghcr.io/${{ github.repository_owner }}/netinsight-backend:latest \
            --file backend/Dockerfile \
            --push \
            ./backend

      - name: Build and push frontend
        run: |
          docker buildx build \
            --platform linux/arm64 \
            --tag ghcr.io/${{ github.repository_owner }}/netinsight-frontend:latest \
            --file Dockerfile \
            --push \
            .
```

## Verification

### Check Images

```bash
# List pulled images
docker images | grep netinsight

# Check image source
docker inspect netinsight-backend | grep -A 5 "Config"
```

### Test Pull

```bash
# Test pulling images
docker compose pull

# Should see:
# Pulling backend...
# Pulling frontend...
```

### Verify Configuration

```bash
# Check docker-compose.yml has pull_policy
grep -A 2 "pull_policy" docker-compose.yml

# Check images are from registry
grep "image:" docker-compose.yml
```

## Troubleshooting

### Images Not Pulling

**Problem**: Images not found in registry

**Solution**:

1. Verify images are pushed: `docker images | grep netinsight`
2. Check registry URL in `docker-compose.yml`
3. Ensure you're logged in: `docker login your-registry`

### Authentication Errors

**Problem**: `unauthorized: authentication required`

**Solution**:

```bash
# Login to registry
docker login your-registry

# For GHCR, use GitHub token
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

### Wrong Architecture

**Problem**: Images built for wrong platform

**Solution**:

```bash
# Ensure ARM64 builds
docker buildx build --platform linux/arm64 ...
```

### Pull Policy Not Working

**Problem**: Images not updating

**Solution**:

1. Verify `pull_policy: always` in `docker-compose.yml`
2. Force pull: `docker compose pull --force`
3. Check script detection: Scripts auto-detect registry mode

## Switching Between Modes

### Switch to Registry Mode

```bash
./scripts/setup-registry-deployment.sh your-registry
```

### Switch Back to Build Mode

```bash
# Restore from backup
cp docker-compose.yml.backup.* docker-compose.yml

# Or manually add build: sections back
```

## Benefits

| Aspect                | Build Mode             | Registry Mode |
| --------------------- | ---------------------- | ------------- |
| **Startup Time**      | 5-10 minutes           | ~30 seconds   |
| **Disk Space**        | Higher (build tools)   | Lower         |
| **Internet Required** | No (after first build) | Yes           |
| **Updates**           | Rebuild needed         | Pull latest   |
| **CI/CD**             | Manual                 | Automated     |

## Summary

✅ **Registry deployment is now fully configured!**

1. **Build once**: `npm run build:images`
2. **Configure Pi**: `npm run setup:registry`
3. **Automatic pulls**: Images pull on boot/start
4. **Fast updates**: Just pull latest images

Your Raspberry Pi will now use pre-built images from the registry, making deployments much faster and easier!
