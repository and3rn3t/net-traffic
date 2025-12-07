# Frontend Dockerfile for NetInsight
# Multi-stage build: build stage and nginx serving stage
# Optimized for ARM64 (Raspberry Pi 5)

# Enable BuildKit features
# syntax=docker/dockerfile:1.4

# Build arguments for conditional optimizations
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=latest
ARG NODE_ENV=production

# Stage 1: Build the application
FROM --platform=linux/arm64 node:20-alpine AS builder

WORKDIR /app

# Accept build arguments for environment variables
ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_USE_REAL_API=true

# Set environment variables for build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_USE_REAL_API=$VITE_USE_REAL_API

# Set npm configuration for better Pi 5 performance
ENV npm_config_cache=/root/.npm \
    npm_config_progress=false \
    npm_config_loglevel=warn \
    NODE_ENV=production

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies with BuildKit cache mount (speeds up rebuilds significantly)
# --prefer-offline: Use cached packages when available
# --no-audit: Skip audit (faster, security scans can be done separately)
# --no-fund: Skip funding messages
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund --no-optional

# Copy source code
COPY . .

# Build the application (use cache mount for node_modules/.cache)
RUN --mount=type=cache,target=/app/node_modules/.cache \
    npm run build

# Stage 2: Serve with nginx
FROM --platform=linux/arm64 nginx:alpine

# Labels for image metadata
LABEL maintainer="NetInsight" \
      org.opencontainers.image.title="NetInsight Frontend" \
      org.opencontainers.image.description="NetInsight Frontend Web Application" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.architecture="arm64" \
      org.opencontainers.image.platform="linux/arm64"

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Verify files were copied (combined into single RUN for smaller image)
RUN test -f /usr/share/nginx/html/index.html || (echo "ERROR: index.html not found" && exit 1)

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Test nginx configuration
RUN nginx -t || (echo "ERROR: Nginx configuration test failed" && exit 1)

# Expose port
EXPOSE 80

# Health check (simplified - just check if nginx is running)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

