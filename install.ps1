# NEXUS Installer for Windows
# Usage: iwr -useb https://raw.githubusercontent.com/JRossNicoll/nexus-agent/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$NEXUS_DIR = "$env:USERPROFILE\.nexus"
$REPO_URL = "https://github.com/JRossNicoll/nexus-agent.git"

Write-Host ""
Write-Host "  NEXUS - Personal AI Agent Installer" -ForegroundColor Cyan
Write-Host ""

# Check for Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "Node.js is not installed." -ForegroundColor Yellow
    Write-Host "Downloading Node.js installer..."
    $nodeInstaller = "$env:TEMP\node-setup.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi" -OutFile $nodeInstaller
    Write-Host "Installing Node.js (this will open an installer window)..."
    Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /quiet" -Wait
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
}

$nodeVersion = (node -v) -replace 'v', '' -split '\.' | Select-Object -First 1
if ([int]$nodeVersion -lt 18) {
    Write-Host "Node.js 18+ is required. You have $(node -v)." -ForegroundColor Red
    Write-Host "Please update Node.js from https://nodejs.org"
    exit 1
}

Write-Host "Node.js $(node -v) found." -ForegroundColor Green

# Check for Git
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Host "Git is not installed." -ForegroundColor Yellow
    Write-Host "Please install Git from https://git-scm.com/download/win"
    exit 1
}

# Clone or update repository
if (Test-Path "$NEXUS_DIR\app") {
    Write-Host "Updating existing NEXUS installation..."
    Set-Location "$NEXUS_DIR\app"
    git pull --quiet
} else {
    Write-Host "Downloading NEXUS..."
    New-Item -ItemType Directory -Force -Path $NEXUS_DIR | Out-Null
    git clone --quiet --depth 1 $REPO_URL "$NEXUS_DIR\app"
    Set-Location "$NEXUS_DIR\app"
}

# Install dependencies
Write-Host "Installing dependencies..."
npm install --silent 2>$null

# Build web UI
Write-Host "Building the web interface..."
Set-Location web
npm install --silent 2>$null
npm run build --silent 2>$null
Set-Location ..

# Create .env if it doesn't exist
$envFile = "$NEXUS_DIR\app\.env"
if (-not (Test-Path $envFile)) {
    @"
# NEXUS Configuration
ANTHROPIC_API_KEY=
NEXUS_GATEWAY_PORT=18799
NEXUS_WEB_PORT=18800
"@ | Out-File -FilePath $envFile -Encoding utf8
}

# Create start script
@"
@echo off
cd /d "%USERPROFILE%\.nexus\app"
echo Starting NEXUS...
start /b cmd /c "npx tsx src/gateway/index.ts"
cd web
start /b cmd /c "npx next start -p 18800"
echo.
echo NEXUS is running!
echo   Web UI:  http://localhost:18800
echo   Gateway: http://localhost:18799
echo.
echo Close this window to stop NEXUS.
pause
"@ | Out-File -FilePath "$NEXUS_DIR\start.bat" -Encoding ascii

Write-Host ""
Write-Host "NEXUS installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To start NEXUS:" -ForegroundColor Cyan
Write-Host "  $NEXUS_DIR\start.bat"
Write-Host ""
Write-Host "Then open http://localhost:18800 in your browser."
Write-Host "You'll be guided through setup."
Write-Host ""
