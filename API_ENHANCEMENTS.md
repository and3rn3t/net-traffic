# API Enhancements Documentation

This document describes the enhanced API endpoints added to the NetInsight backend.

## New Endpoints

### 1. Enhanced Flow Filtering

**GET `/api/flows`** - Now supports advanced filtering options:

**Query Parameters:**

- `limit` (int, default: 100) - Maximum number of results
- `offset` (int, default: 0) - Pagination offset
- `device_id` (string, optional) - Filter by device ID
- `status` (string, optional) - Filter by flow status ('active' | 'closed')
- `protocol` (string, optional) - Filter by protocol (e.g., 'TCP', 'UDP', 'HTTP')
- `start_time` (int, optional) - Unix timestamp in milliseconds (inclusive)
- `end_time` (int, optional) - Unix timestamp in milliseconds (inclusive)
- `source_ip` (string, optional) - Filter by source IP address
- `dest_ip` (string, optional) - Filter by destination IP address
- `threat_level` (string, optional) - Filter by threat level ('safe' | 'low' | 'medium' | 'high' | 'critical')
- `min_bytes` (int, optional) - Minimum total bytes (bytes_in + bytes_out)

**Example:**

```
GET /api/flows?protocol=TCP&start_time=1699123456000&min_bytes=1000&limit=50
```

### 2. Summary Statistics

**GET `/api/stats/summary`** - Get overall summary statistics

**Response:**

```json
{
  "total_devices": 8,
  "active_devices": 5,
  "total_flows": 1250,
  "active_flows": 15,
  "total_bytes": 1073741824,
  "total_threats": 12,
  "active_threats": 3,
  "critical_threats": 1,
  "oldest_flow_timestamp": 1699123456000,
  "newest_flow_timestamp": 1699209856000,
  "capture_duration_hours": 24.0
}
```

### 3. Geographic Distribution

**GET `/api/stats/geographic`** - Get geographic distribution of connections

**Query Parameters:**

- `hours` (int, default: 24) - Number of hours to look back

**Response:**

```json
[
  {
    "country": "US",
    "connections": 450,
    "bytes": 536870912,
    "threats": 2
  },
  {
    "country": "GB",
    "connections": 120,
    "bytes": 134217728,
    "threats": 0
  }
]
```

### 4. Top Domains

**GET `/api/stats/top/domains`** - Get top domains by traffic

**Query Parameters:**

- `limit` (int, default: 20) - Number of top domains to return
- `hours` (int, default: 24) - Number of hours to look back

**Response:**

```json
[
  {
    "domain": "api.github.com",
    "connections": 234,
    "bytes": 104857600,
    "unique_devices": 3
  }
]
```

### 5. Top Devices

**GET `/api/stats/top/devices`** - Get top devices by traffic

**Query Parameters:**

- `limit` (int, default: 10) - Number of top devices to return
- `hours` (int, default: 24) - Number of hours to look back
- `sort_by` (string, default: "bytes") - Sort by: "bytes", "connections", or "threats"

**Response:**

```json
[
  {
    "device_id": "device-123",
    "device_name": "MacBook Pro",
    "device_ip": "192.168.1.100",
    "device_type": "laptop",
    "bytes": 536870912,
    "connections": 450,
    "threats": 0
  }
]
```

### 6. Bandwidth Timeline

**GET `/api/stats/bandwidth`** - Get bandwidth usage timeline

**Query Parameters:**

- `hours` (int, default: 24) - Number of hours to look back
- `interval_minutes` (int, default: 5) - Time interval in minutes

**Response:**

```json
[
  {
    "timestamp": 1699123456000,
    "bytes_in": 52428800,
    "bytes_out": 10485760,
    "packets": 15000,
    "connections": 25
  }
]
```

### 7. Device Analytics

**GET `/api/devices/{device_id}/analytics`** - Get detailed analytics for a specific device

**Query Parameters:**

