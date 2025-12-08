# Verify NetInsight deployment status
# Checks backend, tunnel, and connectivity

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "NetInsight Deployment Verification" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
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

# 1. Check Docker containers
Write-Host "1. Checking Docker Containers..." -ForegroundColor Yellow
Write-Host ""

$backendRunning = $false
$tunnelRunning = $false

$backendContainer = docker ps --filter "name=netinsight-backend" --format "{{.Names}}" 2>$null
if ($backendContainer -match "netinsight-backend") {
    Write-Host "✓ Backend container is running" -ForegroundColor Green
    $backendRunning = $true
    $backendStatus = docker ps --filter "name=netinsight-backend" --format "{{.Status}}" 2>$null
    Write-Host "  Status: $backendStatus" -ForegroundColor Gray
} else {
    Write-Host "✗ Backend container is NOT running" -ForegroundColor Red
    Write-Host "  Start with: docker-compose -f docker-compose.backend-with-tunnel.yml up -d backend" -ForegroundColor Gray
}

$tunnelContainer = docker ps --filter "name=netinsight-cloudflared" --format "{{.Names}}" 2>$null
if ($tunnelContainer -match "netinsight-cloudflared") {
    Write-Host "✓ Cloudflared container is running" -ForegroundColor Green
    $tunnelRunning = $true
    $tunnelStatus = docker ps --filter "name=netinsight-cloudflared" --format "{{.Status}}" 2>$null
    Write-Host "  Status: $tunnelStatus" -ForegroundColor Gray
} else {
    Write-Host "✗ Cloudflared container is NOT running" -ForegroundColor Red
    Write-Host "  Start with: docker-compose -f docker-compose.backend-with-tunnel.yml up -d cloudflared" -ForegroundColor Gray
}

Write-Host ""

# 2. Check backend health (local)
Write-Host "2. Checking Backend Health (Local)..." -ForegroundColor Yellow
Write-Host ""

if (Test-Url "http://localhost:8000/api/health") {
    Write-Host "✓ Backend is responding locally" -ForegroundColor Green

    $health = Get-JsonFromUrl "http://localhost:8000/api/health"
    if ($health) {
        Write-Host "  Status: $($health.status)" -ForegroundColor Gray
        if ($health.capture) {
            Write-Host "  Capture Running: $($health.capture.running)" -ForegroundColor Gray
            if ($health.capture.running) {
                Write-Host "  Packets Captured: $($health.capture.packets_captured)" -ForegroundColor Gray
                Write-Host "  Flows Detected: $($health.capture.flows_detected)" -ForegroundColor Gray
            }
        }
    }
} else {
    Write-Host "✗ Backend is NOT responding locally" -ForegroundColor Red
    if ($backendRunning) {
        Write-Host "  Container is running but not responding - check logs:" -ForegroundColor Yellow
        Write-Host "  docker logs netinsight-backend" -ForegroundColor Gray
    }
}

Write-Host ""

# 3. Check tunnel connectivity
Write-Host "3. Checking Cloudflare Tunnel..." -ForegroundColor Yellow
Write-Host ""

