# NetInsight Backend API

FastAPI-based backend service for network traffic analysis, designed to run on Raspberry Pi 5.

## Features

- **Real-time Packet Capture**: Captures network traffic using Scapy
- **Device Fingerprinting**: Automatically discovers and identifies devices
- **Threat Detection**: Analyzes traffic for suspicious patterns
- **REST API**: Full REST API for frontend integration
- **WebSocket Support**: Real-time updates via WebSocket
- **SQLite Storage**: Lightweight database for historical data

## Quick Start

### Installation

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Copy `.env.example` to `.env` and update:

```env
NETWORK_INTERFACE=eth0
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=http://localhost:5173
```

### Running

```bash
# Development
python main.py

# Or with uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### API Documentation

Once running, visit:

- API Docs: http://localhost:8000/docs
- Alternative Docs: http://localhost:8000/redoc

## API Endpoints

### Health & Status

- `GET /` - Service information
- `GET /api/health` - Health check

### Devices

- `GET /api/devices` - List all devices
- `GET /api/devices/{device_id}` - Get device details

### Network Flows

- `GET /api/flows` - List flows (supports `limit`, `device_id`, `status` filters)
- `GET /api/flows/{flow_id}` - Get flow details

### Threats

- `GET /api/threats` - List threats (supports `active_only` parameter)
- `POST /api/threats/{threat_id}/dismiss` - Dismiss a threat

### Analytics

- `GET /api/analytics?hours=24` - Get analytics data
- `GET /api/protocols` - Get protocol statistics

### Capture Control

- `GET /api/capture/status` - Get capture status
- `POST /api/capture/start` - Start packet capture
- `POST /api/capture/stop` - Stop packet capture

### WebSocket

- `WS /ws` - WebSocket endpoint for real-time updates

## Architecture

```
backend/
├── main.py                 # FastAPI application entry point
├── models/
│   ├── types.py           # Pydantic models matching frontend types
│   └── __init__.py
├── services/
│   ├── packet_capture.py  # Scapy-based packet capture
│   ├── device_fingerprinting.py  # Device discovery & identification
│   ├── threat_detection.py  # Threat analysis
│   ├── storage.py         # SQLite database operations
│   ├── analytics.py       # Data aggregation & analytics
│   └── __init__.py
├── requirements.txt       # Python dependencies
└── .env.example          # Configuration template
```

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest
```

### Code Structure

- **Models**: Pydantic models for type safety and validation
- **Services**: Business logic separated into services
- **Storage**: Database abstraction layer
- **API Routes**: FastAPI route handlers

## Dependencies

Key dependencies:

- **FastAPI**: Modern async web framework
- **Scapy**: Packet manipulation and capture
- **SQLite**: Embedded database (via aiosqlite)
- **WebSockets**: Real-time communication

See `requirements.txt` for full list.

## Security Notes

⚠️ **Important**: Packet capture requires elevated privileges or capabilities:

```bash
# Grant capabilities (recommended)
sudo setcap cap_net_raw,cap_net_admin=eip $(readlink -f venv/bin/python3)

# Or run as root (not recommended)
sudo python main.py
```

## Performance Considerations

- Packet capture performance depends on network traffic volume
- Consider limiting historical data retention
- Use indexes for database queries (already configured)
- Monitor system resources (CPU, memory, disk I/O)

## Troubleshooting

### Scapy Installation Issues

On some systems, Scapy may require additional dependencies:

```bash
# Ubuntu/Debian
sudo apt install python3-dev libpcap-dev

# Then reinstall
pip install --upgrade scapy
```

### Permission Denied

Ensure you have packet capture permissions:

```bash
# Check capabilities
getcap venv/bin/python3

# Or verify with tcpdump
sudo tcpdump -i eth0 -c 1
```

### Database Locked

If you see database locked errors:

- Ensure only one instance is running
- Check for stale database connections
- Restart the service

## Production Deployment

For production deployment on Raspberry Pi 5:

1. See [DEPLOYMENT_RASPBERRY_PI.md](../DEPLOYMENT_RASPBERRY_PI.md) for detailed instructions
2. Set up as a systemd service
3. Configure reverse proxy (nginx) with SSL
4. Set up monitoring and logging
5. Configure automatic backups

## License

See main project LICENSE file.
