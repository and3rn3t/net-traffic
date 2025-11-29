/**
 * Unit tests for formatter utility functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatBytes,
  formatBytesShort,
  formatDuration,
  formatTimestamp,
  formatRate,
  getThreatColor,
  getThreatBgColor,
  getDeviceIcon,
} from '@/lib/formatters';

describe('formatters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatBytes', () => {
    it('should format zero bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(512)).toBe('512.00 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1536)).toBe('1.50 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(formatBytes(5.5 * 1024 * 1024 * 1024)).toBe('5.50 GB');
    });

    it('should format terabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
    });
  });

  describe('formatBytesShort', () => {
    it('should format zero bytes', () => {
      expect(formatBytesShort(0)).toBe('0 B');
    });

    it('should format with one decimal place', () => {
      expect(formatBytesShort(1024)).toBe('1.0 KB');
      expect(formatBytesShort(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytesShort(1024 * 1024)).toBe('1.0 MB');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(5000)).toBe('5.0s');
      expect(formatDuration(59000)).toBe('59.0s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(3660000)).toBe('1h 1m');
      expect(formatDuration(7200000)).toBe('2h 0m');
    });
  });

  describe('formatTimestamp', () => {
    it('should format "just now" for recent timestamps', () => {
      const now = Date.now();
      expect(formatTimestamp(now - 30000)).toBe('just now');
      expect(formatTimestamp(now - 50000)).toBe('just now');
    });

    it('should format minutes ago', () => {
      const now = Date.now();
      expect(formatTimestamp(now - 60000)).toBe('1m ago');
      expect(formatTimestamp(now - 120000)).toBe('2m ago');
      expect(formatTimestamp(now - 3000000)).toBe('50m ago');
    });

    it('should format hours ago', () => {
      const now = Date.now();
      expect(formatTimestamp(now - 3600000)).toBe('1h ago');
      expect(formatTimestamp(now - 7200000)).toBe('2h ago');
      expect(formatTimestamp(now - 82800000)).toBe('23h ago');
    });

    it('should format date for older timestamps', () => {
      const timestamp = new Date('2023-12-01T10:30:00Z').getTime();
      const formatted = formatTimestamp(timestamp);

      // Should contain month abbreviation
      expect(formatted).toMatch(/Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov/);
      // Should contain day
      expect(formatted).toMatch(/\d+/);
    });
  });

  describe('formatRate', () => {
    it('should format bytes per second', () => {
      expect(formatRate(1024)).toBe('1.0 KB/s');
      expect(formatRate(1024 * 1024)).toBe('1.0 MB/s');
    });
  });

  describe('getThreatColor', () => {
    it('should return correct color class for safe level', () => {
      expect(getThreatColor('safe')).toBe('text-success');
    });

    it('should return correct color class for low level', () => {
      expect(getThreatColor('low')).toBe('text-warning');
    });

    it('should return correct color class for medium level', () => {
      expect(getThreatColor('medium')).toBe('text-warning');
    });

    it('should return correct color class for high level', () => {
      expect(getThreatColor('high')).toBe('text-destructive');
    });

    it('should return correct color class for critical level', () => {
      expect(getThreatColor('critical')).toBe('text-destructive');
    });

    it('should return default color for unknown level', () => {
      expect(getThreatColor('unknown')).toBe('text-muted-foreground');
      expect(getThreatColor('')).toBe('text-muted-foreground');
    });
  });

  describe('getThreatBgColor', () => {
    it('should return correct background for safe level', () => {
      expect(getThreatBgColor('safe')).toBe('bg-success/10 border-success/20');
    });

    it('should return correct background for low level', () => {
      expect(getThreatBgColor('low')).toBe('bg-warning/10 border-warning/20');
    });

    it('should return correct background for medium level', () => {
      expect(getThreatBgColor('medium')).toBe('bg-warning/20 border-warning/30');
    });

    it('should return correct background for high level', () => {
      expect(getThreatBgColor('high')).toBe('bg-destructive/10 border-destructive/20');
    });

    it('should return correct background for critical level', () => {
      expect(getThreatBgColor('critical')).toBe('bg-destructive/20 border-destructive/30');
    });

    it('should return default background for unknown level', () => {
      expect(getThreatBgColor('unknown')).toBe('bg-muted border-border');
      expect(getThreatBgColor('')).toBe('bg-muted border-border');
    });
  });

  describe('getDeviceIcon', () => {
    it('should return correct icon for smartphone', () => {
      expect(getDeviceIcon('smartphone')).toBe('📱');
    });

    it('should return correct icon for laptop', () => {
      expect(getDeviceIcon('laptop')).toBe('💻');
    });

    it('should return correct icon for desktop', () => {
      expect(getDeviceIcon('desktop')).toBe('🖥️');
    });

    it('should return correct icon for tablet', () => {
      expect(getDeviceIcon('tablet')).toBe('📱');
    });

    it('should return correct icon for iot', () => {
      expect(getDeviceIcon('iot')).toBe('🔌');
    });

    it('should return correct icon for server', () => {
      expect(getDeviceIcon('server')).toBe('🖥️');
    });

    it('should return unknown icon for unknown type', () => {
      expect(getDeviceIcon('unknown')).toBe('❓');
      expect(getDeviceIcon('nonexistent')).toBe('❓');
      expect(getDeviceIcon('')).toBe('❓');
    });
  });
});
