#!/bin/bash
# Medo Installer for macOS / Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/JRossNicoll/nexus-agent/main/install.sh | bash

set -e

MEDO_DIR="$HOME/.medo"
REPO_URL="https://github.com/JRossNicoll/nexus-agent.git"
GATEWAY_PORT=18799

step() { echo "  [*] $1"; }
ok()   { echo "  [+] $1"; }
err()  { echo "  [!] $1" >&2; }

echo ""
echo "  __  __          _       "
echo " |  \/  | ___  __| | ___  "
echo " | |\/| |/ _ \/ _\` |/ _ \ "
echo " | |  | |  __/ (_| | (_) |"
echo " |_|  |_|\___|\__,_|\___/ "
echo ""
echo "  Personal AI Agent — Installer"
echo ""

# ── 1. Check Node.js ─────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  err "Node.js is not installed."
  echo ""
  if command -v brew &>/dev/null; then
    echo "  Installing Node.js via Homebrew..."
    brew install node
  else
    echo "  Please install Node.js 18+ from https://nodejs.org"
    exit 1
  fi
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  err "Node.js 18+ is required. You have $(node -v)."
  echo "  Please update: brew install node  (or visit https://nodejs.org)"
  exit 1
fi

ok "Node.js $(node -v)"

# ── 2. Check Git ─────────────────────────────────────────────────

if ! command -v git &>/dev/null; then
  err "Git is not installed."
  echo "  Please install Git: https://git-scm.com"
  exit 1
fi

ok "Git found"

# ── 3. Clone or update repository ────────────────────────────────

if [ -d "$MEDO_DIR/app" ]; then
  step "Updating existing Medo installation..."
  cd "$MEDO_DIR/app"
  git pull --quiet 2>/dev/null || true
else
  step "Downloading Medo..."
  mkdir -p "$MEDO_DIR"
  git clone --quiet --depth 1 "$REPO_URL" "$MEDO_DIR/app"
  cd "$MEDO_DIR/app"
fi

if [ ! -f "package.json" ]; then
  err "Download failed — package.json not found."
  exit 1
fi

ok "Source code ready"

# ── 4. Install backend dependencies ──────────────────────────────

step "Installing backend dependencies..."
npm install --silent 2>/dev/null
ok "Backend dependencies installed"

# ── 5. Install web dependencies and build static assets ───────────
#
# The web UI uses Next.js with output:"export" which produces static HTML
# in web/out/. The gateway serves these files via @fastify/static.
# There is NO separate web server — "next start" does not work with
# static export and is not needed.

step "Installing web dependencies..."
cd web
npm install --silent 2>/dev/null

step "Building the web interface (this may take a minute)..."
npm run build --silent 2>/dev/null
cd ..
ok "Web interface built"

# ── 6. Create .env if missing ────────────────────────────────────

if [ ! -f "$MEDO_DIR/app/.env" ]; then
  cat > "$MEDO_DIR/app/.env" << ENVEOF
# Medo Configuration
# Add your API key during onboarding or paste it here
ANTHROPIC_API_KEY=
MEDO_GATEWAY_PORT=$GATEWAY_PORT
ENVEOF
  ok ".env created"
else
  ok ".env already exists"
fi

# ── 7. Create start.sh for future manual starts ──────────────────
#
# Only starts the gateway — it serves both the API and the web UI.

cat > "$MEDO_DIR/start.sh" << 'STARTEOF'
#!/bin/bash
cd "$HOME/.medo/app"
set -a; source .env 2>/dev/null; set +a
PORT="${MEDO_GATEWAY_PORT:-18799}"

echo "Starting Medo..."
npx tsx src/gateway/index.ts &
GATEWAY_PID=$!

# Wait for gateway health endpoint
echo "  Waiting for Medo to be ready..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
    echo "  Medo is running!"
    echo "    Open http://localhost:$PORT in your browser"
    echo ""
    # Open browser (macOS / Linux)
    if command -v open &>/dev/null; then
      open "http://localhost:$PORT"
    elif command -v xdg-open &>/dev/null; then
      xdg-open "http://localhost:$PORT"
    fi
    break
  fi
  sleep 1
done

echo "Press Ctrl+C to stop."
trap "kill $GATEWAY_PID 2>/dev/null; echo 'Medo stopped.'; exit" INT TERM
wait
STARTEOF
chmod +x "$MEDO_DIR/start.sh"

# ── 8. Create stop.sh ────────────────────────────────────────────

cat > "$MEDO_DIR/stop.sh" << 'STOPEOF'
#!/bin/bash
pkill -f "tsx src/gateway/index.ts" 2>/dev/null
echo "Medo stopped."
STOPEOF
chmod +x "$MEDO_DIR/stop.sh"

# ── 9. Start the gateway now ─────────────────────────────────────
#
# The gateway serves the API on its port AND the web UI static files
# from web/out/ via @fastify/static. No separate web process is needed.

echo ""
step "Starting Medo..."

# Source .env into current shell
set -a; source "$MEDO_DIR/app/.env" 2>/dev/null; set +a

# Start gateway in background
cd "$MEDO_DIR/app"
npx tsx src/gateway/index.ts > "$MEDO_DIR/gateway.log" 2>&1 &
GATEWAY_PID=$!
ok "Gateway starting (PID $GATEWAY_PID)..."

# Wait for gateway health
step "Waiting for Medo to be ready..."
READY=false
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$GATEWAY_PORT/health" >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 1
done

if [ "$READY" = true ]; then
  ok "Medo is running on http://localhost:$GATEWAY_PORT"
else
  echo "  [~] Medo may still be starting — check $MEDO_DIR/gateway.log"
fi

# ── 10. Open browser ─────────────────────────────────────────────

sleep 1
step "Opening browser..."
if command -v open &>/dev/null; then
  open "http://localhost:$GATEWAY_PORT"
elif command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost:$GATEWAY_PORT"
fi

# ── Done ─────────────────────────────────────────────────────────

echo ""
echo "  Medo is running!"
echo ""
echo "    Open http://localhost:$GATEWAY_PORT in your browser"
echo ""
echo "  To start again later: ~/.medo/start.sh"
echo "  To stop:              ~/.medo/stop.sh"
echo "  Config: ~/.medo/app/.env"
echo "  Log:    ~/.medo/gateway.log"
echo ""
