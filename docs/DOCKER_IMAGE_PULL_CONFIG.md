# Docker Image Pull Configuration

## Current Setup

### ✅ What's Already Configured

1. **Base Images**: Automatically pulled on each build
   - The `--pull` flag in build commands ensures base images (python:3.11-slim, node, nginx) are always latest
   - This happens automatically in `raspberry-pi-start.sh`

2. **Application Images**: Built locally (current default)
   - `netinsight-backend:latest` and `netinsight-frontend:latest` are built from source
   - Images are built on the Raspberry Pi during startup

### ⚠️ What's NOT Configured (Yet)

- **Registry Pull**: Application images are not pulled from a container registry
- **Automatic Updates**: Images are rebuilt from source, not pulled as pre-built images

## Current Behavior

| Event             | Base Images             | Application Images     |
| ----------------- | ----------------------- | ---------------------- |
| **On Boot**       | ✅ Pulled automatically | 🔨 Built from source   |
| **Manual Start**  | ✅ Pulled automatically | 🔨 Built from source   |
| **Update Script** | ✅ Pulled automatically | 🔨 Rebuilt from source |

## Options

### Option 1: Current Setup (Build Locally) ✅ Default

**How it works:**

- Images are built on the Pi from source code
- Base images are pulled automatically (via `--pull` flag)
- Works without a container registry

**Pros:**

- No registry needed
- Always uses latest code
- Works offline

**Cons:**

- Slower startup (builds take 5-10 minutes)
- Requires build tools on Pi
- Uses more disk space

### Option 2: Pull from Registry (Recommended for Production)

**How it works:**

- Pre-built images are stored in a container registry
- Pi pulls images instead of building them
- Much faster startup (~30 seconds)

**Pros:**

- Faster startup (no build time)
- Smaller disk usage
- Can use CI/CD to build and push images
- Easier updates

**Cons:**

- Requires registry setup
- Need to build and push images to registry
- Requires internet connection

## Setting Up Automatic Registry Pulls

### Step 1: Build and Push Images to Registry

First, build and push images to your registry:

```bash
# Build for ARM64 (Raspberry Pi)
docker buildx build --platform linux/arm64 -t your-registry/netinsight-backend:latest -f backend/Dockerfile ./backend --push
docker buildx build --platform linux/arm64 -t your-registry/netinsight-frontend:latest -f Dockerfile . --push
```

**Registry Options:**

- **Docker Hub**: `dockerhub-username/netinsight-backend:latest`
- **GitHub Container Registry**: `ghcr.io/your-username/netinsight-backend:latest`
- **Private Registry**: `registry.example.com/netinsight-backend:latest`

### Step 2: Update docker-compose.yml

Replace `build:` sections with `image:` from registry:

```yaml
services:
  backend:
    # Remove build section:
    # build:
    #   context: ./backend
    #   dockerfile: Dockerfile

    # Add image from registry:
    image: your-registry/netinsight-backend:latest
    pull_policy: always # Always pull latest on startup

  frontend:
    # Remove build section:
    # build:
    #   context: .
    #   dockerfile: Dockerfile

    # Add image from registry:
    image: your-registry/netinsight-frontend:latest
    pull_policy: always # Always pull latest on startup
```

See `docker-compose.registry.yml.example` for a complete example.

### Step 3: Scripts Auto-Detect Mode

The startup scripts (`raspberry-pi-start.sh` and `raspberry-pi-update.sh`) now automatically detect:

- If `docker-compose.yml` has `image:` but no `build:` → **Pull from registry**
- If `docker-compose.yml` has `build:` → **Build locally**

No script changes needed! 🎉

### Step 4: Login to Registry (if private)

```bash
docker login your-registry
# or
docker login ghcr.io
# or
docker login docker.io
```

## Automatic Pull on Boot

When using registry mode with `pull_policy: always`:

1. **Systemd service** runs `raspberry-pi-start.sh` on boot
2. **Script detects** registry mode (no `build:` in docker-compose.yml)
3. **Pulls latest images** from registry automatically
4. **Starts containers** with latest images

**Result**: Your Pi automatically gets the latest images on every boot! ✅

## Verification

After switching to registry mode:

```bash
# Check if images are being pulled
docker compose pull

# Check image source
docker images | grep netinsight

# Verify containers are using registry images
docker compose ps
docker inspect netinsight-backend | grep Image
```

## Switching Between Modes

### Switch to Registry Mode:

1. Update `docker-compose.yml` to use `image:` instead of `build:`
2. Add `pull_policy: always`
3. Push images to your registry
4. Scripts will automatically detect and pull

### Switch Back to Build Mode:

1. Update `docker-compose.yml` to use `build:` instead of `image:`
2. Remove `pull_policy`
3. Scripts will automatically detect and build

## Summary

**Current State:**

- ✅ Base images pull automatically (always)
- 🔨 Application images build locally (default)
- 🔄 Scripts auto-detect build vs pull mode

**To Enable Registry Pulls:**

1. Build and push images to registry
2. Update `docker-compose.yml` to use `image:` with `pull_policy: always`
3. Scripts will automatically pull on boot/start

**Result:**

- Faster startup (30 seconds vs 5-10 minutes)
- Automatic updates on boot
- No build tools needed on Pi
