import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ipc } from '../ipc-abstraction';

describe('IPC Abstraction', () => {
  beforeEach(() => {
    // Mock environment variables
    import.meta.env.VITE_WS_URL = 'ws://localhost:8765';
  });

  describe('API Compatibility', () => {
    it('should expose send method', () => {
      expect(typeof ipc.send).toBe('function');
    });

    it('should expose on method', () => {
      expect(typeof ipc.on).toBe('function');
    });

    it('should expose off method', () => {
      expect(typeof ipc.off).toBe('function');
    });

    it('should expose once method', () => {
      expect(typeof ipc.once).toBe('function');
    });

    it('should expose isConnected method', () => {
      expect(typeof ipc.isConnected).toBe('function');
    });
  });

  describe('Channel Routing', () => {
    it('should send messages without throwing', () => {
      expect(() => {
        ipc.send('test-channel', { data: 'test' });
      }).not.toThrow();
    });

    it('should register handlers without throwing', () => {
      const handler = vi.fn();
      expect(() => {
        ipc.on('test-channel', handler);
      }).not.toThrow();
    });

    it('should unregister handlers without throwing', () => {
      const handler = vi.fn();
      expect(() => {
        ipc.off('test-channel', handler);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle send gracefully', () => {
      expect(() => {
        ipc.send('test', {});
      }).not.toThrow();
    });

    it('should handle on gracefully', () => {
      expect(() => {
        ipc.on('test', () => {});
      }).not.toThrow();
    });
  });
});
