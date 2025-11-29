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

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

