/**
 * WebSocket Client for Real-Time Updates
 *
 * This module provides a WebSocket client for real-time communication
 * with the AutoClaude backend. It handles:
 * - Connection management (connect, disconnect, reconnect)
 * - Message routing to appropriate Zustand stores
 * - Automatic reconnection on app foreground
 * - Connection state management
 *
 * Message Types:
 * - task_update: Updates to task status, execution state, etc.
 * - terminal_output: New terminal output lines
 * - chat_message: Streaming chat responses
 * - notification: Push notification triggers
 * - connection_status: Server connection state changes
 * - sync: General data synchronization
 */

import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';
import type {
  WebSocketMessage,
  WebSocketMessageType,
  Task,
  TaskUpdateInput,
  TaskStatus,
  TerminalOutputLine,
  ChatMessage,
  ConnectionStatus,
} from '../types';
import { useTaskStore } from '../stores/taskStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTerminalStore } from '../stores/terminalStore';
import { useChatStore } from '../stores/chatStore';

/**
 * WebSocket connection states
 */
export type WebSocketState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * WebSocket event handlers
 */
export interface WebSocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (code: number, reason: string) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onStateChange?: (state: WebSocketState) => void;
}

/**
 * WebSocket client configuration
 */
export interface WebSocketClientConfig {
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Ping interval in milliseconds (0 to disable) */
  pingInterval?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Enable automatic reconnection on app foreground */
  autoReconnectOnForeground?: boolean;
}

/**
 * Default WebSocket client configuration
 */
const defaultConfig: Required<WebSocketClientConfig> = {
  reconnectDelay: 3000,
  maxReconnectAttempts: 5,
  pingInterval: 30000,
  connectionTimeout: 10000,
  autoReconnectOnForeground: true,
};

/**
 * Payload types for WebSocket messages
 */
interface TaskUpdatePayload {
  taskId: string;
  updates: TaskUpdateInput;
}

interface TaskStatusChangePayload {
  taskId: string;
  status: TaskStatus;
  previousStatus: TaskStatus;
}

interface TerminalOutputPayload {
  sessionId: string;
  line: Omit<TerminalOutputLine, 'id'>;
}

interface ChatMessagePayload {
  sessionId: string;
  message: Partial<ChatMessage> & { content: string; tokenCount?: number };
  isStreaming?: boolean;
}

