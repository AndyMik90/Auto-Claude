/**
 * IPC Abstraction Layer
 *
 * Mimics Electron's IPC API for seamless migration of frontend components.
 * Replaces Electron IPC calls with WebSocket communication.
 *
 * Usage (matches Electron IPC API):
 *   ipc.send('channel-name', data)
 *   ipc.on('response-channel', (data) => { ... })
 *   ipc.off('response-channel', handler)
 */

import { getDefaultWebSocketClient, WebSocketClient, WebSocketState } from './websocket-client';

/**
 * IPC handler function signature
 * Note: Unlike Electron IPC which passes (event, data), we only pass data
 * since there's no concept of 'event' in WebSocket context
 */
export type IpcHandler = (data: any) => void;

/**
 * IPC Abstraction Class
 * Provides Electron-like IPC API backed by WebSocket
 */
class IpcAbstraction {
  private wsClient: WebSocketClient | null = null;
  private isInitialized = false;

  /**
   * Initialize the IPC abstraction with WebSocket URL
   * Called automatically on first use, or can be called explicitly
   */
  public initialize(url?: string): void {
    if (this.isInitialized) {
      console.warn('[IPC] Already initialized');
      return;
    }

    const wsUrl = url || import.meta.env.VITE_WS_URL || 'ws://localhost:8765';

    try {
      this.wsClient = getDefaultWebSocketClient(wsUrl);
      this.wsClient.connect();
      this.isInitialized = true;
      console.log('[IPC] Initialized with WebSocket URL:', wsUrl);
    } catch (error) {
      console.error('[IPC] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Send a message on a specific channel (matches Electron IPC API)
   * @param channel - The channel name
   * @param data - The data to send
   */
  public send(channel: string, data?: any): void {
    this.ensureInitialized();

    if (!this.wsClient) {
      console.error('[IPC] WebSocket client not initialized');
      return;
    }

    this.wsClient.send(channel, data);
  }

  /**
   * Listen for messages on a specific channel (matches Electron IPC API)
   * @param channel - The channel name
   * @param handler - The handler function (receives data only, no event object)
   */
  public on(channel: string, handler: IpcHandler): void {
    this.ensureInitialized();

    if (!this.wsClient) {
      console.error('[IPC] WebSocket client not initialized');
      return;
    }

    this.wsClient.on(channel, handler);
  }

  /**
   * Remove a message listener from a channel (matches Electron IPC API)
   * @param channel - The channel name
   * @param handler - The handler function to remove
   */
  public off(channel: string, handler: IpcHandler): void {
    if (!this.wsClient) {
      console.error('[IPC] WebSocket client not initialized');
      return;
    }

    this.wsClient.off(channel, handler);
  }

  /**
   * Listen for a single message on a channel, then remove the listener
   * @param channel - The channel name
   * @param handler - The handler function
   */
  public once(channel: string, handler: IpcHandler): void {
    this.ensureInitialized();

    if (!this.wsClient) {
      console.error('[IPC] WebSocket client not initialized');
      return;
    }

    const wrappedHandler: IpcHandler = (data: any) => {
      handler(data);
      this.off(channel, wrappedHandler);
    };

    this.on(channel, wrappedHandler);
  }

  /**
   * Get the current connection state
   */
  public getConnectionState(): WebSocketState | null {
    return this.wsClient?.getState() || null;
  }

  /**
   * Check if the WebSocket is connected
   */
  public isConnected(): boolean {
    return this.wsClient?.isConnected() || false;
  }

  /**
   * Listen for connection status changes
   */
  public onConnectionStatusChange(listener: (state: WebSocketState, error?: Error) => void): void {
    this.ensureInitialized();

    if (!this.wsClient) {
      console.error('[IPC] WebSocket client not initialized');
      return;
    }

    this.wsClient.onStatusChange(listener);
  }

  /**
   * Remove connection status listener
   */
  public offConnectionStatusChange(listener: (state: WebSocketState, error?: Error) => void): void {
    if (!this.wsClient) {
      return;
    }

    this.wsClient.offStatusChange(listener);
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.isInitialized = false;
      this.wsClient = null;
    }
  }

  /**
   * Reconnect to the WebSocket server
   */
  public reconnect(): void {
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient.connect();
    } else {
      this.initialize();
    }
  }

  /**
   * Ensure the IPC abstraction is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      this.initialize();
    }
  }
}

// Singleton instance
const ipcInstance = new IpcAbstraction();

/**
 * IPC object - mimics Electron's window.electron.ipcRenderer API
 *
 * Usage:
 *   import { ipc } from '@/lib/ipc-abstraction'
 *
 *   // Send a message
 *   ipc.send('create-task', { title: 'New Task' })
 *
 *   // Listen for messages
 *   ipc.on('task-created', (data) => {
 *     console.log('Task created:', data)
 *   })
 *
 *   // Remove listener
 *   ipc.off('task-created', handler)
 *
 *   // Listen once
 *   ipc.once('task-created', (data) => {
 *     console.log('Task created:', data)
 *   })
 */
export const ipc = {
  send: (channel: string, data?: any) => ipcInstance.send(channel, data),
  on: (channel: string, handler: IpcHandler) => ipcInstance.on(channel, handler),
  off: (channel: string, handler: IpcHandler) => ipcInstance.off(channel, handler),
  once: (channel: string, handler: IpcHandler) => ipcInstance.once(channel, handler),
  isConnected: () => ipcInstance.isConnected(),
  getConnectionState: () => ipcInstance.getConnectionState(),
  onConnectionStatusChange: (listener: (state: WebSocketState, error?: Error) => void) =>
    ipcInstance.onConnectionStatusChange(listener),
  offConnectionStatusChange: (listener: (state: WebSocketState, error?: Error) => void) =>
    ipcInstance.offConnectionStatusChange(listener),
  disconnect: () => ipcInstance.disconnect(),
  reconnect: () => ipcInstance.reconnect(),
  initialize: (url?: string) => ipcInstance.initialize(url)
};

/**
 * Export the IPC instance for advanced usage
 */
export default ipc;
