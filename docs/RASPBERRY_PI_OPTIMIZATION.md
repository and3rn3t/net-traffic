# Raspberry Pi Container Optimization

This document describes the optimizations made to the container setup for Raspberry Pi deployment with automatic latest image pulling.

## Optimizations Summary

### 1. ARM64 Platform Support

**Dockerfiles Updated:**

- `Dockerfile` (Frontend) - Added `--platform=linux/arm64` to both build stages
- `backend/Dockerfile` (Backend) - Added `--platform=linux/arm64` to both build stages

**Benefits:**

- Ensures images are built specifically for ARM64 architecture
- Prevents architecture mismatch errors
- Optimized for Raspberry Pi 4/5 performance

### 2. Docker Compose Configuration

**docker-compose.yml Updates:**

- Added `platform: linux/arm64` to both services
- Added `platforms: [linux/arm64]` to build configurations
- Added `image:` tags for both services to enable image management

**Benefits:**

- Explicit platform specification prevents cross-architecture issues
- Image tags enable easier image management and updates

### 3. Automatic Latest Image Pulling

**Startup Scripts Created:**

- `scripts/raspberry-pi-start.sh` - Main startup script
- `scripts/raspberry-pi-update.sh` - Update script

**Features:**

- Uses `docker compose build --pull` to ensure latest base images
- Automatically stops and restarts containers
- Provides status information after startup

**How it works:**

1. On startup, the script builds images with `--pull` flag
2. This pulls the latest base images (node:20-alpine, python:3.11-slim, nginx:alpine)
3. Rebuilds application layers on top of latest bases
4. Starts containers with the updated images

### 4. Systemd Service Integration

**Service File:**

- `scripts/netinsight.service` - Systemd service for automatic boot startup

**Features:**

- Automatically runs on boot
- Executes startup script which pulls latest images
- Handles container lifecycle management
- Provides logging via journalctl

## Usage

### Initial Setup

```bash
# Make scripts executable
chmod +x scripts/raspberry-pi-start.sh
chmod +x scripts/raspberry-pi-update.sh

# Start containers (pulls latest base images)
./scripts/raspberry-pi-start.sh
```

### Automatic Startup on Boot

```bash
# Copy service file
sudo cp scripts/netinsight.service /etc/systemd/system/

# Edit paths if needed
sudo nano /etc/systemd/system/netinsight.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable netinsight
sudo systemctl start netinsight
```

### Manual Update

```bash
# Pull latest code and rebuild
./scripts/raspberry-pi-update.sh
```

## How Latest Images Are Pulled

### On Boot

1. Systemd service starts
2. Executes `raspberry-pi-start.sh`
3. Script runs `docker compose build --pull`
4. Docker pulls latest base images from registry
5. Rebuilds application layers
6. Starts containers

### Manual Update

1. Run `raspberry-pi-update.sh`
2. Pulls latest code (if git repo)
3. Runs `docker compose build --pull`
4. Restarts containers

### Base Images Updated

- `node:20-alpine` - Frontend build and runtime
- `python:3.11-slim` - Backend runtime
- `nginx:alpine` - Frontend web server

## Container Registry Integration (Optional)

If you want to push pre-built images to a registry:

1. **Build and push:**

```bash
docker buildx build --platform linux/arm64 \
  -t your-registry/netinsight-backend:latest \
  ./backend --push

docker buildx build --platform linux/arm64 \
  -t your-registry/netinsight-frontend:latest \
  . --push
```

2. **Update docker-compose.yml:**

```yaml
backend:
  image: your-registry/netinsight-backend:latest
  # Remove or comment build section
```

3. **Uncomment pull commands in scripts:**
   The scripts have commented sections for `docker compose pull` - uncomment if using a registry.

## Performance Considerations

### Image Size Optimization

- Multi-stage builds reduce final image size
- Alpine-based images are smaller
- Only runtime dependencies in final images

### Build Time

- First build: ~5-10 minutes (downloads base images)
- Subsequent builds: ~2-5 minutes (uses cached layers)
- With `--pull`: Adds ~30 seconds to check for base image updates

### Runtime Performance

- ARM64 native images run efficiently on Raspberry Pi
- No emulation overhead
- Optimized for ARM architecture

## Troubleshooting

### Images not updating

- Check internet connection (needs to pull from Docker Hub)
- Verify `--pull` flag is used in build command
- Check Docker Hub rate limits

### Build failures

- Ensure Docker has enough disk space
- Check Docker daemon is running: `sudo systemctl status docker`
- Review build logs: `docker compose build --no-cache`

### Service not starting on boot

- Check service status: `sudo systemctl status netinsight`
- View logs: `sudo journalctl -u netinsight -f`
- Verify paths in service file are correct
- Ensure Docker service starts before netinsight service

## Files Modified

1. `Dockerfile` - Added ARM64 platform specification
2. `backend/Dockerfile` - Added ARM64 platform specification
3. `docker-compose.yml` - Added platform specifications and image tags
4. `scripts/raspberry-pi-start.sh` - New startup script
5. `scripts/raspberry-pi-update.sh` - New update script
6. `scripts/netinsight.service` - New systemd service file
7. `docs/DEPLOYMENT_RASPBERRY_PI.md` - Updated with Docker deployment section

## Next Steps

1. Test on Raspberry Pi hardware
2. Set up container registry (optional)
3. Configure automatic backups
4. Set up monitoring and alerting
5. Optimize for specific Raspberry Pi model (4 vs 5)