interface NotificationPayload {
  type: 'task_completed' | 'task_failed' | 'ai_review_ready' | 'human_review_needed' | 'github_update';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ConnectionStatusPayload {
  status: ConnectionStatus;
  message?: string;
}

interface SyncPayload {
  type: 'full' | 'partial';
  entities?: string[];
  timestamp: string;
}

/**
 * WebSocket Client Class
 *
 * Manages WebSocket connections for real-time updates.
 * Updates Zustand stores based on incoming messages.
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private config: Required<WebSocketClientConfig>;
  private state: WebSocketState = 'disconnected';
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private eventHandlers: WebSocketEventHandlers = {};
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private lastAppState: AppStateStatus = AppState.currentState;
  private wasConnectedBeforeBackground: boolean = false;

  constructor(config: WebSocketClientConfig = {}) {
    this.config = { ...defaultConfig, ...config };
    this.setupAppStateListener();
  }

  /**
   * Set up AppState listener for foreground/background transitions
   */
  private setupAppStateListener(): void {
    if (Platform.OS === 'web') return;

    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  /**
   * Handle app state changes (foreground/background)
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const wasBackground = this.lastAppState === 'background' || this.lastAppState === 'inactive';
    const isActive = nextAppState === 'active';

    // App came to foreground from background
    if (wasBackground && isActive) {
      this.handleAppForeground();
    }

    // App went to background
    if (this.lastAppState === 'active' && nextAppState !== 'active') {
      this.handleAppBackground();
    }

    this.lastAppState = nextAppState;
  }

  /**
   * Handle app coming to foreground
   */
  private handleAppForeground(): void {
    if (this.config.autoReconnectOnForeground && this.wasConnectedBeforeBackground) {
      // Reconnect if we were connected before going to background
      if (this.state === 'disconnected' || this.state === 'error') {
        this.reconnect();
      }
    }
  }

  /**
   * Handle app going to background
   */
  private handleAppBackground(): void {
    // Store whether we were connected before going to background
    this.wasConnectedBeforeBackground = this.state === 'connected';

    // Optionally disconnect when going to background to save resources
    // For now, we keep the connection alive
  }

  /**
   * Connect to WebSocket server
   */
  connect(url: string, handlers?: WebSocketEventHandlers): void {
    if (this.state === 'connecting' || this.state === 'connected') {
      return;
    }

    this.url = url;
    if (handlers) {
      this.eventHandlers = handlers;
    }

    this.setState('connecting');
    this.reconnectAttempts = 0;

    try {
      this.ws = new WebSocket(url);
      this.setupWebSocketHandlers();
      this.startConnectionTimeout();
    } catch (error) {
      this.setState('error');
      this.updateConnectionStatus('error');
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = (): void => {
      this.clearConnectionTimeout();
      this.setState('connected');
      this.reconnectAttempts = 0;
      this.updateConnectionStatus('connected');
      this.startPingInterval();
      this.eventHandlers.onConnect?.();
    };

    this.ws.onclose = (event: CloseEvent): void => {
      this.clearPingInterval();
      this.setState('disconnected');
      this.updateConnectionStatus('disconnected');
      this.eventHandlers.onDisconnect?.(event.code, event.reason);

      // Attempt reconnection if not intentional disconnect
      if (event.code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error: Event): void => {
      this.setState('error');
      this.updateConnectionStatus('error');
      this.eventHandlers.onError?.(error);
    };

    this.ws.onmessage = (event: MessageEvent): void => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.handleMessage(message);
        this.eventHandlers.onMessage?.(message);
      } catch {
        // Silently ignore malformed messages
      }
    };
  }

  /**
   * Handle incoming WebSocket messages
   * Routes messages to appropriate Zustand stores
   */
  handleMessage(message: WebSocketMessage): void {
    const { type, payload } = message;

    switch (type) {
      case 'task_update':
        this.handleTaskUpdate(payload as TaskUpdatePayload);
        break;

      case 'terminal_output':
        this.handleTerminalOutput(payload as TerminalOutputPayload);
        break;

      case 'chat_message':
        this.handleChatMessage(payload as ChatMessagePayload);
        break;

      case 'notification':
        this.handleNotification(payload as NotificationPayload);
        break;

      case 'connection_status':
        this.handleConnectionStatusMessage(payload as ConnectionStatusPayload);
        break;

      case 'sync':
        this.handleSync(payload as SyncPayload);
        break;

      default:
        // Unknown message type - ignore silently
        break;
    }
  }

  /**
   * Handle task update messages
   */
  private handleTaskUpdate(payload: TaskUpdatePayload): void {
    const { taskId, updates } = payload;
    const taskStore = useTaskStore.getState();

    // Check if this is a status change (move task)
    if (updates.status) {
      taskStore.moveTask(taskId, updates.status);
    } else {
      taskStore.updateTask(taskId, updates);
    }
  }

  /**
   * Handle terminal output messages
   */
  private handleTerminalOutput(payload: TerminalOutputPayload): void {
    const { sessionId, line } = payload;
    const terminalStore = useTerminalStore.getState();
    terminalStore.addOutputLine(sessionId, line);
  }

  /**
   * Handle chat message updates (including streaming)
   */
  private handleChatMessage(payload: ChatMessagePayload): void {
    const { sessionId, message, isStreaming } = payload;
    const chatStore = useChatStore.getState();

    // Switch to the session if it's not already active
    if (chatStore.currentSessionId !== sessionId) {
      chatStore.switchSession(sessionId);
    }

    if (isStreaming) {
      // Handle streaming content
      if (!chatStore.isStreaming) {
        chatStore.startStreamingResponse();
      }
      chatStore.updateStreamingContent(message.content);
    } else {
      // Complete message - finalize streaming if active
      if (chatStore.isStreaming) {
        chatStore.completeStreamingResponse(
          message.content,
          message.tokenCount
        );
      }
    }
  }

  /**
   * Handle notification messages
   * Triggers local notification display (to be implemented in notifications.ts)
   */
  private handleNotification(payload: NotificationPayload): void {
    // Store the notification for later processing
    // The actual notification display will be handled by the notifications utility
    // This allows the app to be notified of events even when notifications are off
    const notificationEvent = new CustomEvent('autoclaude:notification', {
      detail: payload,
    });

    // Emit event for notification handler (if running in browser context)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(notificationEvent);
    }
  }

