# Analytics Dashboards Guide

## ✅ Completed Features

### 1. **API Client Methods** ✅

**Location**: `src/lib/api.ts`

All new analytics endpoints are now available through the API client:

```typescript
// Network Quality Analytics
apiClient.getRttTrends(hours, deviceId?, country?, intervalMinutes?)
apiClient.getJitterAnalysis(hours, deviceId?)
apiClient.getRetransmissionReport(hours, deviceId?)
apiClient.getConnectionQualitySummary(hours, deviceId?)

// Application Analytics
apiClient.getApplicationBreakdown(hours, deviceId?, limit?)
apiClient.getApplicationTrends(hours, application?, intervalMinutes?)
apiClient.getDeviceApplicationProfile(deviceId, hours)
```

### 2. **Network Quality Dashboard** ✅

**Location**: `src/components/NetworkQualityDashboard.tsx`

**Features**:

- **Connection Quality Summary**: Overall quality score, avg RTT, jitter, retransmissions
- **Quality Distribution**: Pie chart showing excellent/good/fair/poor connections
- **RTT Trends**: Line chart showing RTT over time (avg, min, max)
- **Retransmission Statistics**: Bar chart showing retransmissions by protocol
- **Jitter Analysis**: Distribution of jitter values
- **Time Range Selector**: Filter by 1 hour, 24 hours, or 7 days
- **Device Filtering**: Optional device ID filtering

**Usage**:

```tsx
import { NetworkQualityDashboard } from '@/components/NetworkQualityDashboard';

<NetworkQualityDashboard hours={24} deviceId={optionalDeviceId} />;
```

### 3. **Application Usage Dashboard** ✅

**Location**: `src/components/ApplicationUsageDashboard.tsx`

**Features**:

- **Summary Cards**: Total applications, connections, traffic, top application
- **Top Applications Chart**: Horizontal bar chart of top 10 applications by traffic
- **Application Distribution**: Pie chart showing traffic percentage by application
- **Application Details Table**: Complete metrics for each application
- **Application Trends**: Line chart showing usage trends over time
- **Application Filter**: Filter trends by specific application or view all
- **Time Range Selector**: Filter by 1 hour, 24 hours, or 7 days
- **Device Filtering**: Optional device ID filtering

**Usage**:

```tsx
import { ApplicationUsageDashboard } from '@/components/ApplicationUsageDashboard';

<ApplicationUsageDashboard hours={24} deviceId={optionalDeviceId} />;
```

## 📊 Dashboard Components

### Network Quality Dashboard

**Displays**:

1. **Quality Score Card**: Overall network quality (0-100)
2. **Avg RTT Card**: Average round-trip time
3. **Avg Jitter Card**: Average jitter
4. **Retransmissions Card**: Average retransmissions
5. **Quality Distribution**: Pie chart of connection quality
6. **RTT Trends**: Time-series line chart
7. **Retransmission Report**: Statistics and protocol breakdown
8. **Jitter Distribution**: Bar chart of jitter ranges

**Data Sources**:

- `/api/analytics/rtt-trends`
- `/api/analytics/jitter`
- `/api/analytics/retransmissions`
- `/api/analytics/connection-quality`

### Application Usage Dashboard

**Displays**:

1. **Summary Cards**: Total apps, connections, traffic, top app
2. **Top Applications Bar Chart**: Horizontal bar chart
3. **Application Distribution Pie Chart**: Traffic percentage
4. **Application Details Table**: Full metrics table
5. **Application Trends**: Time-series line chart

**Data Sources**:

- `/api/analytics/applications`
- `/api/analytics/applications/trends`

## 🎨 Integration Examples

### Basic Integration

Add to your main dashboard page:

```tsx
import { NetworkQualityDashboard } from '@/components/NetworkQualityDashboard';
import { ApplicationUsageDashboard } from '@/components/ApplicationUsageDashboard';

function DashboardPage() {
  return (
    <div className="space-y-8">
      <NetworkQualityDashboard hours={24} />
      <ApplicationUsageDashboard hours={24} />
    </div>
  );
}
```

### With Device Filtering

