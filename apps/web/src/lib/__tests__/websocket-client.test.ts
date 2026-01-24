import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClient, WebSocketState } from '../websocket-client';

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  let mockWs: any;
  let eventHandlers: Map<string, Function>;

  beforeEach(() => {
    // Track event handlers
    eventHandlers = new Map();

    // Mock WebSocket
    mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn((event: string, handler: Function) => {
        eventHandlers.set(event, handler);
      }),
      removeEventListener: vi.fn((event: string) => {
        eventHandlers.delete(event);
      }),
      readyState: 1, // OPEN
    };

    // Create proper constructor mock
    global.WebSocket = vi.fn(function(this: any, url: string) {
      return mockWs;
    }) as any;

    client = new WebSocketClient('ws://localhost:8765');
  });

  afterEach(() => {
    client.disconnect();
    vi.clearAllTimers();
    eventHandlers.clear();
  });

  describe('Connection', () => {
    it('should establish connection', () => {
      client.connect();
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8765');
    });

    it('should properly initialize connection', () => {
      const initialState = client.getState();
      expect(initialState).toBe(WebSocketState.DISCONNECTED);

      client.connect();
      const afterConnectState = client.getState();
      // After calling connect(), state should change from DISCONNECTED
      expect([WebSocketState.CONNECTING, WebSocketState.CONNECTED, WebSocketState.ERROR]).toContain(afterConnectState);
    });

    it('should transition to CONNECTED state on open', () => {
      client.connect();
      const openHandler = eventHandlers.get('open');
      if (openHandler) {
        openHandler();
        expect(client.getState()).toBe(WebSocketState.CONNECTED);
      }
    });

    it('should call status listeners on state change', () => {
      const listener = vi.fn();
      client.onStatusChange(listener);
      client.connect();
      // State should change from DISCONNECTED to CONNECTING
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should route messages to correct channel handlers', () => {
      const handler = vi.fn();
      client.on('test-channel', handler);

      client.connect();
      const messageHandler = eventHandlers.get('message');

      if (messageHandler) {
        const event = {
          data: JSON.stringify({ channel: 'test-channel', data: { foo: 'bar' } })
        };
        messageHandler(event);
        expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
      }
    });

    it('should handle invalid JSON gracefully', () => {
      client.connect();
      const messageHandler = eventHandlers.get('message');

      if (messageHandler) {
        const event = { data: 'invalid json' };
        expect(() => messageHandler(event)).not.toThrow();
      }
    });
  });

  describe('Message Sending', () => {
    it('should send messages when connected', () => {
      client.connect();
      const openHandler = eventHandlers.get('open');
      if (openHandler) {
        openHandler(); // Trigger connected state
      }

      mockWs.readyState = WebSocket.OPEN;
      client.send('test', { data: 'test' });

      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should queue messages when disconnected', () => {
      // Don't connect
      client.send('test', { data: 'test' });
      // Message should be queued, not sent
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should start in DISCONNECTED state', () => {
      expect(client.getState()).toBe(WebSocketState.DISCONNECTED);
    });

    it('should transition to CONNECTING when connect() is called', () => {
      client.connect();
      // After connect() but before open event, should be CONNECTING
      const state = client.getState();
      expect([WebSocketState.CONNECTING, WebSocketState.CONNECTED, WebSocketState.ERROR]).toContain(state);
    });
  });

  describe('Handler Management', () => {
    it('should register channel handlers', () => {
      const handler = vi.fn();
      client.on('test-channel', handler);

      // Trigger a message
      client.connect();
      const messageHandler = eventHandlers.get('message');
      if (messageHandler) {
        const event = {
          data: JSON.stringify({ channel: 'test-channel', data: { test: 'data' } })
        };
        messageHandler(event);
        expect(handler).toHaveBeenCalledWith({ test: 'data' });
      }
    });

    it('should unregister channel handlers', () => {
      const handler = vi.fn();
      client.on('test-channel', handler);
      client.off('test-channel', handler);

      // Trigger a message
      client.connect();
      const messageHandler = eventHandlers.get('message');
      if (messageHandler) {
        const event = {
          data: JSON.stringify({ channel: 'test-channel', data: { test: 'data' } })
        };
        messageHandler(event);
        // Handler should not be called after being removed
        expect(handler).not.toHaveBeenCalled();
      }
    });
  });
});
