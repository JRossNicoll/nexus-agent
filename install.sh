#!/bin/bash
# MEDO Installer for macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/JRossNicoll/nexus-agent/main/install.sh | bash

set -e

MEDO_DIR="$HOME/.medo"
REPO_URL="https://github.com/JRossNicoll/nexus-agent.git"

echo ""
echo "  _   _ _______  ___   _ ____  "
echo " | \ | | ____\ \/ / | | / ___| "
echo " |  \| |  _|  \  /| | | \___ \ "
echo " | |\  | |___ /  \| |_| |___) |"
echo " |_| \_|_____/_/\_\\\\____/|____/ "
echo ""
echo "  Personal AI Agent — Installer"
echo ""

# Check for Node.js
if ! command -v node &>/dev/null; then
  echo "Node.js is not installed."
  echo ""
  echo "Installing Node.js via Homebrew..."
  if ! command -v brew &>/dev/null; then
    echo "Homebrew not found. Installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
  brew install node
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "Node.js 18+ is required. You have $(node -v)."
  echo "Please update Node.js: brew install node"
  exit 1
fi

echo "Node.js $(node -v) found."

# Clone or update repository
if [ -d "$MEDO_DIR/app" ]; then
  echo "Updating existing MEDO installation..."
  cd "$MEDO_DIR/app"
  git pull --quiet
else
  echo "Downloading MEDO..."
  mkdir -p "$MEDO_DIR"
  git clone --quiet --depth 1 "$REPO_URL" "$MEDO_DIR/app"
  cd "$MEDO_DIR/app"
fi

# Install dependencies
echo "Installing dependencies (this may take a minute)..."
npm install --silent 2>/dev/null

# Build web UI
echo "Building the web interface..."
cd web && npm install --silent 2>/dev/null && npm run build --silent 2>/dev/null && cd ..

# Create .env if it doesn't exist
if [ ! -f "$MEDO_DIR/app/.env" ]; then
  cat > "$MEDO_DIR/app/.env" << 'ENVEOF'
# MEDO Configuration
# Add your API key below during onboarding
ANTHROPIC_API_KEY=
MEDO_GATEWAY_PORT=18799
MEDO_WEB_PORT=18800
ENVEOF
fi

# Create launch script
cat > "$MEDO_DIR/start.sh" << 'STARTEOF'
#!/bin/bash
cd "$HOME/.medo/app"
source .env 2>/dev/null
echo "Starting MEDO..."
npx tsx src/gateway/index.ts &
GATEWAY_PID=$!
cd web && npx next start -p ${MEDO_WEB_PORT:-18800} &
WEB_PID=$!
echo "MEDO is running!"
echo "  Web UI:  http://localhost:${MEDO_WEB_PORT:-18800}"
echo "  Gateway: http://localhost:${MEDO_GATEWAY_PORT:-18799}"
echo ""
echo "Press Ctrl+C to stop."
trap "kill $GATEWAY_PID $WEB_PID 2>/dev/null; exit" INT TERM
wait
STARTEOF
chmod +x "$MEDO_DIR/start.sh"

# Create stop script
cat > "$MEDO_DIR/stop.sh" << 'STOPEOF'
#!/bin/bash
pkill -f "medo-agent/src/gateway" 2>/dev/null
pkill -f "medo-agent/web" 2>/dev/null
echo "MEDO stopped."
STOPEOF
chmod +x "$MEDO_DIR/stop.sh"

echo ""
echo "MEDO installed successfully!"
echo ""
echo "To start MEDO:"
echo "  ~/.medo/start.sh"
echo ""
echo "Then open http://localhost:18800 in your browser."
echo "You'll be guided through setup — no technical knowledge needed."
echo ""
