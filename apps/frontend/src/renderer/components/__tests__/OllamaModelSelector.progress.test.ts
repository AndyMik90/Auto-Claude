import { describe, it, expect } from 'vitest';

/**
 * Progress calculation utilities extracted from OllamaModelSelector
 * Tests for speed, time, and percentage calculations
 */

interface ProgressTracking {
  lastCompleted: number;
  lastUpdate: number;
}

// Core calculation functions (same as component implementation)
function calculateSpeed(bytesDelta: number, timeDelta: number): number {
  if (timeDelta <= 0) return 0;
  return (bytesDelta / timeDelta) * 1000;
}

function formatSpeed(speed: number): string {
  if (speed <= 0) return '';
  if (speed > 1024 * 1024) {
    return `${(speed / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  if (speed > 1024) {
    return `${(speed / 1024).toFixed(1)} KB/s`;
  }
  return `${Math.round(speed)} B/s`;
}

function calculateTimeRemaining(remaining: number, speed: number): number {
  if (speed <= 0) return 0;
  return Math.ceil(remaining / speed);
}

function formatTimeRemaining(timeRemaining: number): string {
  if (timeRemaining <= 0) return '';
  if (timeRemaining > 3600) {
    return `${Math.ceil(timeRemaining / 3600)}h remaining`;
  }
  if (timeRemaining > 60) {
    return `${Math.ceil(timeRemaining / 60)}m remaining`;
  }
  return `${Math.ceil(timeRemaining)}s remaining`;
}

function calculatePercentage(completed: number, total: number): number {
  if (total <= 0) return 0;
  const percentage = (completed / total) * 100;
  return Math.max(0, Math.min(100, percentage));
}

describe('Progress Calculations', () => {
  describe('Speed', () => {
    it('should calculate speed from bytes and time delta', () => {
      // 1000 bytes in 100ms = 10,000 bytes/sec
      const speed = calculateSpeed(1000, 100);
      expect(speed).toBe(10000);
    });

    it('should return 0 for invalid time delta', () => {
      expect(calculateSpeed(1000, 0)).toBe(0);
      expect(calculateSpeed(1000, -100)).toBe(0);
    });

    it('should format speed as MB/s', () => {
      const speed = 5 * 1024 * 1024; // 5 MB/s
      expect(formatSpeed(speed)).toBe('5.0 MB/s');
    });

    it('should format speed as KB/s', () => {
      const speed = 500 * 1024; // 500 KB/s
      expect(formatSpeed(speed)).toBe('500.0 KB/s');
    });

    it('should format speed as B/s', () => {
      const speed = 500; // 500 B/s
      expect(formatSpeed(speed)).toBe('500 B/s');
    });

    it('should return empty string for zero speed', () => {
      expect(formatSpeed(0)).toBe('');
    });
  });

  describe('Time Remaining', () => {
    it('should calculate time remaining', () => {
      const remaining = 1024 * 1024; // 1 MB
      const speed = 1024 * 1024; // 1 MB/s
      expect(calculateTimeRemaining(remaining, speed)).toBe(1);
    });

    it('should return 0 for invalid speed', () => {
      expect(calculateTimeRemaining(1000000, 0)).toBe(0);
      expect(calculateTimeRemaining(1000000, -1000)).toBe(0);
    });

    it('should format time as seconds', () => {
      expect(formatTimeRemaining(30)).toBe('30s remaining');
    });

    it('should format time as minutes', () => {
      expect(formatTimeRemaining(150)).toBe('3m remaining');
    });

    it('should format time as hours', () => {
      expect(formatTimeRemaining(7200)).toBe('2h remaining');
    });

    it('should return empty string for zero time', () => {
      expect(formatTimeRemaining(0)).toBe('');
    });
  });

  describe('Percentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculatePercentage(50, 100)).toBe(50);
      expect(calculatePercentage(1, 4)).toBe(25);
    });

    it('should clamp percentage between 0 and 100', () => {
      expect(calculatePercentage(-100, 100)).toBe(0);
      expect(calculatePercentage(200, 100)).toBe(100);
      expect(calculatePercentage(0, 0)).toBe(0);
    });
  });

  describe('Real-world Download Scenario', () => {
    it('should calculate metrics for a typical download', () => {
      // Simulate: 100 MB downloaded in 1 second, 500 MB total
      const completed = 100 * 1024 * 1024;
      const total = 500 * 1024 * 1024;
      const speed = calculateSpeed(completed, 1000);
      const remaining = total - completed;
      const timeRemaining = calculateTimeRemaining(remaining, speed);
      const percentage = calculatePercentage(completed, total);

      expect(formatSpeed(speed)).toContain('MB/s');
      expect(formatTimeRemaining(timeRemaining)).toContain('remaining');
      expect(percentage).toBe(20);
    });

    it('should handle very fast downloads', () => {
      // 100 MB in 1 second (very fast)
      const speed = calculateSpeed(100 * 1024 * 1024, 1000);
      expect(formatSpeed(speed)).toContain('100');
    });

    it('should handle very slow downloads', () => {
      // 1000 bytes in 1 second (very slow)
      const speed = calculateSpeed(1000, 1000);
      expect(formatSpeed(speed)).toContain('1000 B/s');
    });
  });
});
