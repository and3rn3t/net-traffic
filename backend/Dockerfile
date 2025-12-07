# Backend Dockerfile for NetInsight API
# Multi-stage build for optimized image size
# Optimized for ARM64 (Raspberry Pi 5)

# Enable BuildKit features
# syntax=docker/dockerfile:1.4

# Build arguments for conditional optimizations
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=latest
ARG PIP_INDEX_URL=https://pypi.org/simple

# Stage 1: Build dependencies
FROM --platform=linux/arm64 python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpcap-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip to latest version for better performance and security
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy requirements and install Python dependencies with BuildKit cache mount
COPY requirements.txt .
# Use cache mount for pip cache (speeds up rebuilds significantly on Pi 5)
# --no-warn-script-location: Suppress warnings about scripts not in PATH
# --user: Install to user directory to avoid conflicts
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir --no-warn-script-location --user -r requirements.txt

# Stage 2: Runtime image
FROM --platform=linux/arm64 python:3.11-slim

# Labels for image metadata
LABEL maintainer="NetInsight" \
      org.opencontainers.image.title="NetInsight Backend" \
      org.opencontainers.image.description="NetInsight Backend API for network traffic analysis" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.architecture="arm64" \
      org.opencontainers.image.platform="linux/arm64"

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    iputils-ping \
    libpcap0.8 \
    net-tools \
    tcpdump \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Copy application code (only necessary files, .dockerignore handles exclusions)
COPY . .

# Create directory for database with proper permissions
RUN mkdir -p /app/data && chmod 777 /app/data

# Set Python optimizations for Pi 5 (optional, can be overridden)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/health || exit 1

# Run the application
CMD ["python", "main.py"]

