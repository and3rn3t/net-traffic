# Docker Setup Guide for NetInsight

Complete guide for running NetInsight in Docker containers.

## Overview

This Docker setup provides:

- **Backend**: FastAPI service with packet capture capabilities
- **Frontend**: React/Vite application served via nginx
- **Docker Compose**: Orchestrates both services with networking

## Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- Linux host (for packet capture - see notes below)

## Quick Start

### 1. Clone and Navigate

```bash
git clone <repository-url>
cd net-traffic
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Backend Configuration
NETWORK_INTERFACE=eth0
ALLOWED_ORIGINS=http://localhost,http://localhost:80
DEBUG=false
DATA_RETENTION_DAYS=30
RATE_LIMIT_PER_MINUTE=120

# Frontend Configuration
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_REAL_API=true
```

### 3. Build and Start

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 4. Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Docker Compose Services

### Backend Service

- **Image**: Built from `backend/Dockerfile`
- **Port**: 8000
- **Volume**: `backend-data` (persistent database storage)
- **Network**: `netinsight-network`

**Environment Variables**:

- `NETWORK_INTERFACE`: Network interface for packet capture (default: `eth0`)
- `HOST`: Bind address (default: `0.0.0.0`)
- `PORT`: API port (default: `8000`)
- `DB_PATH`: Database file path (default: `/app/data/netinsight.db`)
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)
- `DEBUG`: Enable debug mode (default: `false`)
- `DATA_RETENTION_DAYS`: Data retention period (default: `30`)
- `RATE_LIMIT_PER_MINUTE`: Rate limit (default: `120`)

### Frontend Service

- **Image**: Built from root `Dockerfile`
- **Port**: 80
- **Network**: `netinsight-network`

**Environment Variables**:

- `VITE_API_BASE_URL`: Backend API URL (default: `http://backend:8000`)
- `VITE_USE_REAL_API`: Enable real API (default: `true`)

**Note**: Frontend environment variables must be set at build time for Vite. See "Frontend Environment Variables" section below.

## Packet Capture Configuration

⚠️ **Important**: Packet capture requires special privileges in Docker.

### Option 1: Use Docker Capabilities (Recommended)

The `docker-compose.yml` includes:

```yaml
cap_add:
  - NET_ADMIN
  - NET_RAW
```

This should work for most cases.

### Option 2: Privileged Mode

If capabilities don't work, you can enable privileged mode:

```yaml
privileged: true
```

**Warning**: Privileged mode gives the container more access to the host system. Only use if necessary.

### Option 3: Host Network Mode

For better packet capture performance, you can use host networking:

```yaml
network_mode: 'host'
```

This removes the Docker network isolation but allows direct access to host network interfaces.

### Option 4: Disable Packet Capture (Testing)

If you just want to test the API without packet capture, you can:

1. Set `NETWORK_INTERFACE` to a non-existent interface
2. The backend will start but packet capture will fail gracefully
3. You can still use the API for testing other features

## Frontend Environment Variables

Vite requires environment variables to be set at **build time**. There are two options:

### Option 1: Build Args (Recommended for Docker)

Modify `docker-compose.yml` to pass build arguments:

```yaml
frontend:
  build:
    context: .
    dockerfile: Dockerfile
    args:
      - VITE_API_BASE_URL=${VITE_API_BASE_URL:-http://localhost:8000}
      - VITE_USE_REAL_API=${VITE_USE_REAL_API:-true}
```

And update `Dockerfile`:

```dockerfile
FROM node:20-alpine as builder

ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_USE_REAL_API=true

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_USE_REAL_API=$VITE_USE_REAL_API

# ... rest of Dockerfile
```

### Option 2: Runtime Configuration

Use a config file or API endpoint to configure the frontend at runtime. This requires additional setup.

## Building Individual Services

### Build Backend Only

```bash
cd backend
docker build -t netinsight-backend .
docker run -p 8000:8000 netinsight-backend
```

### Build Frontend Only

```bash
docker build -t netinsight-frontend .
docker run -p 80:80 netinsight-frontend
```

## Development Workflow

### Hot Reload Development

For development with hot reload, run services separately:

#### Backend (Development)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

#### Frontend (Development)

```bash
npm install
npm run dev
```

Use Docker Compose only for production-like testing.

### Development with Docker

You can mount source code as volumes for development:

```yaml
services:
  backend:
    volumes:
      - ./backend:/app
      - backend-data:/app/data
    environment:
      - DEBUG=true
```

