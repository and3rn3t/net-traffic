export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export function formatBytesShort(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatRate(bytesPerSecond: number): string {
  return `${formatBytesShort(bytesPerSecond)}/s`
}

export function getThreatColor(level: string): string {
  switch (level) {
    case 'safe': return 'text-success'
    case 'low': return 'text-warning'
    case 'medium': return 'text-warning'
    case 'high': return 'text-destructive'
    case 'critical': return 'text-destructive'
    default: return 'text-muted-foreground'
  }
}

export function getThreatBgColor(level: string): string {
  switch (level) {
    case 'safe': return 'bg-success/10 border-success/20'
    case 'low': return 'bg-warning/10 border-warning/20'
    case 'medium': return 'bg-warning/20 border-warning/30'
    case 'high': return 'bg-destructive/10 border-destructive/20'
    case 'critical': return 'bg-destructive/20 border-destructive/30'
    default: return 'bg-muted border-border'
  }
}

export function getDeviceIcon(type: string): string {
  const icons: Record<string, string> = {
    smartphone: '📱',
    laptop: '💻',
    desktop: '🖥️',
    tablet: '📱',
    iot: '🔌',
    server: '🖥️',
    unknown: '❓'
  }
  return icons[type] || icons.unknown
}
