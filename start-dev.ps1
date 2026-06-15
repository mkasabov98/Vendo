# command to run the script: .\start-dev.ps1

# ── 0. Docker Desktop check ───────────────────────────────────────────────────
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nDocker Desktop is not running. Please open it and wait for it to finish starting, then re-run this script." -ForegroundColor Red
    exit 1
}

# ── 1. MySQL container ────────────────────────────────────────────────────────
Write-Host "`n[1/3] Starting MySQL container..." -ForegroundColor Cyan

$containerStatus = docker inspect --format "{{.State.Status}}" ecommerce-mysql 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Container 'ecommerce-mysql' not found. Run 'docker-compose up -d' from the DB folder first." -ForegroundColor Red
    exit 1
}

if ($containerStatus -eq "running") {
    Write-Host "      MySQL already running." -ForegroundColor Green
} else {
    docker start ecommerce-mysql | Out-Null
    Write-Host "      Container started. Waiting for MySQL to be ready..." -ForegroundColor Yellow

    $ready = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 2
        docker exec ecommerce-mysql mysqladmin ping -u root -prootpassword --silent 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Write-Host "      Still waiting... ($([int](($i+1)*2))s)" -ForegroundColor DarkGray
    }

    if (-not $ready) {
        Write-Host "MySQL did not become ready after 40s. Check: docker logs ecommerce-mysql" -ForegroundColor Red
        exit 1
    }

    Write-Host "      MySQL is ready." -ForegroundColor Green
}

# ── 2. Backend ────────────────────────────────────────────────────────────────
Write-Host "`n[2/3] Starting backend (http://localhost:3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\BE'; npm run dev"

# ── 3. Frontend ───────────────────────────────────────────────────────────────
Write-Host "`n[3/3] Starting frontend (http://localhost:4200)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\FE'; npm start"

Write-Host "`nAll services started." -ForegroundColor Green
Write-Host "  Storefront : http://localhost:4200" -ForegroundColor White
Write-Host "  Admin      : http://localhost:4200/admin" -ForegroundColor White
Write-Host "  Backend    : http://localhost:3000" -ForegroundColor White
Write-Host "`n(Stripe webhooks: run 'stripe listen --forward-to localhost:3000/order/webhook' separately if testing checkout)`n" -ForegroundColor DarkGray
