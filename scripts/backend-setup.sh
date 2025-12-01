#!/bin/bash
# Backend Setup Script
# Sets up Python virtual environment and installs dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"

cd "$BACKEND_DIR"

echo "🐍 Setting up Python backend environment..."

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found."
    if [ -f ".env.example" ]; then
        echo "Copying .env.example to .env..."
        cp .env.example .env
        echo "✅ Created .env file. Please edit it with your configuration."
    else
        echo "⚠️  .env.example not found. Please create a .env file manually."
    fi
fi

echo ""
echo "✅ Backend setup complete!"
echo ""
echo "To activate the virtual environment:"
echo "  source backend/venv/bin/activate"
echo ""
echo "To start the backend:"
echo "  cd backend && python main.py"
echo "  or"
echo "  cd backend && ./start.sh"

