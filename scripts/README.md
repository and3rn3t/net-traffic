# NetInsight Raspberry Pi Scripts

This directory contains scripts for managing NetInsight on Raspberry Pi with Docker.

## Scripts

### `raspberry-pi-start.sh`

Main startup script that ensures the latest container images are built and started.

**Features:**

- Builds optimized ARM64 images for Raspberry Pi
- Pulls latest base images during build (`--pull` flag)
- Stops existing containers before starting new ones
- Starts all services with automatic restart policy

**Usage:**

```bash
./scripts/raspberry-pi-start.sh
```

**What it does:**

1. Checks for Docker/Docker Compose availability
2. Builds images with `--pull` to get latest base images
3. Stops any running containers
4. Starts containers in detached mode
5. Shows container status

### `raspberry-pi-update.sh`

Update script that pulls latest code and rebuilds containers.

**Features:**

- Pulls latest code from git (if available)
- Rebuilds images with latest base images
- Restarts containers with new images

**Usage:**

```bash
./scripts/raspberry-pi-update.sh
```

**What it does:**

1. Pulls latest code from git repository
2. Rebuilds images with `--pull` flag
3. Restarts containers
4. Shows container status

### `netinsight.service`

Systemd service file for automatic startup on boot.

**Setup:**

```bash
# Copy to systemd directory
sudo cp scripts/netinsight.service /etc/systemd/system/

# Edit paths if needed
sudo nano /etc/systemd/system/netinsight.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable netinsight
sudo systemctl start netinsight
```

**Important:** Update the `WorkingDirectory` and paths in the service file to match your installation location.

## Container Image Optimization

The Dockerfiles and docker-compose.yml are optimized for Raspberry Pi:

- **Platform:** All images specify `linux/arm64` platform
- **Base Images:** Use ARM64-compatible base images (node:20-alpine, python:3.11-slim, nginx:alpine)
- **Multi-stage Builds:** Optimized for smaller image sizes
- **Automatic Updates:** Startup script pulls latest base images on each run

## Automatic Image Updates

The containers are configured to always use the latest base images:

1. **On Boot:** The systemd service runs `raspberry-pi-start.sh` which builds with `--pull`
2. **Manual Update:** Run `raspberry-pi-update.sh` to pull code and rebuild
3. **Base Images:** The `--pull` flag ensures base images (node, python, nginx) are always latest

## Using a Container Registry (Optional)

If you push images to a container registry (Docker Hub, GitHub Container Registry, etc.):

1. **Build and push images:**

```bash
docker buildx build --platform linux/arm64 -t your-registry/netinsight-backend:latest ./backend --push
docker buildx build --platform linux/arm64 -t your-registry/netinsight-frontend:latest . --push
```

2. **Update docker-compose.yml to use registry images:**

```yaml
backend:
  image: your-registry/netinsight-backend:latest
  # Remove build section if using pre-built images
```

3. **Uncomment pull commands in scripts:**
   The scripts have commented sections for pulling from registry - uncomment those if using a registry.

## Troubleshooting

### Scripts not executable

```bash
chmod +x scripts/*.sh
```

### Docker permission denied

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Containers not starting

```bash
# Check logs
docker compose logs

# Check status
docker compose ps

# Rebuild from scratch
docker compose build --no-cache
docker compose up -d
```

### Images not updating

The `--pull` flag in the build command ensures base images are updated. If you're using a registry, make sure to uncomment the pull commands in the scripts.
