/**
 * Shared constants used across the application
 * Consolidates magic numbers and repeated values
 */

// Time constants (in milliseconds)
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

// Default time ranges (in hours)
export const DEFAULT_TIME_RANGES = {
  SHORT: 1, // 1 hour
  MEDIUM: 24, // 24 hours (1 day)
  LONG: 168, // 168 hours (1 week)
} as const;

// Default limits
export const DEFAULT_LIMITS = {
  SMALL: 10,
  MEDIUM: 50,
  LARGE: 100,
  VERY_LARGE: 500,
} as const;

// Data size thresholds (in bytes)
export const DATA_THRESHOLDS = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  LARGE_UPLOAD: 10 * 1024 * 1024, // 10 MB
  VERY_LARGE_UPLOAD: 100 * 1024 * 1024, // 100 MB
} as const;

// Network thresholds
export const NETWORK_THRESHOLDS = {
  HIGH_PACKET_COUNT: 100,
  LOW_DATA_TRANSFER: 10000, // bytes
  PORT_SCAN_THRESHOLD: 20,
  REPEATED_CONNECTION_THRESHOLD: 50,
  EXFILTRATION_RATIO: 5, // bytesOut / bytesIn
} as const;

// Threat detection thresholds
export const THREAT_THRESHOLDS = {
  HIGH_THREAT_SCORE: 60,
  CRITICAL_THREAT_SCORE: 80,
  EXFILTRATION_BYTES: 10 * 1024 * 1024, // 10 MB
  PORT_SCAN_PACKETS: 1000,
  PORT_SCAN_BYTES: 1000,
} as const;

// Suspicious ports
export const SUSPICIOUS_PORTS = [4444, 5555, 6666, 6667, 31337] as const;

// Activity thresholds
export const ACTIVITY_THRESHOLDS = {
  RECENT_ACTIVITY_HOURS: 1, // Consider activity "recent" if within 1 hour
  HIGH_ACTIVITY: 10,
  LOW_ACTIVITY: 3,
} as const;

// Polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
  FAST: 1000, // 1 second
  NORMAL: 5000, // 5 seconds
  SLOW: 30000, // 30 seconds
} as const;

// Default component props
export const DEFAULT_PROPS = {
  HOURS: 24,
  LIMIT: 10,
  SORT_BY: 'bytes' as const,
} as const;
