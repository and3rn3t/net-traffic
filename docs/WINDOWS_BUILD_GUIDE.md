# Building Images on Windows

Guide for building and pushing Docker images to a registry from Windows.

## Quick Start

### PowerShell Script (Recommended)

```powershell
# Run PowerShell script
.\scripts\build-and-push-images.ps1 ghcr.io/your-username

# Or via npm
npm run build:images:win
```

**Requirements:**

- Docker Desktop for Windows
- PowerShell 5.1 or later

## Prerequisites

### 1. Docker Desktop

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
2. Enable WSL 2 backend (recommended) or Hyper-V
3. Start Docker Desktop
4. Verify Docker is running:

```powershell
docker info
```

### 2. Docker Buildx

Buildx is included with Docker Desktop. Verify:

```powershell
docker buildx version
```

If not available, install:

```powershell
docker buildx install
```

## Options for Windows

### Option 1: PowerShell Script ✅ Recommended

```powershell
# Navigate to project directory
cd C:\git\net-traffic

# Run script
.\scripts\build-and-push-images.ps1 ghcr.io/your-username

# Or with npm
npm run build:images:win
```

**If you get execution policy error:**

```powershell
# Run as Administrator, then:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run with bypass (one-time):
powershell -ExecutionPolicy Bypass -File scripts\build-and-push-images.ps1 ghcr.io/your-username
```

### Option 2: Git Bash / WSL

If you have Git Bash or WSL installed:

```bash
# In Git Bash or WSL
cd /mnt/c/git/net-traffic
bash scripts/build-and-push-images.sh ghcr.io/your-username
```

### Option 3: Windows Batch Script

```cmd
# Run batch script
cd C:\git\net-traffic
scripts\build-and-push-images.bat ghcr.io/your-username
```

### Option 4: Manual Docker Commands

If scripts don't work, use Docker commands directly:

```powershell
# Login to registry
docker login ghcr.io
# or
docker login docker.io

# Build and push backend
docker buildx build `
    --platform linux/arm64 `
    --tag ghcr.io/your-username/netinsight-backend:latest `
    --file backend/Dockerfile `
    --push `
    ./backend

# Build and push frontend
docker buildx build `
    --platform linux/arm64 `
    --tag ghcr.io/your-username/netinsight-frontend:latest `
    --file Dockerfile `
    --push `
    .
```

## Common Issues

### PowerShell Execution Policy

**Error**: `cannot be loaded because running scripts is disabled`

**Solution:**

```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run with bypass (one-time):
powershell -ExecutionPolicy Bypass -File scripts\build-and-push-images.ps1
```

### Docker Not Running

**Error**: `Cannot connect to the Docker daemon`

**Solution:**

1. Start Docker Desktop
2. Wait for it to fully start (whale icon in system tray)
3. Verify: `docker info`

### Docker Buildx Not Found

**Error**: `buildx: command not found`

**Solution:**

```powershell
# Install buildx
docker buildx install

# Create builder
docker buildx create --name netinsight-builder --use --bootstrap
```

### Path Issues

**Error**: `The system cannot find the path specified`

**Solution:**

- Use forward slashes in PowerShell: `./backend/Dockerfile`
- Or use full paths: `$PWD\backend\Dockerfile`
- Ensure you're in the project root directory

### Buildx Builder Issues

**Error**: `failed to solve: failed to compute cache key`

**Solution:**

```powershell
# Remove and recreate builder
docker buildx rm netinsight-builder
docker buildx create --name netinsight-builder --use --bootstrap
```

### Registry Authentication

**Error**: `unauthorized: authentication required`

**Solution:**

```powershell
# Login to registry
docker login ghcr.io
# Enter username and token when prompted

# For GitHub Container Registry, use Personal Access Token
# Token needs 'write:packages' permission
```

## Step-by-Step Example

### Using GitHub Container Registry

1. **Create GitHub Personal Access Token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Create token with `write:packages` permission
   - Copy the token

2. **Login to GHCR:**

   ```powershell
   docker login ghcr.io
   # Username: your-github-username
   # Password: your-personal-access-token
   ```

3. **Build and Push:**

   ```powershell
   .\scripts\build-and-push-images.ps1 ghcr.io/your-username
   ```

4. **Verify:**
   ```powershell
   docker images | Select-String "netinsight"
   ```

## Alternative: Use WSL 2

If you have WSL 2 installed, you can use the Linux script:

```bash
# Open WSL terminal
wsl

# Navigate to project (Windows drives are in /mnt/)
cd /mnt/c/git/net-traffic

# Run bash script
bash scripts/build-and-push-images.sh ghcr.io/your-username
```

## Verification

After building, verify images:

```powershell
# List images
docker images | Select-String "netinsight"

# Check image details
docker inspect ghcr.io/your-username/netinsight-backend:latest

# Test pull
docker pull ghcr.io/your-username/netinsight-backend:latest
```

## Next Steps

After building and pushing:

1. Copy `docker-compose.registry.yml` to your Raspberry Pi
2. Update `docker-compose.yml` on the Pi to use registry images
3. Run `./scripts/raspberry-pi-start.sh` on the Pi

See [Registry Deployment Guide](./REGISTRY_DEPLOYMENT_GUIDE.md) for complete setup.

## Troubleshooting Summary

| Issue                  | Solution                                                                 |
| ---------------------- | ------------------------------------------------------------------------ |
| Execution policy error | `Set-ExecutionPolicy RemoteSigned` or use `-ExecutionPolicy Bypass`      |
| Docker not running     | Start Docker Desktop                                                     |
| Buildx not found       | `docker buildx install`                                                  |
| Authentication error   | `docker login your-registry`                                             |
| Path errors            | Use forward slashes or full paths                                        |
| Builder issues         | Recreate builder: `docker buildx create --name netinsight-builder --use` |
