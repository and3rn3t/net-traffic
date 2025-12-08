# Verify API connection between Cloudflare Frontend and Raspberry Pi Backend
# Usage: .\scripts\verify-api-connection.ps1 [backend-url] [frontend-url]

param(
    [string]$BackendUrl = "http://localhost:8000",
    [string]$FrontendUrl = ""
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "API Connection Verification" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend URL: $BackendUrl"
Write-Host ""

function Test-Url {
    param([string]$Url, [int]$TimeoutSeconds = 5)
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Get-JsonFromUrl {
    param([string]$Url)
    try {
        $response = Invoke-RestMethod -Uri $Url -Method Get -ErrorAction Stop
        return $response
    } catch {
        return $null
    }
}

# 1. Test Backend Connectivity
Write-Host "1. Testing Backend Connectivity..." -ForegroundColor Yellow
if (Test-Url "$BackendUrl/api/health") {
    Write-Host "✓ Backend is reachable" -ForegroundColor Green
} else {
    Write-Host "✗ Backend is not reachable at $BackendUrl" -ForegroundColor Red
    Write-Host "  Check if backend is running and accessible" -ForegroundColor Yellow
    exit 1
}

# 2. Test Health Endpoint
Write-Host ""
Write-Host "2. Testing Health Endpoint..." -ForegroundColor Yellow
$health = Get-JsonFromUrl "$BackendUrl/api/health"
if ($health) {
    Write-Host "✓ Health endpoint responding" -ForegroundColor Green
    Write-Host "  Status: $($health.status)" -ForegroundColor Gray
    if ($health.capture) {
        Write-Host "  Capture Running: $($health.capture.running)" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ Health endpoint returned invalid response" -ForegroundColor Red
    exit 1
}

# 3. Test Packet Capture Status
Write-Host ""
Write-Host "3. Testing Packet Capture Status..." -ForegroundColor Yellow
$capture = Get-JsonFromUrl "$BackendUrl/api/capture/status"
if ($capture) {
    if ($capture.running) {
        Write-Host "✓ Packet capture is running" -ForegroundColor Green
        Write-Host "  Interface: $($capture.interface)" -ForegroundColor Gray
        Write-Host "  Packets Captured: $($capture.packets_captured)" -ForegroundColor Gray

        if ($capture.packets_captured -eq 0) {
            Write-Host "⚠ No packets captured yet. Generate some network traffic." -ForegroundColor Yellow
        }
    } else {
        Write-Host "✗ Packet capture is not running" -ForegroundColor Red
        Write-Host "  Check backend logs for errors" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ Failed to get capture status" -ForegroundColor Red
}

# 4. Test API Endpoints
Write-Host ""
Write-Host "4. Testing API Endpoints..." -ForegroundColor Yellow

$devices = Get-JsonFromUrl "$BackendUrl/api/devices"
if ($devices) {
    $deviceCount = if ($devices.Count) { $devices.Count } else { ($devices | Measure-Object).Count }
    Write-Host "✓ Devices endpoint accessible ($deviceCount devices)" -ForegroundColor Green
} else {
    Write-Host "✗ Devices endpoint not accessible" -ForegroundColor Red
}

$flows = Get-JsonFromUrl "$BackendUrl/api/flows?limit=100"
if ($flows) {
    $flowCount = if ($flows.Count) { $flows.Count } else { ($flows | Measure-Object).Count }
    Write-Host "✓ Flows endpoint accessible ($flowCount flows)" -ForegroundColor Green
} else {
    Write-Host "✗ Flows endpoint not accessible" -ForegroundColor Red
}

$analytics = Get-JsonFromUrl "$BackendUrl/api/analytics?hours=1"
if ($analytics) {
    Write-Host "✓ Analytics endpoint accessible" -ForegroundColor Green
} else {
    Write-Host "✗ Analytics endpoint not accessible" -ForegroundColor Red
}

# 5. Test CORS Configuration
Write-Host ""
Write-Host "5. Testing CORS Configuration..." -ForegroundColor Yellow
if ($FrontendUrl) {
    try {
        $headers = @{
            "Origin" = $FrontendUrl
        }
        $response = Invoke-WebRequest -Uri "$BackendUrl/api/health" -Headers $headers -Method Get -UseBasicParsing -ErrorAction Stop
        $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
        if ($corsHeader) {
            Write-Host "✓ CORS headers present" -ForegroundColor Green
            Write-Host "  Access-Control-Allow-Origin: $corsHeader" -ForegroundColor Gray
        } else {
            Write-Host "⚠ CORS headers not found. Check ALLOWED_ORIGINS configuration." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠ CORS test failed: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ Skipping CORS test (no frontend URL provided)" -ForegroundColor Yellow
    Write-Host "  Run with: .\scripts\verify-api-connection.ps1 $BackendUrl https://your-frontend.pages.dev" -ForegroundColor Gray
}

# Summary
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend URL: $BackendUrl"
Write-Host "Frontend URL: $(if ($FrontendUrl) { $FrontendUrl } else { 'Not provided' })"

if ($FrontendUrl) {
    Write-Host ""
    Write-Host "Frontend Configuration:" -ForegroundColor Yellow
    Write-Host "  VITE_API_BASE_URL=$BackendUrl" -ForegroundColor Gray
    Write-Host "  VITE_USE_REAL_API=true" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Backend Configuration:" -ForegroundColor Yellow
    Write-Host "  ALLOWED_ORIGINS should include: $FrontendUrl" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. If capture is not running, check backend logs:" -ForegroundColor Gray
Write-Host "   docker logs netinsight-backend" -ForegroundColor DarkGray
Write-Host ""
Write-Host "2. If CORS errors occur, update ALLOWED_ORIGINS in backend:" -ForegroundColor Gray
Write-Host "   ALLOWED_ORIGINS=$FrontendUrl" -ForegroundColor DarkGray
Write-Host ""
Write-Host "3. Generate network traffic to see data:" -ForegroundColor Gray
Write-Host "   Invoke-WebRequest https://www.google.com" -ForegroundColor DarkGray
Write-Host "   Test-NetConnection 8.8.8.8" -ForegroundColor DarkGray

