# Build and Push NetInsight Images to Registry (PowerShell)
# Usage: .\scripts\build-and-push-images.ps1 [registry]
# Example: .\scripts\build-and-push-images.ps1 ghcr.io/username
#          .\scripts\build-and-push-images.ps1 docker.io/username

param(
    [string]$Registry = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

Set-Location $ProjectDir

# Get registry from argument or prompt
if ([string]::IsNullOrEmpty($Registry)) {
    Write-Host "=========================================="
    Write-Host "NetInsight Image Build and Push"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "Registry options:"
    Write-Host "  1. Docker Hub: docker.io/your-username"
    Write-Host "  2. GitHub Container Registry: ghcr.io/your-username"
    Write-Host "  3. Private registry: registry.example.com"
    Write-Host ""
    $Registry = Read-Host "Enter registry (e.g., ghcr.io/username or docker.io/username)"
    
    if ([string]::IsNullOrEmpty($Registry)) {
        Write-Host "❌ Registry is required" -ForegroundColor Red
        exit 1
    }
}

# Remove trailing slash
$Registry = $Registry.TrimEnd('/')

Write-Host ""
Write-Host "Building and pushing images to: $Registry" -ForegroundColor Cyan
Write-Host ""

# Check if docker is available
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker is not installed or not in PATH" -ForegroundColor Red
    Write-Host "   Please install Docker Desktop for Windows" -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running" -ForegroundColor Red
    Write-Host "   Please start Docker Desktop" -ForegroundColor Yellow
    exit 1
}

# Check if docker buildx is available
docker buildx version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  docker buildx not found. Installing..." -ForegroundColor Yellow
    docker buildx install 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Could not install buildx. Please install manually." -ForegroundColor Red
        Write-Host "   Or ensure Docker Desktop is running and up to date." -ForegroundColor Yellow
        exit 1
    }
}

# Create buildx builder for multi-platform if needed
$BuilderName = "netinsight-builder"
$builderCheck = docker buildx inspect $BuilderName 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating buildx builder..." -ForegroundColor Cyan
    docker buildx create --name $BuilderName --use --bootstrap 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Could not create builder, using default" -ForegroundColor Yellow
        $BuilderName = "default"
        docker buildx use $BuilderName 2>&1 | Out-Null
    }
} else {
    docker buildx use $BuilderName 2>&1 | Out-Null
}

# Login to registry if needed
Write-Host ""
$needLogin = Read-Host "Do you need to login to the registry? (y/n)"
if ($needLogin -eq "y" -or $needLogin -eq "Y") {
    if ($Registry -like "*ghcr.io*") {
        Write-Host "Logging in to GitHub Container Registry..." -ForegroundColor Cyan
        Write-Host "You'll need a GitHub Personal Access Token with 'write:packages' permission"
        docker login ghcr.io
    } elseif ($Registry -like "*docker.io*" -or $Registry -like "*dockerhub*") {
        Write-Host "Logging in to Docker Hub..." -ForegroundColor Cyan
        docker login docker.io
    } else {
        Write-Host "Logging in to $Registry..." -ForegroundColor Cyan
        docker login $Registry
    }
}

# Build and push backend image
Write-Host ""
Write-Host "🔨 Building backend image for ARM64..." -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
docker buildx build `
    --platform linux/arm64 `
    --tag "$Registry/netinsight-backend:latest" `
    --tag "$Registry/netinsight-backend:$timestamp" `
    --file backend/Dockerfile `
    --push `
    ./backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build and push backend image" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backend image pushed: $Registry/netinsight-backend:latest" -ForegroundColor Green

# Build and push frontend image
Write-Host ""
Write-Host "🔨 Building frontend image for ARM64..." -ForegroundColor Cyan
docker buildx build `
    --platform linux/arm64 `
    --tag "$Registry/netinsight-frontend:latest" `
    --tag "$Registry/netinsight-frontend:$timestamp" `
    --build-arg VITE_API_BASE_URL=http://localhost:8000 `
    --build-arg VITE_USE_REAL_API=true `
    --file Dockerfile `
    --push `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build and push frontend image" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Frontend image pushed: $Registry/netinsight-frontend:latest" -ForegroundColor Green

# Create docker-compose.registry.yml
Write-Host ""
Write-Host "📝 Creating docker-compose.registry.yml..." -ForegroundColor Cyan

$composeContent = @"
version: '3.8'

# Docker Compose configuration for registry-based deployment
# Images are pulled from registry instead of built locally

services:
  # Backend API Service
  backend:
    image: $Registry/netinsight-backend:latest
    pull_policy: always
    platform: linux/arm64
    container_name: netinsight-backend
    restart: unless-stopped
    ports:
      - '8000:8000'
    environment:
      - NETWORK_INTERFACE=`${NETWORK_INTERFACE:-eth0}
      - HOST=0.0.0.0
      - PORT=8000
      - DB_PATH=/app/data/netinsight.db
      - ALLOWED_ORIGINS=`${ALLOWED_ORIGINS:-http://localhost,http://localhost:80,http://localhost:3000}
      - DEBUG=`${DEBUG:-false}
      - DATA_RETENTION_DAYS=`${DATA_RETENTION_DAYS:-30}
      - RATE_LIMIT_PER_MINUTE=`${RATE_LIMIT_PER_MINUTE:-120}
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
    image: $Registry/netinsight-frontend:latest
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
"@

$composeContent | Out-File -FilePath "docker-compose.registry.yml" -Encoding utf8

Write-Host "✅ Created docker-compose.registry.yml" -ForegroundColor Green
Write-Host ""
Write-Host "=========================================="
Write-Host "✅ Images built and pushed successfully!" -ForegroundColor Green
Write-Host "=========================================="
Write-Host ""
Write-Host "📋 Next Steps:"
Write-Host ""
Write-Host "1. Copy docker-compose.registry.yml to docker-compose.yml on your Pi:"
Write-Host "   cp docker-compose.registry.yml docker-compose.yml"
Write-Host ""
Write-Host "2. Or update your existing docker-compose.yml to use:"
Write-Host "   image: $Registry/netinsight-backend:latest"
Write-Host "   image: $Registry/netinsight-frontend:latest"
Write-Host "   pull_policy: always"
Write-Host ""
Write-Host "3. On your Raspberry Pi, run:"
Write-Host "   ./scripts/raspberry-pi-start.sh"
Write-Host ""
Write-Host "The Pi will automatically pull the latest images from the registry!" -ForegroundColor Green
Write-Host ""

