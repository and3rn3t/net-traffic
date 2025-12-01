# Registry Deployment - Quick Start

Deploy NetInsight using pre-built images from a container registry for faster installations.

## 🚀 Quick Setup (3 Steps)

### 1. Build and Push Images

On your development machine:

**Windows:**

```powershell
# PowerShell script (recommended)
.\scripts\build-and-push-images.ps1 ghcr.io/your-username
# or
npm run build:images:win
```

**Linux/Mac:**

```bash
# Build and push to registry
npm run build:images
# or
./scripts/build-and-push-images.sh ghcr.io/your-username
```

**See [Windows Build Guide](./docs/WINDOWS_BUILD_GUIDE.md) for Windows-specific help.**

This builds ARM64 images and pushes them to your registry.

### 2. Configure Raspberry Pi

On your Raspberry Pi:

```bash
# Setup to use registry images
npm run setup:registry ghcr.io/your-username
# or
./scripts/setup-registry-deployment.sh ghcr.io/your-username
```

This updates `docker-compose.yml` to pull from registry instead of building.

### 3. Start Services

```bash
# Pull and start (images pull automatically)
./scripts/raspberry-pi-start.sh
```

That's it! Images will automatically pull on every boot.

## 📋 Registry Options

### GitHub Container Registry (Recommended)

```bash
./scripts/build-and-push-images.sh ghcr.io/your-username
```

### Docker Hub

```bash
./scripts/build-and-push-images.sh docker.io/your-username
```

### Private Registry

```bash
./scripts/build-and-push-images.sh registry.example.com
```

## ✅ Benefits

- ⚡ **Fast startup**: 30 seconds vs 5-10 minutes
- 🔄 **Automatic updates**: Pull latest on boot
- 💾 **Less disk space**: No build tools needed
- 🚀 **Easy deployment**: Just pull images

## 📚 Full Documentation

See [Registry Deployment Guide](./docs/REGISTRY_DEPLOYMENT_GUIDE.md) for complete details.