```tsx
function DeviceAnalyticsPage({ deviceId }: { deviceId: string }) {
  return (
    <div className="space-y-8">
      <NetworkQualityDashboard hours={24} deviceId={deviceId} />
      <ApplicationUsageDashboard hours={24} deviceId={deviceId} />
    </div>
  );
}
```

### With Tabs

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function AnalyticsPage() {
  return (
    <Tabs defaultValue="quality" className="space-y-4">
      <TabsList>
        <TabsTrigger value="quality">Network Quality</TabsTrigger>
        <TabsTrigger value="applications">Application Usage</TabsTrigger>
      </TabsList>
      <TabsContent value="quality">
        <NetworkQualityDashboard hours={24} />
      </TabsContent>
      <TabsContent value="applications">
        <ApplicationUsageDashboard hours={24} />
      </TabsContent>
    </Tabs>
  );
}
```

## 📈 Data Visualization

### Charts Used

1. **Line Charts** (Recharts):
   - RTT trends over time
   - Application usage trends
   - Multiple series support

2. **Bar Charts** (Recharts):
   - Top applications by traffic
   - Retransmissions by protocol
   - Jitter distribution

3. **Pie Charts** (Recharts):
   - Connection quality distribution
   - Application traffic distribution

### Color Schemes

- **Network Quality**: Green (excellent), Blue (good), Yellow (fair), Red (poor)
- **Applications**: 8-color palette for variety
- **RTT Lines**: Blue (avg), Green (min), Red (max)

## 🔧 Customization

### Time Ranges

Both dashboards support:

- `hours={1}` - Last hour
- `hours={24}` - Last 24 hours (default)
- `hours={168}` - Last 7 days

### Device Filtering

Pass `deviceId` prop to filter data for a specific device:

```tsx
<NetworkQualityDashboard hours={24} deviceId="device-123" />
```

### Styling

Dashboards use:

- Tailwind CSS for layout
- shadcn/ui components (Card, Badge, Select)
- Recharts for visualizations
- Responsive design (mobile-friendly)

## 🚀 Next Steps

### Potential Enhancements

1. **Export Functionality**: Add export buttons to download charts as images
2. **Real-time Updates**: WebSocket integration for live updates
3. **Comparison Mode**: Compare current vs. historical periods
4. **Alerts Integration**: Show alert thresholds on charts
5. **Drill-down**: Click charts to see detailed breakdowns
6. **Custom Time Ranges**: Date picker for custom ranges
7. **Saved Views**: Save favorite dashboard configurations

## 📝 API Reference

### Network Quality Endpoints

```typescript
// RTT Trends
GET /api/analytics/rtt-trends?hours=24&device_id=xxx&country=US&interval_minutes=15
Response: Array<{ timestamp, avg_rtt, min_rtt, max_rtt, count }>

// Jitter Analysis
GET /api/analytics/jitter?hours=24&device_id=xxx
Response: { avg_jitter, min_jitter, max_jitter, count, distribution }

// Retransmission Report
GET /api/analytics/retransmissions?hours=24&device_id=xxx
Response: { total_flows, flows_with_retransmissions, total_retransmissions, retransmission_rate, by_protocol }

// Connection Quality Summary
GET /api/analytics/connection-quality?hours=24&device_id=xxx
Response: { quality_score, avg_rtt, avg_jitter, avg_retransmissions, quality_distribution }
```

### Application Endpoints

```typescript
// Application Breakdown
GET /api/analytics/applications?hours=24&device_id=xxx&limit=20
Response: Array<{ application, connections, bytes, packets, unique_devices, avg_rtt, traffic_percentage }>

// Application Trends
GET /api/analytics/applications/trends?hours=24&application=HTTP&interval_minutes=15
Response: Array<{ timestamp, applications: Array<{ application, connections, bytes }> }>

// Device Application Profile
GET /api/analytics/devices/{device_id}/applications?hours=24
Response: { device_id, total_applications, total_connections, total_bytes, applications }
```

---

**Status**: ✅ Complete and Ready to Use
**Components**: 2 dashboard components
**API Methods**: 7 new methods
**Visualizations**: 8+ charts
