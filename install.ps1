# Medo Installer for Windows
# Usage: powershell -ExecutionPolicy Bypass -File .\install.ps1

# IMPORTANT: Do NOT set $ErrorActionPreference = "Stop" globally.
# npm/node write informational messages to stderr which PowerShell treats as
# terminating NativeCommandErrors under "Stop" mode. This was the root cause
# of the gateway start failure after a successful Next.js build.
# Instead we check $LASTEXITCODE after each critical command.

$MEDO_DIR = "$env:USERPROFILE\.medo"
$REPO_URL = "https://github.com/JRossNicoll/nexus-agent.git"
$GATEWAY_PORT = 18799

function Write-Step($msg) { Write-Host "  [*] $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  [+] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "  [!] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "  Medo - Personal AI Agent Installer" -ForegroundColor Cyan
Write-Host ""

# -- 1. Check Node.js -------------------------------------------------

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Err "Node.js is not installed."
    Write-Host "  Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

$nodeVersion = (node -v) -replace 'v', '' -split '\.' | Select-Object -First 1
if ([int]$nodeVersion -lt 18) {
    Write-Err "Node.js 18+ is required. You have $(node -v)."
    Write-Host "  Please update from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

Write-OK "Node.js $(node -v)"

# -- 2. Check Git ------------------------------------------------------

$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Err "Git is not installed."
    Write-Host "  Please install Git from https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

Write-OK "Git found"

# -- 3. Clone or update repository ------------------------------------

if (Test-Path "$MEDO_DIR\app") {
    Write-Step "Updating existing Medo installation..."
    Push-Location "$MEDO_DIR\app"
    git pull --quiet 2>&1 | Out-Null
    Pop-Location
} else {
    Write-Step "Downloading Medo..."
    New-Item -ItemType Directory -Force -Path $MEDO_DIR | Out-Null
    git clone --quiet --depth 1 $REPO_URL "$MEDO_DIR\app" 2>&1 | Out-Null
}

if (-not (Test-Path "$MEDO_DIR\app\package.json")) {
    Write-Err "Download failed - package.json not found."
    exit 1
}

Write-OK "Source code ready"

# -- 4. Install backend dependencies ----------------------------------

Write-Step "Installing backend dependencies..."
Push-Location "$MEDO_DIR\app"
$output = npm install 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install failed for backend."
    Write-Host $output -ForegroundColor Gray
    Pop-Location
    exit 1
}
Pop-Location
Write-OK "Backend dependencies installed"

# -- 5. Install web dependencies and build static assets ---------------
#
# The web UI uses Next.js with output:"export" which produces static HTML
# in web/out/. The gateway serves these files via @fastify/static.
# There is NO separate web server — "next start" does not work with
# static export and is not needed.

Write-Step "Installing web dependencies..."
Push-Location "$MEDO_DIR\app\web"
$output = npm install 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install failed for web."
    Write-Host $output -ForegroundColor Gray
    Pop-Location
    exit 1
}

Write-Step "Building the web interface (this may take a minute)..."
$output = npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "Web build failed."
    Write-Host $output -ForegroundColor Gray
    Pop-Location
    exit 1
}
Pop-Location
Write-OK "Web interface built"

# -- 6. Create .env if missing ----------------------------------------

$envFile = "$MEDO_DIR\app\.env"
if (-not (Test-Path $envFile)) {
    @"
# Medo Configuration
ANTHROPIC_API_KEY=
MEDO_GATEWAY_PORT=$GATEWAY_PORT
"@ | Out-File -FilePath $envFile -Encoding utf8 -NoNewline
    Write-OK ".env created"
} else {
    Write-OK ".env already exists"
}

# -- 7. Create start.bat for future manual starts ---------------------
#
# Only starts the gateway — it serves both the API and the web UI.

@"
@echo off
cd /d "%USERPROFILE%\.medo\app"
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "%%a=%%b"
)
echo Starting Medo...
start /b cmd /c "npx tsx src/gateway/index.ts"
echo.
echo Medo is starting...
echo   Web UI + Gateway: http://localhost:18799
echo.
timeout /t 8 /nobreak >nul
start http://localhost:18799
echo.
echo Medo is running! Close this window to stop.
pause
"@ | Out-File -FilePath "$MEDO_DIR\start.bat" -Encoding ascii
Write-OK "start.bat created"

# -- 8. Start the gateway now -----------------------------------------
#
# The gateway serves the API on port 18799 AND the web UI static files
# from web/out/ via @fastify/static. No separate web process is needed.

Write-Host ""
Write-Step "Starting Medo..."

# Load .env values into current process environment
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
            $parts = $line -split '=', 2
            $key = $parts[0].Trim()
            $val = $parts[1].Trim()
            if ($key) {
                [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
            }
        }
    }
}

# Start gateway in a hidden background process
$gatewayProc = Start-Process -FilePath "npx" `
    -ArgumentList "tsx src/gateway/index.ts" `
    -WorkingDirectory "$MEDO_DIR\app" `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardError "$MEDO_DIR\gateway-err.log"

Write-OK "Gateway starting (PID $($gatewayProc.Id))..."

# Wait for the gateway health endpoint to respond
Write-Step "Waiting for Medo to be ready..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:$GATEWAY_PORT/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        # Not ready yet, keep waiting
    }
}

if ($ready) {
    Write-OK "Medo is running on http://localhost:$GATEWAY_PORT"
} else {
    Write-Host "  [~] Medo may still be starting - check $MEDO_DIR\gateway-err.log if it fails" -ForegroundColor Yellow
}

# -- 9. Open browser ---------------------------------------------------

Start-Sleep -Seconds 1
Write-Step "Opening browser..."
Start-Process "http://localhost:$GATEWAY_PORT"

# -- Done --------------------------------------------------------------

Write-Host ""
Write-Host "  Medo is running!" -ForegroundColor Green
Write-Host ""
Write-Host "    Open http://localhost:$GATEWAY_PORT in your browser" -ForegroundColor White
Write-Host ""
Write-Host "  To start again later: $MEDO_DIR\start.bat" -ForegroundColor Gray
Write-Host "  Config file: $MEDO_DIR\app\.env" -ForegroundColor Gray
Write-Host "  Error log:   $MEDO_DIR\gateway-err.log" -ForegroundColor Gray
Write-Host ""
