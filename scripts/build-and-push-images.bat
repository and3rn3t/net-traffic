@echo off
REM Build and Push NetInsight Images to Registry (Windows Batch)
REM Usage: scripts\build-and-push-images.bat [registry]
REM Example: scripts\build-and-push-images.bat ghcr.io/username

setlocal enabledelayedexpansion

set "REGISTRY=%~1"

if "%REGISTRY%"=="" (
    echo ==========================================
    echo NetInsight Image Build and Push
    echo ==========================================
    echo.
    echo Registry options:
    echo   1. Docker Hub: docker.io/your-username
    echo   2. GitHub Container Registry: ghcr.io/your-username
    echo   3. Private registry: registry.example.com
    echo.
    set /p REGISTRY="Enter registry (e.g., ghcr.io/username or docker.io/username): "
    
    if "!REGISTRY!"=="" (
        echo ❌ Registry is required
        exit /b 1
    )
)

REM Remove trailing slash
set "REGISTRY=!REGISTRY:~0,-1!" 2>nul
if "!REGISTRY:~-1!"=="/" set "REGISTRY=!REGISTRY:~0,-1!"

echo.
echo Building and pushing images to: !REGISTRY!
echo.

REM Check if docker is available
where docker >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed or not in PATH
    exit /b 1
)

REM Check if docker buildx is available
docker buildx version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  docker buildx not found. Installing...
    docker buildx install
    if errorlevel 1 (
        echo ❌ Could not install buildx. Please install manually.
        exit /b 1
    )
)

REM Create buildx builder
set "BUILDER_NAME=netinsight-builder"
docker buildx inspect %BUILDER_NAME% >nul 2>&1
if errorlevel 1 (
    echo Creating buildx builder...
    docker buildx create --name %BUILDER_NAME% --use --bootstrap
    if errorlevel 1 (
        echo ⚠️  Could not create builder, using default
        set "BUILDER_NAME=default"
    )
) else (
    docker buildx use %BUILDER_NAME%
)

REM Login to registry if needed
echo.
set /p NEED_LOGIN="Do you need to login to the registry? (y/n): "
if /i "!NEED_LOGIN!"=="y" (
    echo !REGISTRY! | findstr /i "ghcr.io" >nul
    if not errorlevel 1 (
        echo Logging in to GitHub Container Registry...
        echo You'll need a GitHub Personal Access Token with 'write:packages' permission
        docker login ghcr.io
    ) else (
        echo !REGISTRY! | findstr /i "docker.io dockerhub" >nul
        if not errorlevel 1 (
            echo Logging in to Docker Hub...
            docker login docker.io
        ) else (
            echo Logging in to !REGISTRY!...
            docker login !REGISTRY!
        )
    )
)

REM Build and push backend image
echo.
echo 🔨 Building backend image for ARM64...
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "datetime=%%I"
set "timestamp=!datetime:~0,8!-!datetime:~8,6!"

docker buildx build --platform linux/arm64 --tag !REGISTRY!/netinsight-backend:latest --tag !REGISTRY!/netinsight-backend:!timestamp! --file backend\Dockerfile --push ./backend

if errorlevel 1 (
    echo ❌ Failed to build and push backend image
    exit /b 1
)

echo ✅ Backend image pushed: !REGISTRY!/netinsight-backend:latest

REM Build and push frontend image
echo.
echo 🔨 Building frontend image for ARM64...
docker buildx build --platform linux/arm64 --tag !REGISTRY!/netinsight-frontend:latest --tag !REGISTRY!/netinsight-frontend:!timestamp! --build-arg VITE_API_BASE_URL=http://localhost:8000 --build-arg VITE_USE_REAL_API=true --file Dockerfile --push .

if errorlevel 1 (
    echo ❌ Failed to build and push frontend image
    exit /b 1
)

echo ✅ Frontend image pushed: !REGISTRY!/netinsight-frontend:latest

echo.
echo ==========================================
echo ✅ Images built and pushed successfully!
echo ==========================================
echo.
echo 📋 Next Steps:
echo.
echo 1. Copy docker-compose.registry.yml to docker-compose.yml on your Pi
echo 2. On your Raspberry Pi, run: ./scripts/raspberry-pi-start.sh
echo 3. The Pi will automatically pull the latest images from the registry!
echo.

endlocal

