# Frontend-Backend Integration Guide

This guide explains how to connect your NetInsight frontend to the Raspberry Pi 5 backend.

## Overview

The frontend and backend communicate via:

1. **REST API** - For fetching data, controlling capture, etc.
2. **WebSocket** - For real-time updates when new flows/threats are detected

## Quick Integration

### Step 1: Update Frontend Environment

Create or update `.env.local` in your frontend project root:

```env
VITE_USE_REAL_API=true
VITE_API_BASE_URL=http://your-raspberry-pi-ip:8000
```

Replace `your-raspberry-pi-ip` with your Raspberry Pi's IP address.

### Step 2: Update App.tsx

Replace the mock data implementation with the API hook:

```typescript
// In src/App.tsx

// Remove or comment out:
// import { generateInitialDevices, ... } from '@/lib/mockData';
// const [devices, setDevices] = useKV<Device[]>('network-devices', []);

// Add:
import { useApiData } from '@/hooks/useApiData';

function App() {
  // Replace existing state with API hook
  const {
    devices,
    flows,
    threats,
    analyticsData,
    protocolStats,
    isCapturing,
    isLoading,
    isConnected,
    error,
    startCapture,
    stopCapture,
    dismissThreat,
    refresh,
  } = useApiData({
    pollingInterval: 5000, // Poll every 5 seconds as backup
    useWebSocket: true, // Enable real-time WebSocket updates
  });

  // Rest of your component code...
}
```

### Step 3: Handle Loading and Error States

Add loading and error UI:

```typescript
// In your App component
if (isLoading) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Spinner />
        <p>Connecting to backend...</p>
      </div>
    </div>
  );
}

if (error && !isConnected) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center text-destructive">
        <AlertCircle size={48} />
        <h2>Backend Connection Failed</h2>
        <p>{error}</p>
        <Button onClick={refresh}>Retry Connection</Button>
      </div>
    </div>
  );
}
```

### Step 4: Update Capture Control

Replace the capture toggle:

```typescript
// Replace:
// onClick={() => setIsCapturing(!isCapturing)}

// With:
onClick={() => {
  if (isCapturing) {
    stopCapture();
  } else {
    startCapture();
  }
}}
```

## API Client Usage

The API client (`src/lib/api.ts`) provides direct access to all endpoints:

```typescript
import { apiClient } from '@/lib/api';

// Get devices
const devices = await apiClient.getDevices();

// Get flows with filters
const flows = await apiClient.getFlows(100, deviceId, 'active');

// Dismiss a threat
await apiClient.dismissThreat(threatId);

// Start/stop capture
await apiClient.startCapture();
await apiClient.stopCapture();
```

## WebSocket Real-Time Updates

The API client automatically handles WebSocket connections. Updates are received as:

```json
{
  "type": "flow_update",
  "flow": { /* NetworkFlow object */ }
}

{
  "type": "device_update",
  "device": { /* Device object */ }
}

{
  "type": "threat_update",
  "threat": { /* Threat object */ }
}
```

The `useApiData` hook automatically processes these updates and updates component state.

## Switching Between Mock and Real Data

The system automatically uses real API when:

- `VITE_USE_REAL_API=true` is set in environment
- `VITE_API_BASE_URL` is configured

Otherwise, it falls back to mock data.

You can also check at runtime:

```typescript
const { useRealApi, isConnected } = useApiData();

if (useRealApi && !isConnected) {
  // Show connection error or fallback to mock
}
```

## CORS Configuration

Ensure your backend allows your frontend origin:

In `backend/.env`:

```env
ALLOWED_ORIGINS=http://localhost:5173,http://your-production-domain.com
```

## Testing Locally

### 1. Start Backend Locally

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### 2. Start Frontend

```bash
# In frontend directory
npm run dev
```

### 3. Configure Frontend

Create `.env.local`:

```env
VITE_USE_REAL_API=true
VITE_API_BASE_URL=http://localhost:8000
```

### 4. Test Connection

Visit http://localhost:5173 and check browser console for:

- "WebSocket connected" message
- API requests in Network tab
- Real-time updates

## Production Deployment

### Frontend on Cloudflare Pages

1. Build frontend with production API URL:

   ```env
   VITE_USE_REAL_API=true
   VITE_API_BASE_URL=https://your-raspberry-pi-domain.com
   ```

2. Deploy to Cloudflare Pages (existing setup)

### Backend on Raspberry Pi

1. Follow [DEPLOYMENT_RASPBERRY_PI.md](./DEPLOYMENT_RASPBERRY_PI.md)

2. Set up reverse proxy with nginx for HTTPS:

   ```nginx
   server {
       listen 443 ssl;
       server_name your-raspberry-pi-domain.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       location / {
           proxy_pass http://localhost:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

3. Update CORS in backend `.env`:
   ```env
   ALLOWED_ORIGINS=https://your-frontend-domain.com
   ```

## Troubleshooting

### CORS Errors

- Check `ALLOWED_ORIGINS` in backend `.env`
- Ensure frontend origin matches exactly (including protocol and port)
- Check browser console for specific CORS error

### WebSocket Connection Failed

- Verify backend is running
- Check firewall allows WebSocket connections
- Verify URL is correct (ws:// or wss://)
- Check backend logs for WebSocket errors

### No Data Appearing

- Check browser Network tab for API requests
- Verify backend is capturing packets
- Check backend logs: `sudo journalctl -u netinsight-backend -f`
- Test API directly: `curl http://your-pi-ip:8000/api/health`

### Connection Timeout

- Verify Raspberry Pi is reachable from your network
- Check firewall settings
- Test with: `curl http://your-pi-ip:8000/api/health`
- Verify backend service is running

## Next Steps

- [ ] Implement authentication/authorization
- [ ] Add API rate limiting
- [ ] Set up monitoring and alerting
- [ ] Optimize WebSocket message handling
- [ ] Add data persistence for offline mode