## Data Persistence

The database is stored in a Docker volume `backend-data`. To persist data:

### View Volume

```bash
docker volume inspect netinsight-backend-data
```

### Backup Database

```bash
# Copy database from container
docker cp netinsight-backend:/app/data/netinsight.db ./backup.db

# Or from volume
docker run --rm -v netinsight-backend-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/backup.tar.gz /data
```

### Restore Database

```bash
# Copy database to container
docker cp ./backup.db netinsight-backend:/app/data/netinsight.db

# Restart container
docker-compose restart backend
```

### Remove Volume (Delete Data)

```bash
docker-compose down -v
```

## Network Configuration

### Custom Network

The services use a bridge network `netinsight-network`. Services can communicate using service names:

- Frontend → Backend: `http://backend:8000`
- Backend → Frontend: `http://frontend:80`

### Port Mapping

- Frontend: `80:80` (host:container)
- Backend: `8000:8000` (host:container)

### Firewall Rules

Ensure ports 80 and 8000 are open:

```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 8000/tcp

# firewalld (RHEL/CentOS)
sudo firewall-cmd --add-port=80/tcp --permanent
sudo firewall-cmd --add-port=8000/tcp --permanent
sudo firewall-cmd --reload
```

## Troubleshooting

### Backend Won't Start

1. **Check logs**:

   ```bash
   docker-compose logs backend
   ```

2. **Check network interface**:

   ```bash
   # List available interfaces
   docker exec netinsight-backend ip link show
   ```

3. **Check permissions**:
   ```bash
   # Try running with privileged mode
   # Edit docker-compose.yml: privileged: true
   ```

### Frontend Can't Connect to Backend

1. **Check environment variables**:

   ```bash
   docker-compose exec frontend env | grep VITE
   ```

2. **Check network connectivity**:

   ```bash
   docker-compose exec frontend wget -O- http://backend:8000/api/health
   ```

3. **Check CORS settings**:
   - Ensure `ALLOWED_ORIGINS` includes frontend URL
   - Check browser console for CORS errors

### Packet Capture Not Working

1. **Check capabilities**:

   ```bash
   docker inspect netinsight-backend | grep -A 10 CapAdd
   ```

2. **Check interface**:

   ```bash
   docker exec netinsight-backend ip link show
   ```

3. **Check capture status**:

   ```bash
   curl http://localhost:8000/api/capture/status
   ```

4. **Try host network mode** (see Packet Capture Configuration section)

### Database Errors

1. **Check volume**:

   ```bash
   docker volume ls | grep netinsight
   ```

2. **Check permissions**:

   ```bash
   docker exec netinsight-backend ls -la /app/data
   ```

3. **Reset database**:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

## Production Deployment

### Security Considerations

1. **Use environment files**: Never commit `.env` files
2. **Use secrets**: For sensitive data, use Docker secrets or external secret managers
3. **Remove privileged mode**: If possible, use capabilities only
4. **Use HTTPS**: Add reverse proxy (nginx/traefik) with SSL certificates
5. **Limit resources**: Set CPU and memory limits
6. **Use read-only filesystem**: Where possible

### Resource Limits

Add to `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Health Checks

Health checks are configured in `docker-compose.yml`. Monitor with:

```bash
docker-compose ps
```

### Logging

Configure logging driver:

```yaml
services:
  backend:
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
```

## Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Container Stats

```bash
docker stats netinsight-backend netinsight-frontend
```

### Health Status

```bash
# Backend
curl http://localhost:8000/api/health

# Frontend
curl http://localhost/health
```

## Updating

### Rebuild After Changes

```bash
# Rebuild and restart
docker-compose up -d --build

# Force rebuild without cache
docker-compose build --no-cache
docker-compose up -d
```

### Update Dependencies

1. Update `package.json` or `requirements.txt`
2. Rebuild images:
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

## Cleanup

### Stop and Remove

```bash
# Stop services
docker-compose down

# Stop and remove volumes (deletes data!)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

### Remove Everything

```bash
docker-compose down -v --rmi all
docker system prune -a
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Vite Production Build](https://vitejs.dev/guide/build.html)

## Support

For issues:

1. Check logs: `docker-compose logs`
2. Check container status: `docker-compose ps`
3. Check network: `docker network inspect netinsight-network`
4. Review this guide's troubleshooting section

---

**Last Updated**: December 2024
