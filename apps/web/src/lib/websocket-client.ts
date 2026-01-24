/**
 * WebSocket Client with Connection Management
 *
 * Production-ready WebSocket client featuring:
 * - Connection state management
 * - Automatic reconnection with exponential backoff
 * - Message queuing for offline periods
 * - Heartbeat/ping-pong for connection health
 * - Event-based architecture for connection status
 */

export enum WebSocketState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTING = 'DISCONNECTING',
  ERROR = 'ERROR'
}

export type WebSocketMessage = {
  channel: string;
  data: any;
};

export type WebSocketEventHandler = (data: any) => void;

export type ConnectionStatusListener = (state: WebSocketState, error?: Error) => void;

interface QueuedMessage {
  channel: string;
  data: any;
  timestamp: number;
}

interface ReconnectionConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
  backoffMultiplier: number;
}

interface HeartbeatConfig {
  intervalMs: number;
  timeoutMs: number;
  channel: string;
}

const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  maxAttempts: 10,
  backoffMultiplier: 2
};

const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  intervalMs: 30000,
  timeoutMs: 5000,
  channel: 'ping'
};

const MAX_QUEUE_SIZE = 100;
const MESSAGE_QUEUE_TTL_MS = 60000; // 1 minute

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private state: WebSocketState = WebSocketState.DISCONNECTED;

  // Event handlers
  private channelHandlers = new Map<string, Set<WebSocketEventHandler>>();
  private statusListeners = new Set<ConnectionStatusListener>();

  // Message queue for offline periods
  private messageQueue: QueuedMessage[] = [];

  // Reconnection state
  private reconnectionConfig: ReconnectionConfig;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  // Heartbeat state
  private heartbeatConfig: HeartbeatConfig;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastHeartbeatTime: number = 0;

  constructor(
    url: string,
    reconnectionConfig?: Partial<ReconnectionConfig>,
    heartbeatConfig?: Partial<HeartbeatConfig>
  ) {
    this.url = url;
    this.reconnectionConfig = { ...DEFAULT_RECONNECTION_CONFIG, ...reconnectionConfig };
    this.heartbeatConfig = { ...DEFAULT_HEARTBEAT_CONFIG, ...heartbeatConfig };
  }

  /**
   * Connect to the WebSocket server
   */
  public connect(): void {
    if (this.state === WebSocketState.CONNECTED || this.state === WebSocketState.CONNECTING) {
      console.warn('[WebSocket] Already connected or connecting');
      return;
    }

    this.setState(WebSocketState.CONNECTING);
    this.shouldReconnect = true;

    try {
      this.ws = new WebSocket(this.url);
      this.setupWebSocketHandlers();
    } catch (error) {
      this.handleConnectionError(error as Error);
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.ws) {
      this.setState(WebSocketState.DISCONNECTING);

      try {
        this.ws.close(1000, 'Client disconnect');
      } catch (error) {
        console.error('[WebSocket] Error during disconnect:', error);
      }

      this.ws = null;
    }

    this.setState(WebSocketState.DISCONNECTED);
  }

  /**
   * Send a message on a specific channel
   */
  public send(channel: string, data: any): void {
    const message: WebSocketMessage = { channel, data };

    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WebSocket] Failed to send message:', error);
        this.queueMessage(channel, data);
      }
    } else {
      console.warn(`[WebSocket] Not connected (state: ${this.state}), queueing message for channel: ${channel}`);
      this.queueMessage(channel, data);
    }
  }

  /**
   * Subscribe to messages on a specific channel
   */
  public on(channel: string, handler: WebSocketEventHandler): void {
    if (!this.channelHandlers.has(channel)) {
      this.channelHandlers.set(channel, new Set());
    }
    this.channelHandlers.get(channel)!.add(handler);
  }

  /**
   * Unsubscribe from messages on a specific channel
   */
  public off(channel: string, handler: WebSocketEventHandler): void {
    const handlers = this.channelHandlers.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.channelHandlers.delete(channel);
      }
    }
  }

  /**
   * Subscribe to connection status changes
   */
  public onStatusChange(listener: ConnectionStatusListener): void {
    this.statusListeners.add(listener);
  }

  /**
   * Unsubscribe from connection status changes
   */
  public offStatusChange(listener: ConnectionStatusListener): void {
    this.statusListeners.delete(listener);
  }

  /**
   * Get current connection state
   */
  public getState(): WebSocketState {
    return this.state;
  }

  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED;
  }

  // Private methods

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.handleConnectionOpen();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event);
    };

    this.ws.onerror = (event) => {
      this.handleConnectionError(new Error('WebSocket error'));
    };

    this.ws.onclose = (event) => {
      this.handleConnectionClose(event);
    };
  }

  private handleConnectionOpen(): void {
    console.log('[WebSocket] Connection established');
    this.setState(WebSocketState.CONNECTED);
    this.reconnectAttempt = 0;
    this.startHeartbeat();
    this.flushMessageQueue();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;

      // Update heartbeat timestamp if this is a pong
      if (message.channel === this.heartbeatConfig.channel) {
        this.lastHeartbeatTime = Date.now();
        this.clearHeartbeatTimeout();
        return;
      }

      // Dispatch to channel handlers
      const handlers = this.channelHandlers.get(message.channel);
      if (handlers && handlers.size > 0) {
        handlers.forEach(handler => {
          try {
            handler(message.data);
          } catch (error) {
            console.error(`[WebSocket] Error in channel handler for ${message.channel}:`, error);
          }
        });
      } else {
        console.warn(`[WebSocket] No handlers registered for channel: ${message.channel}`);
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }

  private handleConnectionError(error: Error): void {
    console.error('[WebSocket] Connection error:', error);
    this.setState(WebSocketState.ERROR, error);
  }

  private handleConnectionClose(event: CloseEvent): void {
    console.log(`[WebSocket] Connection closed (code: ${event.code}, reason: ${event.reason})`);
    this.stopHeartbeat();
    this.ws = null;

    if (this.shouldReconnect && this.state !== WebSocketState.DISCONNECTING) {
      this.attemptReconnect();
    } else {
      this.setState(WebSocketState.DISCONNECTED);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempt >= this.reconnectionConfig.maxAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.setState(WebSocketState.ERROR, new Error('Max reconnection attempts reached'));
      this.shouldReconnect = false;
      return;
    }

    this.setState(WebSocketState.RECONNECTING);
    this.reconnectAttempt++;

    const delay = Math.min(
      this.reconnectionConfig.initialDelayMs * Math.pow(this.reconnectionConfig.backoffMultiplier, this.reconnectAttempt - 1),
      this.reconnectionConfig.maxDelayMs
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}/${this.reconnectionConfig.maxAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(state: WebSocketState, error?: Error): void {
    if (this.state !== state) {
      this.state = state;
      console.log(`[WebSocket] State changed to: ${state}`);

      // Notify listeners
      this.statusListeners.forEach(listener => {
        try {
          listener(state, error);
        } catch (err) {
          console.error('[WebSocket] Error in status listener:', err);
        }
      });
    }
  }

  private queueMessage(channel: string, data: any): void {
    // Remove expired messages
    const now = Date.now();
    this.messageQueue = this.messageQueue.filter(
      msg => now - msg.timestamp < MESSAGE_QUEUE_TTL_MS
    );

    // Add new message if queue not full
    if (this.messageQueue.length < MAX_QUEUE_SIZE) {
      this.messageQueue.push({ channel, data, timestamp: now });
    } else {
      console.warn('[WebSocket] Message queue full, dropping oldest message');
      this.messageQueue.shift();
      this.messageQueue.push({ channel, data, timestamp: now });
    }
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`[WebSocket] Flushing ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(({ channel, data }) => {
      this.send(channel, data);
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendHeartbeat();
      }
    }, this.heartbeatConfig.intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clearHeartbeatTimeout();
  }

  private sendHeartbeat(): void {
    this.send(this.heartbeatConfig.channel, { timestamp: Date.now() });

    // Set timeout for pong response
    this.heartbeatTimeout = setTimeout(() => {
      console.warn('[WebSocket] Heartbeat timeout - connection may be dead');
      this.handleConnectionError(new Error('Heartbeat timeout'));

      // Close the connection to trigger reconnect
      if (this.ws) {
        this.ws.close();
      }
    }, this.heartbeatConfig.timeoutMs);
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }
}

// Singleton instance for default WebSocket connection
let defaultInstance: WebSocketClient | null = null;

/**
 * Get or create the default WebSocket client instance
 */
export function getDefaultWebSocketClient(url?: string): WebSocketClient {
  if (!defaultInstance) {
    if (!url) {
      throw new Error('WebSocket URL required for first initialization');
    }
    defaultInstance = new WebSocketClient(url);
  }
  return defaultInstance;
}

/**
 * Create a new WebSocket client instance
 */
export function createWebSocketClient(
  url: string,
  reconnectionConfig?: Partial<ReconnectionConfig>,
  heartbeatConfig?: Partial<HeartbeatConfig>
): WebSocketClient {
  return new WebSocketClient(url, reconnectionConfig, heartbeatConfig);
}
