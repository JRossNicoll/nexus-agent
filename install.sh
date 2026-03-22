#!/bin/bash
# NEXUS Installer for macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/JRossNicoll/nexus-agent/main/install.sh | bash

set -e

NEXUS_DIR="$HOME/.nexus"
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
if [ -d "$NEXUS_DIR/app" ]; then
  echo "Updating existing NEXUS installation..."
  cd "$NEXUS_DIR/app"
  git pull --quiet
else
  echo "Downloading NEXUS..."
  mkdir -p "$NEXUS_DIR"
  git clone --quiet --depth 1 "$REPO_URL" "$NEXUS_DIR/app"
  cd "$NEXUS_DIR/app"
fi

# Install dependencies
echo "Installing dependencies (this may take a minute)..."
npm install --silent 2>/dev/null

# Build web UI
echo "Building the web interface..."
cd web && npm install --silent 2>/dev/null && npm run build --silent 2>/dev/null && cd ..

# Create .env if it doesn't exist
if [ ! -f "$NEXUS_DIR/app/.env" ]; then
  cat > "$NEXUS_DIR/app/.env" << 'ENVEOF'
# NEXUS Configuration
# Add your API key below during onboarding
ANTHROPIC_API_KEY=
NEXUS_GATEWAY_PORT=18799
NEXUS_WEB_PORT=18800
ENVEOF
fi

# Create launch script
cat > "$NEXUS_DIR/start.sh" << 'STARTEOF'
#!/bin/bash
cd "$HOME/.nexus/app"
source .env 2>/dev/null
echo "Starting NEXUS..."
npx tsx src/gateway/index.ts &
GATEWAY_PID=$!
cd web && npx next start -p ${NEXUS_WEB_PORT:-18800} &
WEB_PID=$!
echo "NEXUS is running!"
echo "  Web UI:  http://localhost:${NEXUS_WEB_PORT:-18800}"
echo "  Gateway: http://localhost:${NEXUS_GATEWAY_PORT:-18799}"
echo ""
echo "Press Ctrl+C to stop."
trap "kill $GATEWAY_PID $WEB_PID 2>/dev/null; exit" INT TERM
wait
STARTEOF
chmod +x "$NEXUS_DIR/start.sh"

# Create stop script
cat > "$NEXUS_DIR/stop.sh" << 'STOPEOF'
#!/bin/bash
pkill -f "nexus-agent/src/gateway" 2>/dev/null
pkill -f "nexus-agent/web" 2>/dev/null
echo "NEXUS stopped."
STOPEOF
chmod +x "$NEXUS_DIR/stop.sh"

echo ""
echo "NEXUS installed successfully!"
echo ""
echo "To start NEXUS:"
echo "  ~/.nexus/start.sh"
echo ""
echo "Then open http://localhost:18800 in your browser."
echo "You'll be guided through setup — no technical knowledge needed."
echo ""
