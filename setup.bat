@echo off
REM Medo — One-command setup for Windows
REM Usage: Double-click this file, or run: .\setup.bat

echo.
echo   Medo - Personal AI Agent
echo   Setting up...
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [!] Node.js is not installed.
    echo   Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

echo   [+] Node.js found

REM Install backend dependencies
echo   [*] Installing dependencies...
call npm install --silent >nul 2>nul
echo   [+] Backend ready

REM Install web dependencies and build
echo   [*] Building web interface...
cd web
call npm install --silent >nul 2>nul
call npm run build --silent >nul 2>nul
cd ..
echo   [+] Web interface built

REM Create .env if needed
if not exist .env (
    echo # Medo Configuration> .env
    echo ANTHROPIC_API_KEY=>> .env
    echo MEDO_GATEWAY_PORT=18799>> .env
    echo   [+] .env created
)

REM Start gateway
echo.
echo   [*] Starting Medo...
start /b cmd /c "npx tsx src/gateway/index.ts"

REM Wait for ready
echo   [*] Waiting for Medo to be ready...
timeout /t 8 /nobreak >nul

REM Open browser
start http://localhost:18799

echo.
echo   ==========================================
echo     Medo is running!
echo.
echo     Open http://localhost:18799
echo.
echo     Close this window to stop Medo.
echo   ==========================================
echo.
pause
