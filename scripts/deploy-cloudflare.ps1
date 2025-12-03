# Deploy NetInsight frontend to Cloudflare Pages (PowerShell)
# This script builds and deploys the frontend to Cloudflare Pages

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying NetInsight to Cloudflare Pages..." -ForegroundColor Cyan

# Check if wrangler is installed
try {
    $null = Get-Command wrangler -ErrorAction Stop
} catch {
    Write-Host "❌ Wrangler CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g wrangler
}

# Check if logged in to Cloudflare
try {
    $null = wrangler whoami 2>&1
} catch {
    Write-Host "⚠️  Not logged in to Cloudflare. Please run: wrangler login" -ForegroundColor Yellow
    exit 1
}

# Check environment variables
if (-not $env:VITE_API_BASE_URL) {
    Write-Host "⚠️  WARNING: VITE_API_BASE_URL not set" -ForegroundColor Yellow
    Write-Host "   Set it in Cloudflare Pages environment variables after deployment" -ForegroundColor Yellow
}

# Build the application
Write-Host "📦 Building application..." -ForegroundColor Cyan
npm run build

# Check if build was successful
if (-not (Test-Path "dist")) {
    Write-Host "❌ Build failed - dist directory not found" -ForegroundColor Red
    exit 1
}

# Deploy to Cloudflare Pages
Write-Host "☁️  Deploying to Cloudflare Pages..." -ForegroundColor Cyan
wrangler pages deploy dist --project-name=netinsight

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Go to Cloudflare Dashboard > Pages > netinsight"
Write-Host "   2. Set environment variables:"
Write-Host "      - VITE_API_BASE_URL: Your backend URL"
Write-Host "      - VITE_USE_REAL_API: true"
Write-Host "   3. Update backend ALLOWED_ORIGINS to include your Cloudflare Pages domain"
Write-Host ""
Write-Host "🔗 Your app should be available at: https://netinsight.pages.dev" -ForegroundColor Green

