# Frontend Dockerfile for NetInsight
# Multi-stage build: build stage and nginx serving stage
# Optimized for ARM64 (Raspberry Pi)

# Stage 1: Build the application
FROM --platform=linux/arm64 node:20-alpine as builder

WORKDIR /app

# Accept build arguments for environment variables
ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_USE_REAL_API=true

# Set environment variables for build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_USE_REAL_API=$VITE_USE_REAL_API

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM --platform=linux/arm64 nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Verify files were copied
RUN ls -la /usr/share/nginx/html/ || (echo "ERROR: No files in /usr/share/nginx/html" && exit 1)
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