if ($tunnelRunning) {
    $tunnelLogs = docker logs netinsight-cloudflared --tail 20 2>&1
    if ($tunnelLogs -match "tunnel is now running|INF.*Your tunnel") {
        Write-Host "✓ Tunnel appears to be connected" -ForegroundColor Green

        $tunnelUrl = $tunnelLogs | Select-String -Pattern 'https://[a-zA-Z0-9.-]+\.(cfargotunnel\.com|trycloudflare\.com|andernet\.dev)' | Select-Object -First 1
        if ($tunnelUrl) {
            Write-Host "  Tunnel URL found: $($tunnelUrl.Matches.Value)" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠ Tunnel is running but connection status unclear" -ForegroundColor Yellow
        Write-Host "  Check logs: docker logs netinsight-cloudflared" -ForegroundColor Gray
    }

    if ($tunnelLogs -match "error|failed|fatal") {
        Write-Host "⚠ Errors found in tunnel logs" -ForegroundColor Yellow
        Write-Host "  Recent errors:" -ForegroundColor Gray
        $tunnelLogs | Select-String -Pattern "error|failed|fatal" -CaseSensitive:$false | Select-Object -Last 3 | ForEach-Object {
            Write-Host "    $_" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "⚠ Cannot check tunnel - container not running" -ForegroundColor Yellow
}

Write-Host ""

# 4. Check tunnel domain
Write-Host "4. Checking Tunnel Domain (net-backend.andernet.dev)..." -ForegroundColor Yellow
Write-Host ""

if (Test-Url "https://net-backend.andernet.dev/api/health" -TimeoutSeconds 10) {
    Write-Host "✓ Tunnel domain is accessible" -ForegroundColor Green

    $tunnelHealth = Get-JsonFromUrl "https://net-backend.andernet.dev/api/health"
    if ($tunnelHealth) {
        Write-Host "  Backend status via tunnel: $($tunnelHealth.status)" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ Tunnel domain is NOT accessible" -ForegroundColor Red
    Write-Host "  This could mean:" -ForegroundColor Yellow
    Write-Host "  - Tunnel is not fully connected" -ForegroundColor Gray
    Write-Host "  - DNS not propagated yet (wait a few minutes)" -ForegroundColor Gray
    Write-Host "  - SSL certificate not ready (wait 1-5 minutes)" -ForegroundColor Gray
    Write-Host "  - Config file issue" -ForegroundColor Gray
}

Write-Host ""

# 5. Check DNS resolution
Write-Host "5. Checking DNS Resolution..." -ForegroundColor Yellow
Write-Host ""

try {
    $dnsResult = Resolve-DnsName -Name "net-backend.andernet.dev" -Type CNAME -ErrorAction Stop 2>$null
    if ($dnsResult -and ($dnsResult.NameHost -match "cfargotunnel|trycloudflare")) {
        Write-Host "✓ DNS is correctly configured" -ForegroundColor Green
        Write-Host "  DNS points to: $($dnsResult.NameHost)" -ForegroundColor Gray
    } else {
        Write-Host "⚠ DNS may not be configured correctly" -ForegroundColor Yellow
        if ($dnsResult) {
            Write-Host "  Result: $($dnsResult.NameHost)" -ForegroundColor Gray
        }
        Write-Host "  Should point to: *.cfargotunnel.com or *.trycloudflare.com" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠ DNS resolution check failed or not available" -ForegroundColor Yellow
}

Write-Host ""

# 6. Check CORS configuration
Write-Host "6. Checking CORS Configuration..." -ForegroundColor Yellow
Write-Host ""

if ($backendRunning) {
    try {
        $corsEnv = docker exec netinsight-backend env 2>$null | Select-String "ALLOWED_ORIGINS"
        if ($corsEnv) {
            Write-Host "  $corsEnv" -ForegroundColor Gray

            if ($corsEnv -match "net-backend.andernet.dev|net.andernet.dev") {
                Write-Host "✓ CORS includes required domains" -ForegroundColor Green
            } else {
                Write-Host "⚠ CORS may be missing required domains" -ForegroundColor Yellow
                Write-Host "  Should include: net-backend.andernet.dev and net.andernet.dev" -ForegroundColor Gray
            }
        } else {
            Write-Host "⚠ ALLOWED_ORIGINS not found in container" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠ Could not check CORS configuration" -ForegroundColor Yellow
    }
}

Write-Host ""

# 7. Summary
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

if ($backendRunning -and $tunnelRunning) {
    Write-Host "ℹ Both backend and tunnel containers are running" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Verify tunnel domain: curl https://net-backend.andernet.dev/api/health" -ForegroundColor Gray
    Write-Host "2. Update frontend VITE_API_BASE_URL to: https://net-backend.andernet.dev" -ForegroundColor Gray
    Write-Host "3. Test frontend connection from browser" -ForegroundColor Gray
    Write-Host ""
    Write-Host "View logs:" -ForegroundColor Yellow
    Write-Host "  Backend:  docker logs -f netinsight-backend" -ForegroundColor Gray
    Write-Host "  Tunnel:   docker logs -f netinsight-cloudflared" -ForegroundColor Gray
} else {
    Write-Host "Issues found:" -ForegroundColor Yellow
    if (-not $backendRunning) {
        Write-Host "  - Backend container not running" -ForegroundColor Red
    }
    if (-not $tunnelRunning) {
        Write-Host "  - Tunnel container not running" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Start services:" -ForegroundColor Yellow
    Write-Host "  docker-compose -f docker-compose.backend-with-tunnel.yml up -d" -ForegroundColor Gray
}

Write-Host ""