- `hours` (int, default: 24) - Number of hours to look back

**Response:**

```json
{
  "device": {
    "id": "device-123",
    "name": "MacBook Pro",
    "ip": "192.168.1.100",
    "type": "laptop"
  },
  "summary": {
    "total_bytes_in": 268435456,
    "total_bytes_out": 67108864,
    "total_bytes": 335544320,
    "connections": 234,
    "threats": 2
  },
  "protocols": [
    {
      "protocol": "HTTPS",
      "bytes": 268435456,
      "connections": 180
    }
  ],
  "top_domains": [
    {
      "domain": "api.github.com",
      "bytes": 52428800
    }
  ],
  "top_ports": [
    {
      "port": 443,
      "connections": 180
    }
  ]
}
```

### 8. Update Device

**PATCH `/api/devices/{device_id}`** - Update device information

**Request Body:**

```json
{
  "name": "Updated Device Name",
  "type": "laptop",
  "notes": "User's personal laptop"
}
```

**Response:** Updated device object

### 9. Search

**GET `/api/search`** - Search across devices, flows, and threats

**Query Parameters:**

- `q` (string, required) - Search query
- `type` (string, default: "all") - Search type: "all", "devices", "flows", or "threats"
- `limit` (int, default: 50) - Maximum results per type

**Response:**

```json
{
  "query": "192.168.1",
  "type": "all",
  "devices": [...],
  "flows": [...],
  "threats": [...]
}
```

### 10. Export Flows

**GET `/api/export/flows`** - Export flows as JSON or CSV

**Query Parameters:**

- `format` (string, default: "json") - Export format: "json" or "csv"
- `start_time` (int, optional) - Unix timestamp in milliseconds
- `end_time` (int, optional) - Unix timestamp in milliseconds
- `device_id` (string, optional) - Filter by device ID

**Response:**

- JSON: Returns JSON object with flows array
- CSV: Returns CSV file download

**Example:**

```
GET /api/export/flows?format=csv&start_time=1699123456000
```

## Enhanced Features

### Pagination Support

All list endpoints now support pagination via `limit` and `offset` parameters:

- `limit`: Maximum number of results (default: 100, max: 1000)
- `offset`: Number of results to skip (default: 0)

### Time Range Queries

Multiple endpoints now support time range filtering:

- Use `start_time` and `end_time` parameters (Unix timestamps in milliseconds)
- Or use `hours` parameter to look back from now

### Advanced Filtering

Flow queries support multiple filter conditions that can be combined:

- Filter by protocol, IP addresses, threat level, and more
- All filters are ANDed together

## Usage Examples

### Get active TCP flows in last hour

```
GET /api/flows?status=active&protocol=TCP&start_time=1699206256000
```

### Get top 5 devices by connections

```
GET /api/stats/top/devices?limit=5&sort_by=connections&hours=7
```

### Search for specific IP address

```
GET /api/search?q=192.168.1.100&type=all
```

### Export flows as CSV for last 24 hours

```
GET /api/export/flows?format=csv&start_time=1699123456000
```

### Get detailed analytics for a device

```
GET /api/devices/device-123/analytics?hours=48
```

## Frontend Integration

These endpoints are designed to work seamlessly with the existing frontend. Update the API client (`src/lib/api.ts`) to add methods for these new endpoints.

Example additions:

```typescript
async getSummaryStats(): Promise<any> {
  return this.request('/api/stats/summary');
}

async getTopDomains(limit: number = 20, hours: number = 24): Promise<any[]> {
  return this.request(`/api/stats/top/domains?limit=${limit}&hours=${hours}`);
}

async updateDevice(deviceId: string, update: any): Promise<any> {
  return this.request(`/api/devices/${deviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}
```

## Performance Considerations

- Large time ranges may return significant amounts of data
- Use pagination for large result sets
- Consider using specific time ranges rather than large hour ranges
- Export endpoints may take longer for large datasets
