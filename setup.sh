#!/bin/bash
# Auto-Claude Setup Script
# Creates virtual environment and installs all dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  Auto-Claude Setup"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Python version
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo -e "${RED}Error: Python not found. Please install Python 3.10+${NC}"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo -e "${GREEN}Found Python $PYTHON_VERSION${NC}"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    echo -e "${GREEN}Found Node.js v$(node -v | cut -d'v' -f2)${NC}"
    if [ "$NODE_VERSION" -lt 24 ]; then
        echo -e "${YELLOW}Warning: Node.js 24+ recommended. Current: v$NODE_VERSION${NC}"
        echo -e "${YELLOW}Consider: nvm install 24 && nvm use 24${NC}"
    fi
else
    echo -e "${RED}Error: Node.js not found. Please install Node.js 24+${NC}"
    exit 1
fi

echo ""
echo "Step 1: Creating Python virtual environment..."
echo "------------------------------------------"

VENV_DIR="$SCRIPT_DIR/.venv"

if [ -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Virtual environment already exists at $VENV_DIR${NC}"
    read -p "Recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$VENV_DIR"
        $PYTHON_CMD -m venv "$VENV_DIR"
        echo -e "${GREEN}Virtual environment recreated${NC}"
    fi
else
    $PYTHON_CMD -m venv "$VENV_DIR"
    echo -e "${GREEN}Virtual environment created at $VENV_DIR${NC}"
fi

# Activate venv
source "$VENV_DIR/bin/activate"

echo ""
echo "Step 2: Installing Python dependencies..."
echo "------------------------------------------"

pip install --upgrade pip
pip install -r apps/backend/requirements.txt

echo -e "${GREEN}Python dependencies installed${NC}"

echo ""
echo "Step 3: Installing Node.js dependencies..."
echo "------------------------------------------"

# Install frontend dependencies
cd apps/frontend
npm install
cd ../..

echo -e "${GREEN}Node.js dependencies installed${NC}"

echo ""
echo "Step 4: Setting up configuration..."
echo "------------------------------------------"

# Copy .env if not exists
if [ ! -f "apps/backend/.env" ]; then
    cp apps/backend/.env.example apps/backend/.env
    echo -e "${GREEN}Created apps/backend/.env from template${NC}"
    echo -e "${YELLOW}Edit apps/backend/.env to add your configuration${NC}"
else
    echo -e "${YELLOW}apps/backend/.env already exists, skipping${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}  Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "To run Auto-Claude:"
echo ""
echo "  Desktop App (Electron):"
echo "    ./run.sh dev        # Development mode"
echo "    ./run.sh build      # Build production"
echo "    ./run.sh start      # Run production build"
echo ""
echo "  CLI Only:"
echo "    ./run.sh cli --list           # List specs"
echo "    ./run.sh cli --spec 001       # Run a spec"
echo ""
echo "  Test Integrations:"
echo "    ./run.sh test-jira            # Test JIRA connection"
echo "    ./run.sh test-gitlab          # Test GitLab connection"
echo ""
echo "To activate the virtual environment manually:"
echo "    source .venv/bin/activate"
echo ""