  /**
   * Handle connection status messages from server
   */
  private handleConnectionStatusMessage(payload: ConnectionStatusPayload): void {
    const { status } = payload;
    this.updateConnectionStatus(status);
  }

  /**
   * Handle sync messages
   */
  private handleSync(_payload: SyncPayload): void {
    // Trigger a full or partial data refresh
    // This can be extended to invalidate TanStack Query caches
    // or trigger store refresh actions
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.clearReconnectTimer();
    this.clearPingInterval();
    this.clearConnectionTimeout();

    if (this.ws) {
      // Use code 1000 for intentional disconnect
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState('disconnected');
    this.updateConnectionStatus('disconnected');
  }

  /**
   * Reconnect to WebSocket server
   */
  reconnect(): void {
    if (!this.url) return;

    this.disconnect();
    this.setState('reconnecting');
    this.updateConnectionStatus('connecting');
    this.connect(this.url, this.eventHandlers);
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    this.setState('reconnecting');
    this.updateConnectionStatus('connecting');

    // Exponential backoff with jitter
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    ) + Math.random() * 1000;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.url) {
        this.connect(this.url, this.eventHandlers);
      }
    }, delay);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    if (this.config.pingInterval <= 0) return;

    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping', payload: { timestamp: new Date().toISOString() } });
    }, this.config.pingInterval);
  }

  /**
   * Clear ping interval
   */
  private clearPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Start connection timeout
   */
  private startConnectionTimeout(): void {
    this.connectionTimer = setTimeout(() => {
      if (this.state === 'connecting') {
        this.disconnect();
        this.setState('error');
        this.updateConnectionStatus('error');
      }
    }, this.config.connectionTimeout);
  }

  /**
   * Clear connection timeout
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  /**
   * Send a message through the WebSocket
   */
  send(message: WebSocketMessage | { type: string; payload: unknown }): boolean {
    if (this.ws && this.state === 'connected') {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Update internal state and notify listeners
   */
  private setState(newState: WebSocketState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.eventHandlers.onStateChange?.(newState);
    }
  }

  /**
   * Update connection status in settings store
   */
  private updateConnectionStatus(status: ConnectionStatus): void {
    const settingsStore = useSettingsStore.getState();
    settingsStore.setConnectionStatus(status);
  }

  /**
   * Get current WebSocket state
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Get reconnection attempts count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.disconnect();

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

/**
 * Singleton WebSocket client instance
 * Use this for app-wide WebSocket connections
 */
export const wsClient = new WebSocketClient();

/**
 * Connect to WebSocket server using settings from store
 * Convenience function that reads URL from settings
 */
export async function connectFromSettings(
  handlers?: WebSocketEventHandlers
): Promise<boolean> {
  const settingsStore = useSettingsStore.getState();
  const { serverUrl, websocketUrl, hasApiKey } = settingsStore.settings.connection;

  // Need both server URL and API key to connect
  if (!serverUrl || !hasApiKey) {
    return false;
  }

  // Use websocketUrl if specified, otherwise derive from serverUrl
  const wsUrl = websocketUrl || serverUrl.replace(/^http/, 'ws') + '/ws';

  try {
    const apiKey = await settingsStore.getApiKey();
    if (!apiKey) {
      return false;
    }

    // Include auth token in connection URL
    const authenticatedUrl = `${wsUrl}?token=${encodeURIComponent(apiKey)}`;
    wsClient.connect(authenticatedUrl, handlers);
    return true;
  } catch {
    return false;
  }
}

/**
 * Disconnect the singleton WebSocket client
 */
export function disconnectWebSocket(): void {
  wsClient.disconnect();
}

/**
 * Get current WebSocket connection state
 */
export function getWebSocketState(): WebSocketState {
  return wsClient.getState();
}

/**
 * Check if WebSocket is currently connected
 */
export function isWebSocketConnected(): boolean {
  return wsClient.isConnected();
}

/**
 * Send a message through the WebSocket
 */
export function sendWebSocketMessage(
  type: WebSocketMessageType,
  payload: unknown
): boolean {
  return wsClient.send({
    type,
    payload,
    timestamp: new Date().toISOString(),
  } as WebSocketMessage);
}
