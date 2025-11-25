# Backend Integration Summary

## What Was Created

### Backend Service (Python/FastAPI)

A complete backend API service designed to run on Raspberry Pi 5:

1. **Main Application** (`backend/main.py`)
   - FastAPI server with REST API endpoints
   - WebSocket support for real-time updates
   - Automatic startup/shutdown lifecycle management
   - CORS configuration for frontend integration

2. **Services**
   - `packet_capture.py` - Scapy-based packet capture and flow extraction
   - `device_fingerprinting.py` - Automatic device discovery and identification
   - `threat_detection.py` - Basic threat analysis and alerting
   - `storage.py` - SQLite database operations
   - `analytics.py` - Data aggregation and statistics

3. **Models** (`backend/models/types.py`)
   - Type definitions matching frontend TypeScript interfaces
   - Ensures data consistency between frontend and backend

### Frontend Integration

1. **API Client** (`src/lib/api.ts`)
   - Complete REST API client
   - WebSocket connection management
   - Automatic reconnection handling
   - Error handling and timeouts

2. **React Hook** (`src/hooks/useApiData.ts`)
   - Easy-to-use hook for fetching and managing API data
   - Automatic polling and WebSocket integration
   - Loading and error state management
   - Seamless switching between mock and real data

### Documentation

1. **DEPLOYMENT_RASPBERRY_PI.md** - Complete setup guide for Raspberry Pi 5
2. **INTEGRATION_GUIDE.md** - Frontend-backend integration instructions
3. **backend/README.md** - Backend API documentation

## How It Works

### Architecture

```
┌─────────────────┐         HTTP/WebSocket        ┌──────────────────┐
│                 │ ◄──────────────────────────► │                  │
│   Frontend      │                               │   Backend API    │
│   (React/Vite)  │                               │   (FastAPI)      │
│                 │                               │                  │
└─────────────────┘                               └────────┬─────────┘
                                                           │
                                                           │
                           ┌───────────────────────────────┼──────────────┐
                           │                               │              │
                    ┌──────▼──────┐               ┌───────▼──────┐       │
                    │   Scapy     │               │   SQLite     │       │
                    │   Packet    │               │   Database   │       │
                    │   Capture   │               │              │       │
                    └─────────────┘               └──────────────┘       │
                                                                          │
                                                           ┌──────────────▼──┐
                                                           │  Network        │
                                                           │  Interface      │
                                                           │  (eth0/wlan0)   │
                                                           └─────────────────┘
```

### Data Flow

1. **Packet Capture**: Scapy captures packets from network interface
2. **Flow Extraction**: Packets are grouped into network flows (connections)
3. **Device Discovery**: Devices are identified from IP/MAC addresses
4. **Threat Analysis**: Flows are analyzed for suspicious patterns
5. **Storage**: Data is stored in SQLite database
6. **API**: Frontend queries REST API for data
7. **Real-time Updates**: WebSocket pushes updates as new flows/threats detected

### API Endpoints

- `GET /api/devices` - List all discovered devices
- `GET /api/flows` - Get network flows (supports filtering)
- `GET /api/threats` - Get threat alerts
- `GET /api/analytics` - Get aggregated analytics data
- `POST /api/capture/start` - Start packet capture
- `POST /api/capture/stop` - Stop packet capture
- `WS /ws` - WebSocket for real-time updates

## Integration Steps

### 1. Set Up Raspberry Pi Backend

Follow the detailed guide in `DEPLOYMENT_RASPBERRY_PI.md`:

- Install dependencies
- Configure network interface
- Set up as systemd service
- Configure packet capture permissions

### 2. Connect Frontend

Follow `INTEGRATION_GUIDE.md`:

- Update `.env.local` with API URL
- Replace mock data with `useApiData` hook
- Test connection

### 3. Deploy

- Frontend: Deploy to Cloudflare Pages (existing setup)
- Backend: Run on Raspberry Pi 5 with systemd service
- Configure nginx reverse proxy for HTTPS (optional but recommended)

## Key Features

✅ **Real-time packet capture** using Scapy
✅ **Automatic device discovery** via ARP and traffic analysis
✅ **Threat detection** with configurable rules
✅ **REST API** matching frontend data structures
✅ **WebSocket support** for real-time updates
✅ **SQLite storage** for historical data
✅ **Raspberry Pi 5 optimized** - runs efficiently on Pi hardware
✅ **Easy integration** - drop-in replacement for mock data

## Next Steps

1. **Enhanced Threat Detection**
   - Integrate threat intelligence feeds
   - Machine learning-based anomaly detection
   - Custom threat rules

2. **Performance Optimization**
   - Packet sampling for high-traffic networks
   - Database query optimization
   - Caching frequently accessed data

3. **Additional Features**
   - User authentication
   - Multi-network support
   - Data export/backup
   - Remote access configuration

4. **Security Hardening**
   - HTTPS/SSL certificates
   - API authentication tokens
   - Rate limiting
   - Input validation

## Requirements

### Backend (Raspberry Pi 5)

- Python 3.10+
- Scapy (requires libpcap)
- Network interface with packet capture capabilities
- Elevated privileges for packet capture

### Frontend

- React 18+
- Vite
- Modern browser with WebSocket support

## Support

- Backend logs: `sudo journalctl -u netinsight-backend -f`
- API docs: `http://your-pi-ip:8000/docs`
- Check health: `curl http://your-pi-ip:8000/api/health`

## Notes

- Packet capture requires root privileges or special capabilities
- Network interface must support promiscuous mode
- For best results, use port mirroring or run on gateway/router
- SQLite database grows over time - consider periodic cleanup
- WebSocket reconnects automatically if connection drops
