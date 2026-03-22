#!/bin/bash
# Validate NEXUS installer scripts exist and are well-formed
set -e

PASS=0
FAIL=0
TOTAL=0

check() {
  TOTAL=$((TOTAL + 1))
  if eval "$2"; then
    echo "  PASS: $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $1"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== NEXUS Installer Validation ==="
echo ""

# Mac installer
echo "--- Mac Installer (install.sh) ---"
check "install.sh exists" "[ -f install.sh ]"
check "install.sh is executable" "[ -x install.sh ]"
check "install.sh has shebang" "head -1 install.sh | grep -q '#!/bin/bash'"
check "install.sh checks for Node.js" "grep -q 'command -v node' install.sh"
check "install.sh clones repo" "grep -q 'git clone' install.sh"
check "install.sh runs npm install" "grep -q 'npm install' install.sh"
check "install.sh builds web UI" "grep -q 'npm run build' install.sh"
check "install.sh creates .env" "grep -q '.env' install.sh"
check "install.sh creates start script" "grep -q 'start.sh' install.sh"
check "install.sh opens web UI port" "grep -q '18800' install.sh"

# Windows installer
echo ""
echo "--- Windows Installer (install.ps1) ---"
check "install.ps1 exists" "[ -f install.ps1 ]"
check "install.ps1 checks for Node.js" "grep -q 'Get-Command node' install.ps1"
check "install.ps1 checks for Git" "grep -q 'Get-Command git' install.ps1"
check "install.ps1 clones repo" "grep -q 'git clone' install.ps1"
check "install.ps1 runs npm install" "grep -q 'npm install' install.ps1"
check "install.ps1 builds web UI" "grep -q 'npm run build' install.ps1"
check "install.ps1 creates start script" "grep -q 'start.bat' install.ps1"
check "install.ps1 opens web UI port" "grep -q '18800' install.ps1"

echo ""
echo "=== Results: $PASS/$TOTAL passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && echo "ALL PASSED" || echo "SOME FAILED"
exit $FAIL
