/**
 * ConnectionStatus Component
 * Displays WebSocket connection state in header or status bar
 * Shows connected, disconnected, connecting, and reconnecting states
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Pressable } from 'react-native';
import { Text, Surface, Tooltip } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius } from '../theme';
import { useConnectionStatus } from '../stores/settingsStore';
import { getWebSocketState, wsClient } from '../api/websocket';
import type { ConnectionStatus as ConnectionStatusType } from '../types';
import type { WebSocketState } from '../api/websocket';

/**
 * Connection state configuration with colors and icons
 */
interface StateConfig {
  color: string;
  icon: string;
  label: string;
  animate: boolean;
}

/**
 * State configuration mapping
 */
const STATE_CONFIG: Record<WebSocketState, StateConfig> = {
  connected: {
    color: colors.status.success,
    icon: 'wifi',
    label: 'Connected',
    animate: false,
  },
  disconnected: {
    color: colors.status.error,
    icon: 'wifi-off',
    label: 'Disconnected',
    animate: false,
  },
  connecting: {
    color: colors.status.warning,
    icon: 'wifi-sync',
    label: 'Connecting...',
    animate: true,
  },
  reconnecting: {
    color: colors.status.warning,
    icon: 'wifi-sync',
    label: 'Reconnecting...',
    animate: true,
  },
  error: {
    color: colors.status.error,
    icon: 'wifi-alert',
    label: 'Connection Error',
    animate: false,
  },
};

/**
 * Fallback state config for unknown connection status
 */
const FALLBACK_CONFIG: StateConfig = {
  color: colors.text.muted,
  icon: 'wifi-off',
  label: 'Unknown',
  animate: false,
};

/**
 * Map ConnectionStatus type from settings to WebSocketState
 */
function mapConnectionStatus(status: ConnectionStatusType): WebSocketState {
  switch (status) {
    case 'connected':
      return 'connected';
    case 'connecting':
      return 'connecting';
    case 'disconnected':
      return 'disconnected';
    case 'error':
      return 'error';
    default:
      return 'disconnected';
  }
}

/**
 * Props for ConnectionStatus component
 */
interface ConnectionStatusProps {
  /** Display mode: 'indicator' (small dot), 'compact' (icon only), 'full' (icon + label) */
  mode?: 'indicator' | 'compact' | 'full';
  /** Called when the status indicator is pressed */
  onPress?: () => void;
  /** Whether to show tooltip on hover/long press */
  showTooltip?: boolean;
  /** Custom style for the container */
  style?: object;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Animated pulse indicator for connecting/reconnecting states
 */
const PulseIndicator: React.FC<{ color: string; size: number }> = ({ color, size }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.pulseIndicator,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: pulseAnim,
        },
      ]}
      accessibilityElementsHidden
    />
  );
};

