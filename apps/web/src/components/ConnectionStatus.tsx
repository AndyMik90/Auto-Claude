/**
 * ConnectionStatus - Display WebSocket connection status in the UI
 *
 * Shows the current WebSocket connection state with appropriate icons and colors:
 * - CONNECTED: Green indicator with check icon
 * - CONNECTING: Yellow indicator with loading animation
 * - RECONNECTING: Yellow indicator with refresh icon
 * - DISCONNECTED: Red indicator with X icon
 * - ERROR: Red indicator with alert icon
 *
 * The component automatically updates when the connection state changes.
 */

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { ipc } from '../lib/ipc-abstraction';
import { WebSocketState } from '../lib/websocket-client';

export function ConnectionStatus() {
  const [connectionState, setConnectionState] = useState<WebSocketState>(
    WebSocketState.DISCONNECTED
  );

  useEffect(() => {
    // Initialize IPC connection
    ipc.initialize();

    // Get initial state
    const initialState = ipc.getConnectionState();
    if (initialState) {
      setConnectionState(initialState);
    }

    // Listen for connection state changes
    const handleStatusChange = (state: WebSocketState) => {
      setConnectionState(state);
    };

    ipc.onConnectionStatusChange(handleStatusChange);

    // Cleanup listener on unmount
    return () => {
      ipc.offConnectionStatusChange(handleStatusChange);
    };
  }, []);

  // Determine icon, color, and label based on state
  const getStateIndicator = () => {
    switch (connectionState) {
      case WebSocketState.CONNECTED:
        return {
          icon: Wifi,
          color: 'bg-green-500/10 text-green-500 border-green-500/20',
          label: 'Connected',
          animate: false
        };
      case WebSocketState.CONNECTING:
        return {
          icon: Loader2,
          color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
          label: 'Connecting',
          animate: true
        };
      case WebSocketState.RECONNECTING:
        return {
          icon: RefreshCw,
          color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
          label: 'Reconnecting',
          animate: true
        };
      case WebSocketState.ERROR:
        return {
          icon: AlertCircle,
          color: 'bg-red-500/10 text-red-500 border-red-500/20',
          label: 'Error',
          animate: false
        };
      case WebSocketState.DISCONNECTING:
        return {
          icon: Loader2,
          color: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
          label: 'Disconnecting',
          animate: true
        };
      case WebSocketState.DISCONNECTED:
      default:
        return {
          icon: WifiOff,
          color: 'bg-red-500/10 text-red-500 border-red-500/20',
          label: 'Disconnected',
          animate: false
        };
    }
  };

  const { icon: Icon, color, label, animate } = getStateIndicator();

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all ${color}`}
        title={`WebSocket: ${label}`}
      >
        <Icon
          className={`h-3.5 w-3.5 ${animate ? 'motion-safe:animate-spin' : ''}`}
        />
        <span className="text-xs font-semibold">{label}</span>
      </div>
    </div>
  );
}
