# NetInsight User Guide

Welcome to NetInsight! This guide will help you get started with the network traffic analysis dashboard.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Features Overview](#features-overview)
3. [Configuration](#configuration)
4. [Using the Dashboard](#using-the-dashboard)
5. [Troubleshooting](#troubleshooting)
6. [FAQ](#faq)

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Network connection
- (Optional) Raspberry Pi 5 with backend service running

### Quick Start

1. **Clone or download the project**

   ```bash
   git clone <repository-url>
   cd net-traffic
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment** (optional)
   - Copy `.env.example` to `.env`
   - Set `VITE_USE_REAL_API=true` if using backend
   - Set `VITE_API_BASE_URL` to your backend URL

4. **Start the application**

   ```bash
   npm run dev
   ```

5. **Open in browser**
   - Navigate to `http://localhost:5173` (or the port shown in terminal)

### Two Modes of Operation

NetInsight can run in two modes:

#### 1. Mock Data Mode (Default)

- Works completely offline
- Uses generated sample data
- Perfect for exploring the UI and features
- No backend required

#### 2. Real API Mode

- Connects to Raspberry Pi 5 backend
- Shows real network traffic data
- Real-time updates via WebSocket
- Requires backend service running

## Features Overview

### Dashboard Tabs

#### Overview Tab

- **Metric Cards**: Key network statistics at a glance
  - Active Connections
  - Network Throughput
  - Active Devices
  - Threat Score
- **Active Threats**: Real-time threat alerts
- **Network Graph**: Visual representation of network connections
- **Traffic Chart**: Bandwidth usage over time
- **Flow Visualization**: Animated flow pipes showing data streams
- **Connections Table**: Detailed list of all network connections

#### Insights Tab

- **Insights Summary**: AI-powered network insights
- **Summary Statistics**: Overall network statistics
- **Connection Quality**: Network performance metrics
- **Peak Usage Analysis**: Usage patterns by time and day
- **Top Users**: Devices using the most bandwidth
- **Top Sites**: Most visited domains
- **Historical Trends**: Network trends over time
- **Bandwidth Patterns**: Usage pattern analysis
- **Geographic Distribution**: Connection locations
- **Protocol Timeline**: Protocol usage over time
- **User Activity Timeline**: User activity patterns

#### Advanced Tab

- **Connection Health Monitor**: Backend service health and metrics
- **Security Posture**: Overall security assessment
- **Anomaly Detection**: AI-powered anomaly detection
- **Bandwidth Cost Estimator**: Estimate bandwidth costs
- **Data Exporter**: Export network data (CSV/JSON)

#### Visualizations Tab

- **Heatmap Timeline**: Traffic heatmap over time
- **Packet Burst**: Packet activity visualization
- **Bandwidth Gauge**: Current bandwidth usage
- **Radar Chart**: Multi-dimensional device analysis
- **Geographic Map**: World map showing connection locations
- **Protocol Sankey**: Protocol flow diagram

### Key Features

#### Real-Time Monitoring

- Live updates of network traffic
- WebSocket-based real-time data
- Automatic polling as backup
- Connection status indicators

#### Advanced Filtering

- Filter connections by:
  - Protocol (TCP, UDP, HTTP, etc.)
  - IP addresses (source/destination)
  - Time range (1h, 24h, 7d, 30d, custom)
  - Threat level
  - Device
  - Bandwidth threshold
- Save and load filter presets
- Export filtered results

#### Search Functionality

- Global search across:
  - Devices
  - Network flows
  - Threats
- Real-time search results
- Tabbed result view

#### Device Management

- View all network devices
- Edit device information:
  - Device name
  - Device type
  - Notes
- Automatic device discovery

#### Data Export

- Export network flows as:
  - CSV format
  - JSON format
- Filter by time range
- Filter by device
- Automatic file download

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Enable/disable real API mode
VITE_USE_REAL_API=false

# Backend API Base URL
VITE_API_BASE_URL=http://localhost:8000
```

### Validating Configuration

Check your environment configuration:

```bash
npm run validate:env
```

### Backend Connection

To connect to a Raspberry Pi 5 backend:

1. Ensure backend is running on Raspberry Pi
2. Set `VITE_USE_REAL_API=true`
3. Set `VITE_API_BASE_URL=http://<raspberry-pi-ip>:8000`
4. Restart the frontend application

## Using the Dashboard

### Viewing Network Connections

1. Navigate to **Overview** tab
2. Scroll to **Connections Table**
3. Use filters to narrow down connections:
   - Click **Filters** button
   - Select protocols, time range, IP addresses, etc.
   - Click **Apply Filters**
4. Click on a connection for details

### Searching

1. Click the **Search** icon in the header
2. Type your search query (device name, IP address, domain, etc.)
3. View results in the modal dialog
4. Click on a result to navigate (if implemented)

### Editing Device Information

1. Navigate to **Overview** or **Devices** section
2. Find the device you want to edit
3. Click the **Edit** button (pencil icon)
4. Update device name, type, or notes
5. Click **Save**

### Exporting Data

1. Navigate to **Advanced** tab
2. Scroll to **Data Exporter**
3. Click **Export Data**
4. Select format (CSV or JSON)
5. (Optional) Set time range and device filter
6. Click **Export**
7. File will download automatically

### Monitoring Connection Health

1. Navigate to **Advanced** tab
2. View **Connection Health Monitor** card
3. Monitor:
   - Connection status (Healthy/Degraded/Offline)
   - Latency (response time)
   - Packet loss
   - Service status (Storage, Capture, Threat, Analytics)
   - Connection history graph
   - Uptime percentage

### Using Filters

1. Open any table or list view
2. Click **Filters** button
3. Configure filters:
   - **Time Range**: Select preset or custom range
   - **Protocols**: Check multiple protocols
   - **Status**: Active or Closed
   - **Threat Level**: Safe, Low, Medium, High, Critical
   - **IP Addresses**: Enter source/destination IPs
   - **Device**: Select specific device
   - **Bandwidth**: Minimum bytes threshold
4. Click **Apply Filters**
5. (Optional) Save as preset for future use

## Troubleshooting

### Backend Connection Issues

**Problem**: Cannot connect to backend

**Solutions**:

1. Check `VITE_USE_REAL_API` is set to `true`
2. Verify `VITE_API_BASE_URL` is correct
3. Ensure backend service is running
4. Check network connectivity to backend
5. Verify firewall settings
6. Check backend logs: `sudo journalctl -u netinsight-backend -f`

**Error Messages**:

- "Connection Timeout" → Backend not responding, check if service is running
- "Backend Unavailable" → Cannot reach backend, check network and URL
- "Service Unavailable" → Backend is starting or overloaded, wait and retry

### No Data Appearing

**Problem**: Dashboard shows no data

**Solutions**:

1. Check if backend is capturing packets
2. Verify API connection status (look for connection badge)
3. Check browser console for errors
4. Try refreshing the page
5. Check backend logs for errors

### Performance Issues

**Problem**: Dashboard is slow or laggy

**Solutions**:

1. Reduce number of visible connections (use filters)
2. Close unused browser tabs
3. Check browser console for errors
4. Clear browser cache
5. Try a different browser
6. Check network connection speed

### Filter Not Working

**Problem**: Filters don't apply correctly

**Solutions**:

1. Clear all filters and reapply
2. Check if API mode is enabled (some filters require API)
3. Verify filter values are correct
4. Try refreshing the page
5. Check browser console for errors

### Export Not Working

**Problem**: Export doesn't download file

**Solutions**:

1. Check browser download settings
2. Ensure pop-ups are not blocked
3. Try a different browser
4. Check browser console for errors
5. Verify backend is accessible (for API export)

## FAQ

### Q: Can I use NetInsight without a backend?

**A**: Yes! NetInsight works in mock data mode by default. Just start the application without setting `VITE_USE_REAL_API=true`.

### Q: How do I set up the backend on Raspberry Pi?

**A**: See [DEPLOYMENT_RASPBERRY_PI.md](./DEPLOYMENT_RASPBERRY_PI.md) for detailed setup instructions.

### Q: What browsers are supported?

**A**: NetInsight works on all modern browsers:

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

### Q: How often does data update?

**A**:

- With WebSocket: Real-time (instant updates)
- With polling: Every 5 seconds
- Manual refresh: Click refresh button

### Q: Can I export historical data?

**A**: Yes! Use the Data Exporter in the Advanced tab. Set a time range to export historical flows.

### Q: How do I filter connections by time?

**A**:

1. Click **Filters** button
2. Select **Time Range** preset (1h, 24h, 7d, 30d)
3. Or select **Custom Range** and set start/end times
4. Click **Apply Filters**

### Q: What do the threat levels mean?

**A**:

- **Safe**: No threats detected
- **Low**: Minor suspicious activity
- **Medium**: Moderate security concern
- **High**: Significant security risk
- **Critical**: Immediate action required

### Q: How do I save filter settings?

**A**:

1. Configure your filters
2. Click **Save Filter Preset**
3. Enter a name for the preset
4. Click **Save**
5. Load it later from the **Saved Presets** section

### Q: Can I use NetInsight on mobile?

**A**: The dashboard is responsive and works on tablets. Mobile phones have limited functionality due to screen size.

### Q: How do I monitor backend health?

**A**: Navigate to **Advanced** tab and view the **Connection Health Monitor** card. It shows:

- Connection status
- Latency and packet loss
- Service status
- Connection history

### Q: What if the backend disconnects?

**A**: NetInsight will:

- Show a connection error message
- Automatically attempt to reconnect
- Fall back to mock data if reconnection fails
- Display connection status in the header

## Getting Help

### Documentation

- [README.md](./README.md) - Project overview
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Integration guide
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Detailed troubleshooting
- [API_ENHANCEMENTS.md](./API_ENHANCEMENTS.md) - API reference

### Support

- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- Review browser console for error messages
- Check backend logs if using API mode
- Create an issue on GitHub for bugs

## Keyboard Shortcuts

- `Ctrl/Cmd + K` - Open search (if implemented)
- `F5` - Refresh page
- `Esc` - Close modals/dialogs

## Tips & Best Practices

1. **Use Filters**: Filter large datasets for better performance
2. **Save Presets**: Save commonly used filter combinations
3. **Monitor Health**: Check connection health regularly
4. **Export Data**: Export important data for backup
5. **Update Devices**: Keep device information up to date
6. **Check Threats**: Review active threats regularly
7. **Use Search**: Quickly find devices, flows, or threats

---

**Last Updated**: December 2024  
**Version**: 1.0
