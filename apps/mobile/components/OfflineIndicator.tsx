/**
 * OfflineIndicator Component
 * Displays a banner when the device is offline
 * Uses NetInfo to detect network connectivity
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { Text, Surface, Portal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetInfo, NetInfoState } from '@react-native-community/netinfo';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius, shadows } from '../theme';

/**
 * Props for the OfflineIndicator component
 */
interface OfflineIndicatorProps {
  /** Display mode: 'banner' (top banner), 'badge' (inline badge), 'toast' (floating) */
  mode?: 'banner' | 'badge' | 'toast';
  /** Custom message to display when offline */
  message?: string;
  /** Whether to show the indicator even when online (for testing) */
  forceShow?: boolean;
  /** Called when the indicator is pressed */
  onPress?: () => void;
  /** Whether to animate the indicator */
  animated?: boolean;
  /** Whether to render inside a Portal (for toast mode) */
  usePortal?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Hook to get network state with useful derived properties
 */
export function useNetworkStatus(): {
  isOnline: boolean;
  isConnected: boolean | null;
  type: string | null;
  isInternetReachable: boolean | null;
  details: NetInfoState | null;
} {
  const netInfo = useNetInfo();

  return useMemo(
    () => ({
      isOnline: netInfo.isConnected === true && netInfo.isInternetReachable !== false,
      isConnected: netInfo.isConnected,
      type: netInfo.type,
      isInternetReachable: netInfo.isInternetReachable,
      details: netInfo,
    }),
    [netInfo]
  );
}

/**
 * OfflineIndicator Component
 * Shows a visual indicator when the device loses network connectivity
 */
export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  mode = 'banner',
  message,
  forceShow = false,
  onPress,
  animated = true,
  usePortal = false,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const { isOnline, type } = useNetworkStatus();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Determine if we should show the indicator
  const shouldShow = forceShow || !isOnline;

  // Get the appropriate message
  const displayMessage = useMemo(() => {
    if (message) return message;
    if (type === 'none') return 'No network connection';
    if (type === 'unknown') return 'Network status unknown';
    return 'You are offline';
  }, [message, type]);

  // Animate in/out
  useEffect(() => {
    if (animated) {
      if (shouldShow) {
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -100,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      slideAnim.setValue(shouldShow ? 0 : -100);
      opacityAnim.setValue(shouldShow ? 1 : 0);
    }
  }, [shouldShow, animated, slideAnim, opacityAnim]);

  // Don't render anything if online and not forced
  if (!shouldShow && !animated) {
    return null;
  }

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    let label = displayMessage;
    if (onPress) {
      label += '. Tap to retry connection.';
    }
    return label;
  }, [displayMessage, onPress]);

  // Render banner mode (top of screen)
  if (mode === 'banner') {
    const banner = (
      <Animated.View
        style={[
          styles.bannerContainer,
          {
            paddingTop: insets.top > 0 ? insets.top : spacing.sm,
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        testID={testID}
      >
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          style={styles.bannerContent}
        >
          <Icon name="wifi-off" size={18} color={colors.status.error} />
          <Text style={styles.bannerText}>{displayMessage}</Text>
          {onPress && (
            <Icon name="refresh" size={16} color={colors.text.secondary} />
          )}
        </Pressable>
      </Animated.View>
    );

    if (usePortal) {
      return <Portal>{banner}</Portal>;
    }
    return banner;
  }

  // Render badge mode (inline badge)
  if (mode === 'badge') {
    if (!shouldShow) return null;

    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={styles.badgeContainer}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="alert"
        testID={testID}
      >
        <Icon name="wifi-off" size={14} color={colors.status.error} />
        <Text style={styles.badgeText}>Offline</Text>
      </Pressable>
    );
  }

  // Render toast mode (floating toast)
  const toast = (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          bottom: insets.bottom + spacing.lg,
          opacity: opacityAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [-100, 0],
                outputRange: [50, 0],
              }),
            },
          ],
        },
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <Surface style={styles.toastSurface} elevation={3}>
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          style={styles.toastContent}
        >
          <View style={styles.toastIconContainer}>
            <Icon name="wifi-off" size={20} color={colors.status.error} />
          </View>
          <View style={styles.toastTextContainer}>
            <Text style={styles.toastTitle}>No Connection</Text>
            <Text style={styles.toastMessage}>{displayMessage}</Text>
          </View>
          {onPress && (
            <View style={styles.toastRetryButton}>
              <Icon name="refresh" size={20} color={colors.accent.primary} />
            </View>
          )}
        </Pressable>
      </Surface>
    </Animated.View>
  );

  if (usePortal) {
    return <Portal>{toast}</Portal>;
  }
  return toast;
};

