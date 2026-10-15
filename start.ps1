# Learnova AI — Windows Start Script (PowerShell)
# Run from the project root: .\start.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Learnova AI - Starting..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ---- Backend ----------------------------------------------------------------
$backendDir = Join-Path $root "learnova-backend"

if (-not (Test-Path (Join-Path $backendDir "venv\Scripts\python.exe"))) {
    Write-Host "[Backend] Creating virtual environment..." -ForegroundColor Yellow
    Set-Location $backendDir
    python -m venv venv
}

# Copy .env if missing
$envFile = Join-Path $backendDir ".env"
$envExample = Join-Path $backendDir ".env.example"
if (-not (Test-Path $envFile)) {
    Write-Host "[Backend] .env not found — copying from .env.example" -ForegroundColor Yellow
    Copy-Item $envExample $envFile
    Write-Host "[Backend] Edit $envFile to add your IBM watsonx.ai or OpenAI API keys." -ForegroundColor Yellow
}

Write-Host "[Backend] Installing/verifying Python dependencies..." -ForegroundColor Green
Set-Location $backendDir
& .\venv\Scripts\pip install -q -r requirements.txt 2>$null

Write-Host "[Backend] Starting FastAPI server on http://localhost:8000 ..." -ForegroundColor Green
$backendJob = Start-Job -Name "learnova-backend" -ScriptBlock {
    param($dir)
    Set-Location $dir
    .\venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8000
} -ArgumentList $backendDir

# Wait for backend to be ready
$maxWait = 30
$waited = 0
Write-Host "[Backend] Waiting for server..." -ForegroundColor Yellow
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 2
    $waited += 2
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) {
            Write-Host "[Backend] Ready!" -ForegroundColor Green
            break
        }
    } catch { }
}

# ---- Frontend ---------------------------------------------------------------
$frontendDir = Join-Path $root "learnova-frontend"

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "[Frontend] Installing npm dependencies..." -ForegroundColor Yellow
    Set-Location $frontendDir
    npm install
}

Write-Host "[Frontend] Starting Vite dev server on http://localhost:5173 ..." -ForegroundColor Green
$frontendJob = Start-Job -Name "learnova-frontend" -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev
} -ArgumentList $frontendDir

Start-Sleep -Seconds 4

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Learnova AI is running!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend  : http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs : http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Keep running until Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 5
        # Check jobs are still alive
        if ((Get-Job -Name "learnova-backend").State -eq "Failed") {
            Write-Host "[Backend] crashed! Check logs with: Receive-Job -Name learnova-backend" -ForegroundColor Red
        }
    }
} finally {
    Write-Host "" 
    Write-Host "Stopping services..." -ForegroundColor Yellow
    Stop-Job -Name "learnova-backend" -ErrorAction SilentlyContinue
    Stop-Job -Name "learnova-frontend" -ErrorAction SilentlyContinue
    Remove-Job -Name "learnova-backend" -ErrorAction SilentlyContinue
    Remove-Job -Name "learnova-frontend" -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}
