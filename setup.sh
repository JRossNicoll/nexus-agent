#!/bin/bash
# Medo — One-command setup
# Usage: ./setup.sh
#
# This script installs dependencies, builds the web UI, and starts Medo.
# Run it from the repo root after cloning.

set -e

GATEWAY_PORT=18799

step() { printf "  \033[36m[*]\033[0m %s\n" "$1"; }
ok()   { printf "  \033[32m[+]\033[0m %s\n" "$1"; }
err()  { printf "  \033[31m[!]\033[0m %s\n" "$1" >&2; }

echo ""
echo "  __  __          _       "
echo " |  \/  | ___  __| | ___  "
echo " | |\/| |/ _ \/ _\` |/ _ \ "
echo " | |  | |  __/ (_| | (_) |"
echo " |_|  |_|\___|\__,_|\___/ "
echo ""
echo "  Setting up Medo..."
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  err "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  err "Node.js 18+ required (you have $(node -v)). Please update."
  exit 1
fi
ok "Node.js $(node -v)"

# Install backend dependencies
step "Installing dependencies..."
npm install --silent 2>/dev/null
ok "Backend ready"

# Install web dependencies and build
step "Building web interface..."
cd web && npm install --silent 2>/dev/null && npm run build --silent 2>/dev/null && cd ..
ok "Web interface built"

# Create .env if needed
if [ ! -f .env ]; then
  cat > .env << 'ENVEOF'
# Medo Configuration
# Your API key will be set during onboarding in the web UI
ANTHROPIC_API_KEY=
MEDO_GATEWAY_PORT=18799
ENVEOF
  ok ".env created"
fi

# Start gateway
echo ""
step "Starting Medo..."
set -a; source .env 2>/dev/null; set +a

npx tsx src/gateway/index.ts &
GATEWAY_PID=$!

# Wait for ready
READY=false
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$GATEWAY_PORT/health" >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 1
done

if [ "$READY" = true ]; then
  ok "Medo is running!"
else
  echo "  [~] Still starting — check console output above for errors"
fi

# Open browser
sleep 1
if command -v open &>/dev/null; then
  open "http://localhost:$GATEWAY_PORT"
elif command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost:$GATEWAY_PORT" 2>/dev/null
fi

echo ""
echo "  ┌──────────────────────────────────────┐"
echo "  │  Medo is running!                    │"
echo "  │                                      │"
echo "  │  Open http://localhost:$GATEWAY_PORT        │"
echo "  │                                      │"
echo "  │  Press Ctrl+C to stop                │"
echo "  └──────────────────────────────────────┘"
echo ""

trap "kill $GATEWAY_PID 2>/dev/null; echo ''; echo 'Medo stopped.'; exit" INT TERM
wait