/**
 * OfflineBanner - Convenience component for banner mode
 */
export const OfflineBanner: React.FC<
  Omit<OfflineIndicatorProps, 'mode'>
> = (props) => <OfflineIndicator {...props} mode="banner" usePortal />;

/**
 * OfflineBadge - Convenience component for badge mode
 */
export const OfflineBadge: React.FC<
  Omit<OfflineIndicatorProps, 'mode'>
> = (props) => <OfflineIndicator {...props} mode="badge" />;

/**
 * OfflineToast - Convenience component for toast mode
 */
export const OfflineToast: React.FC<
  Omit<OfflineIndicatorProps, 'mode'>
> = (props) => <OfflineIndicator {...props} mode="toast" usePortal />;

/**
 * Network Status Banner Component
 * A more comprehensive network status display with connection type
 */
export const NetworkStatusBanner: React.FC<{
  onRetry?: () => void;
  testID?: string;
}> = ({ onRetry, testID }) => {
  const { isOnline, type, isInternetReachable } = useNetworkStatus();

  if (isOnline) return null;

  // Determine the specific message based on network state
  const getMessage = (): string => {
    if (type === 'none') {
      return 'No network connection available';
    }
    if (type === 'cellular' && isInternetReachable === false) {
      return 'Connected to cellular but no internet';
    }
    if (type === 'wifi' && isInternetReachable === false) {
      return 'Connected to Wi-Fi but no internet';
    }
    return 'Unable to reach the internet';
  };

  const getIcon = (): string => {
    if (type === 'none') return 'wifi-off';
    if (type === 'cellular') return 'signal-cellular-outline';
    if (type === 'wifi') return 'wifi-strength-1';
    return 'wifi-off';
  };

  return (
    <Surface
      style={styles.networkBannerSurface}
      elevation={0}
      testID={testID}
    >
      <View
        style={styles.networkBannerContent}
        accessibilityLabel={getMessage()}
        accessibilityRole="alert"
      >
        <Icon name={getIcon()} size={20} color={colors.status.warning} />
        <View style={styles.networkBannerTextContainer}>
          <Text style={styles.networkBannerText}>{getMessage()}</Text>
          <Text style={styles.networkBannerSubtext}>
            Some features may be unavailable
          </Text>
        </View>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            style={styles.networkBannerRetry}
            accessibilityLabel="Retry connection"
            accessibilityRole="button"
          >
            <Text style={styles.networkBannerRetryText}>Retry</Text>
          </Pressable>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  // Banner styles
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.elevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.status.error + '40',
    zIndex: 1000,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  bannerText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },

  // Badge styles
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.status.error + '20',
    borderRadius: borderRadius.round,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.status.error + '40',
  },
  badgeText: {
    color: colors.status.error,
    fontSize: 12,
    fontWeight: '600',
  },

  // Toast styles
  toastContainer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
  },
  toastSurface: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    ...shadows.large,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  toastIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.status.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastTextContainer: {
    flex: 1,
  },
  toastTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  toastMessage: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  toastRetryButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Network status banner styles
  networkBannerSurface: {
    backgroundColor: colors.status.warning + '15',
    borderBottomWidth: 1,
    borderBottomColor: colors.status.warning + '40',
  },
  networkBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  networkBannerTextContainer: {
    flex: 1,
  },
  networkBannerText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  networkBannerSubtext: {
    color: colors.text.muted,
    fontSize: 11,
  },
  networkBannerRetry: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.status.warning + '30',
    borderRadius: borderRadius.md,
  },
  networkBannerRetryText: {
    color: colors.status.warning,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OfflineIndicator;