/**
 * ConnectionStatus Component
 * Shows WebSocket connection state with visual indicators
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  mode = 'compact',
  onPress,
  showTooltip = true,
  style,
  testID,
}) => {
  // Get connection status from settings store (synced by WebSocket client)
  const connectionStatus = useConnectionStatus();

  // Get the actual WebSocket state for more accurate status
  // The settings store connectionStatus is kept in sync by the WebSocket client
  const wsState = useMemo(() => {
    // Try to get the direct WebSocket state first
    const directState = getWebSocketState();
    // Fall back to settings store if WebSocket client hasn't been used
    if (directState === 'disconnected' && connectionStatus === 'connecting') {
      return 'connecting';
    }
    return directState;
  }, [connectionStatus]);

  // Get configuration for current state
  const stateConfig = useMemo(() => {
    return STATE_CONFIG[wsState] || FALLBACK_CONFIG;
  }, [wsState]);

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    return `Connection status: ${stateConfig.label}`;
  }, [stateConfig.label]);

  // Render indicator-only mode (small colored dot)
  if (mode === 'indicator') {
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={[styles.indicatorContainer, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityHint={onPress ? 'Tap to view connection details' : undefined}
        testID={testID}
      >
        {stateConfig.animate ? (
          <PulseIndicator color={stateConfig.color} size={10} />
        ) : (
          <View
            style={[
              styles.indicatorDot,
              { backgroundColor: stateConfig.color },
            ]}
          />
        )}
      </Pressable>
    );
  }

  // Render compact mode (icon only)
  if (mode === 'compact') {
    const content = (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={[styles.compactContainer, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityHint={onPress ? 'Tap to view connection details' : undefined}
        testID={testID}
      >
        {stateConfig.animate ? (
          <Animated.View>
            <Icon
              name={stateConfig.icon}
              size={20}
              color={stateConfig.color}
            />
          </Animated.View>
        ) : (
          <Icon
            name={stateConfig.icon}
            size={20}
            color={stateConfig.color}
          />
        )}
        {stateConfig.animate && (
          <View style={styles.compactPulse}>
            <PulseIndicator color={stateConfig.color} size={6} />
          </View>
        )}
      </Pressable>
    );

    if (showTooltip) {
      return (
        <Tooltip title={stateConfig.label}>
          {content}
        </Tooltip>
      );
    }

    return content;
  }

  // Render full mode (icon + label)
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.fullContainer, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint={onPress ? 'Tap to view connection details' : undefined}
      testID={testID}
    >
      <Surface style={[styles.fullSurface, { borderColor: stateConfig.color }]}>
        <View style={styles.fullContent}>
          {stateConfig.animate ? (
            <PulseIndicator color={stateConfig.color} size={8} />
          ) : (
            <View
              style={[
                styles.fullIndicator,
                { backgroundColor: stateConfig.color },
              ]}
            />
          )}
          <Icon
            name={stateConfig.icon}
            size={16}
            color={stateConfig.color}
            style={styles.fullIcon}
          />
          <Text style={[styles.fullLabel, { color: stateConfig.color }]}>
            {stateConfig.label}
          </Text>
        </View>
      </Surface>
    </Pressable>
  );
};

/**
 * ConnectionStatusBadge - A badge variant for use in headers
 * Shows a minimal indicator that can be placed in navigation headers
 */
export const ConnectionStatusBadge: React.FC<{
  onPress?: () => void;
  testID?: string;
}> = ({ onPress, testID }) => {
  return (
    <ConnectionStatus
      mode="indicator"
      onPress={onPress}
      showTooltip={false}
      testID={testID}
    />
  );
};

/**
 * ConnectionStatusIcon - Icon variant for toolbar/action areas
 */
export const ConnectionStatusIcon: React.FC<{
  onPress?: () => void;
  showTooltip?: boolean;
  testID?: string;
}> = ({ onPress, showTooltip = true, testID }) => {
  return (
    <ConnectionStatus
      mode="compact"
      onPress={onPress}
      showTooltip={showTooltip}
      testID={testID}
    />
  );
};

/**
 * ConnectionStatusBar - Full status bar for settings or debug screens
 */
export const ConnectionStatusBar: React.FC<{
  onPress?: () => void;
  style?: object;
  testID?: string;
}> = ({ onPress, style, testID }) => {
  return (
    <ConnectionStatus
      mode="full"
      onPress={onPress}
      style={style}
      testID={testID}
    />
  );
};

/**
 * Hook to get current connection state info
 * Useful for custom connection status displays
 */
export function useConnectionState(): {
  state: WebSocketState;
  config: StateConfig;
  isConnected: boolean;
  isConnecting: boolean;
  hasError: boolean;
} {
  const connectionStatus = useConnectionStatus();
  const state = getWebSocketState();

  return useMemo(() => {
    const config = STATE_CONFIG[state] || FALLBACK_CONFIG;
    return {
      state,
      config,
      isConnected: state === 'connected',
      isConnecting: state === 'connecting' || state === 'reconnecting',
      hasError: state === 'error',
    };
  }, [state]);
}

const styles = StyleSheet.create({
  // Indicator mode styles (small dot)
  indicatorContainer: {
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pulseIndicator: {
    // Animated styles applied inline
  },

  // Compact mode styles (icon only)
  compactContainer: {
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  compactPulse: {
    position: 'absolute',
    top: 2,
    right: 2,
  },

  // Full mode styles (icon + label)
  fullContainer: {
    alignSelf: 'flex-start',
  },
  fullSurface: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fullContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  fullIcon: {
    marginRight: spacing.xs,
  },
  fullLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ConnectionStatus;
