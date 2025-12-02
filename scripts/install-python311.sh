#!/bin/bash
# Install Python 3.11 on Raspberry Pi OS
# This script installs Python 3.11 alongside Python 3.13

set -e

echo "🐍 Installing Python 3.11 for NetInsight..."

# Check if Python 3.11 is already available
if command -v python3.11 &> /dev/null; then
    echo "✅ Python 3.11 is already installed!"
    python3.11 --version
    exit 0
fi

echo "Installing Python 3.11 build dependencies..."
sudo apt update
sudo apt install -y \
    build-essential \
    zlib1g-dev \
    libncurses5-dev \
    libgdbm-dev \
    libnss3-dev \
    libssl-dev \
    libreadline-dev \
    libffi-dev \
    libsqlite3-dev \
    wget \
    libbz2-dev \
    liblzma-dev

echo "Downloading Python 3.11.10 source..."
cd /tmp
wget https://www.python.org/ftp/python/3.11.10/Python-3.11.10.tgz
tar -xzf Python-3.11.10.tgz
cd Python-3.11.10

echo "Configuring Python 3.11.10..."
./configure \
    --prefix=/usr/local \
    --enable-optimizations \
    --with-ensurepip=install \
    --enable-shared

echo "Building Python 3.11.10 (this will take 30-60 minutes on Raspberry Pi)..."
make -j$(nproc)

echo "Installing Python 3.11.10..."
sudo make altinstall

echo "Updating shared library cache..."
sudo ldconfig

echo "Verifying installation..."
python3.11 --version

echo ""
echo "✅ Python 3.11.10 installed successfully!"
echo ""
echo "To use Python 3.11 for NetInsight:"
echo "  cd ~/net-traffic/backend"
echo "  rm -rf venv"
echo "  python3.11 -m venv venv"
echo "  source venv/bin/activate"
echo "  pip install --upgrade pip"
echo "  pip install -r requirements.txt"

