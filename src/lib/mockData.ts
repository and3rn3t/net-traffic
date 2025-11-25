import { NetworkFlow, Device, Threat, AnalyticsData, ProtocolStats } from './types'

const DEVICE_TYPES = ['smartphone', 'laptop', 'desktop', 'tablet', 'iot'] as const
const PROTOCOLS = ['HTTPS', 'HTTP', 'DNS', 'QUIC', 'SSH', 'MQTT', 'WebSocket']
const DOMAINS = [
  'api.github.com',
  'www.google.com',
  'cdn.cloudflare.com',
  'api.openai.com',
  'mqtt.broker.local',
  'api.weather.com',
  'streaming.service.com',
  'social.media.com',
  'analytics.tracker.net',
  'ads.network.com'
]
const VENDORS = ['Apple', 'Samsung', 'Google', 'Amazon', 'Xiaomi', 'TP-Link', 'Philips']
const COUNTRIES = ['US', 'GB', 'DE', 'JP', 'SG', 'CA', 'FR', 'AU']

function randomIp(): string {
  return `192.168.1.${Math.floor(Math.random() * 254) + 1}`
}

function randomExternalIp(): string {
  return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`
}

function randomMac(): string {
  return Array.from({ length: 6 }, () => 
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join(':')
}

function randomPort(): number {
  return Math.random() > 0.7 ? 443 : Math.random() > 0.5 ? 80 : Math.floor(Math.random() * 65535)
}

export function generateDevice(id: string): Device {
  const type = DEVICE_TYPES[Math.floor(Math.random() * DEVICE_TYPES.length)]
  const vendor = VENDORS[Math.floor(Math.random() * VENDORS.length)]
  const ip = randomIp()
  const now = Date.now()
  
  return {
    id,
    name: `${vendor} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    ip,
    mac: randomMac(),
    type,
    vendor,
    firstSeen: now - Math.random() * 7 * 24 * 60 * 60 * 1000,
    lastSeen: now - Math.random() * 60 * 1000,
    bytesTotal: Math.floor(Math.random() * 10000000000),
    connectionsCount: Math.floor(Math.random() * 10000),
    threatScore: Math.random() * 100,
    behavioral: {
      peakHours: Array.from({ length: 3 }, () => Math.floor(Math.random() * 24)),
      commonPorts: [443, 80, 53],
      commonDomains: DOMAINS.slice(0, Math.floor(Math.random() * 5) + 2),
      anomalyCount: Math.floor(Math.random() * 10)
    }
  }
}

export function generateNetworkFlow(deviceId: string, id: string): NetworkFlow {
  const protocol = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)]
  const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)]
  const threatLevels: NetworkFlow['threatLevel'][] = ['safe', 'safe', 'safe', 'safe', 'low', 'medium', 'high']
  
  return {
    id,
    timestamp: Date.now() - Math.random() * 3600000,
    sourceIp: randomIp(),
    sourcePort: Math.floor(Math.random() * 65535),
    destIp: randomExternalIp(),
    destPort: randomPort(),
    protocol,
    bytesIn: Math.floor(Math.random() * 1000000),
    bytesOut: Math.floor(Math.random() * 100000),
    packetsIn: Math.floor(Math.random() * 1000),
    packetsOut: Math.floor(Math.random() * 500),
    duration: Math.floor(Math.random() * 60000),
    status: Math.random() > 0.3 ? 'active' : 'closed',
    country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
    domain,
    threatLevel: threatLevels[Math.floor(Math.random() * threatLevels.length)],
    deviceId
  }
}

export function generateThreat(deviceId: string, flowId: string, id: string): Threat {
  const types: Threat['type'][] = ['malware', 'exfiltration', 'scan', 'botnet', 'phishing', 'anomaly']
  const severities: Threat['severity'][] = ['low', 'medium', 'high', 'critical']
  const type = types[Math.floor(Math.random() * types.length)]
  
  const descriptions: Record<Threat['type'], string> = {
    malware: 'Connection to known malware command & control server detected',
    exfiltration: 'Unusual large data upload detected outside normal usage patterns',
    scan: 'Port scanning activity detected targeting multiple external hosts',
    botnet: 'Device communicating with known botnet infrastructure',
    phishing: 'Connection to suspected phishing domain with credential submission',
    anomaly: 'Behavioral anomaly detected - device accessing unusual services at abnormal time'
  }
  
  const recommendations: Record<Threat['type'], string> = {
    malware: 'Isolate device immediately and run full antivirus scan',
    exfiltration: 'Review device for unauthorized applications and check for data breaches',
    scan: 'Investigate device for compromise and check for malware',
    botnet: 'Disconnect device and perform factory reset, change all passwords',
    phishing: 'Change credentials immediately and enable 2FA on affected accounts',
    anomaly: 'Monitor device closely for 24h and investigate if behavior continues'
  }
  
  return {
    id,
    timestamp: Date.now() - Math.random() * 3600000,
    type,
    severity: severities[Math.floor(Math.random() * severities.length)],
    deviceId,
    flowId,
    description: descriptions[type],
    recommendation: recommendations[type],
    dismissed: false
  }
}

export function generateAnalyticsData(hoursBack: number = 24): AnalyticsData[] {
  const data: AnalyticsData[] = []
  const now = Date.now()
  
  for (let i = hoursBack; i >= 0; i--) {
    const hour = new Date(now - i * 60 * 60 * 1000).getHours()
    const isBusinessHours = hour >= 9 && hour <= 17
    const isPeakHours = hour >= 18 && hour <= 22
    
    let baseBytes = 50000000
    if (isPeakHours) baseBytes = 200000000
    else if (isBusinessHours) baseBytes = 150000000
    
    data.push({
      timestamp: now - i * 60 * 60 * 1000,
      totalBytes: Math.floor(baseBytes + Math.random() * baseBytes * 0.3),
      totalConnections: Math.floor((isPeakHours ? 800 : isBusinessHours ? 500 : 200) + Math.random() * 300),
      threatCount: Math.floor(Math.random() * (isPeakHours ? 15 : 10)),
      activeDevices: Math.floor((isPeakHours ? 7 : isBusinessHours ? 5 : 3) + Math.random() * 2)
    })
  }
  
  return data
}

export function generateProtocolStats(): ProtocolStats[] {
  const total = 1000000000
  const protocols = ['HTTPS', 'HTTP', 'DNS', 'QUIC', 'SSH', 'MQTT', 'Other']
  
  return protocols.map((protocol, i) => {
    const percentage = i === 0 ? 65 : i === 1 ? 15 : i === 2 ? 10 : Math.random() * 5
    const bytes = Math.floor(total * (percentage / 100))
    const connections = Math.floor(Math.random() * 10000)
    
    return {
      protocol,
      bytes,
      connections,
      percentage
    }
  })
}

export function generateInitialDevices(count: number = 8): Device[] {
  return Array.from({ length: count }, (_, i) => generateDevice(`device-${i + 1}`))
}

export function generateInitialFlows(devices: Device[], count: number = 30): NetworkFlow[] {
  return Array.from({ length: count }, (_, i) => {
    const device = devices[Math.floor(Math.random() * devices.length)]
    return generateNetworkFlow(device.id, `flow-${i + 1}`)
  })
}

export function generateInitialThreats(devices: Device[], flows: NetworkFlow[], count: number = 5): Threat[] {
  return Array.from({ length: count }, (_, i) => {
    const device = devices[Math.floor(Math.random() * devices.length)]
    const flow = flows.find(f => f.deviceId === device.id) || flows[0]
    return generateThreat(device.id, flow.id, `threat-${i + 1}`)
  })
}
