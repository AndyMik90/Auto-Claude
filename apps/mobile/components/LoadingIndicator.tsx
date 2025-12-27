/**
 * LoadingIndicator Component
 * Displays a loading spinner with optional message
 * Uses React Native Paper's ActivityIndicator with dark theme styling
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, Surface } from 'react-native-paper';
import { colors, spacing, borderRadius } from '../theme';

/**
 * Size options for the loading indicator
 */
type LoadingSize = 'small' | 'medium' | 'large';

/**
 * Props for the LoadingIndicator component
 */
interface LoadingIndicatorProps {
  /** Size of the loading spinner */
  size?: LoadingSize;
  /** Optional loading message to display */
  message?: string;
  /** Color of the spinner (defaults to accent primary) */
  color?: string;
  /** Whether to show in a contained card/surface */
  contained?: boolean;
  /** Whether to render as a full-screen overlay */
  fullScreen?: boolean;
  /** Whether to show a dimmed background (for fullScreen mode) */
  dimBackground?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Map size names to numeric values
 */
const sizeMap: Record<LoadingSize, number> = {
  small: 24,
  medium: 36,
  large: 48,
};

/**
 * LoadingIndicator Component
 * A reusable loading spinner component
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  size = 'medium',
  message,
  color = colors.accent.primary,
  contained = false,
  fullScreen = false,
  dimBackground = true,
  testID,
}) => {
  const spinnerSize = sizeMap[size];

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    return message ? `Loading: ${message}` : 'Loading';
  }, [message]);

  const content = (
    <View
      style={[
        styles.container,
        contained && styles.containerContained,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      testID={testID}
    >
      <ActivityIndicator
        animating
        size={spinnerSize}
        color={color}
        accessibilityElementsHidden
      />
      {message && (
        <Text
          style={[
            styles.message,
            size === 'small' && styles.messageSmall,
            size === 'large' && styles.messageLarge,
          ]}
          variant="bodyMedium"
          numberOfLines={2}
        >
          {message}
        </Text>
      )}
    </View>
  );

  // Full-screen overlay mode
  if (fullScreen) {
    return (
      <View
        style={[
          styles.fullScreenContainer,
          dimBackground && styles.fullScreenDimmed,
        ]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="progressbar"
        testID={testID}
      >
        {contained ? (
          <Surface style={styles.surface} elevation={2}>
            {content}
          </Surface>
        ) : (
          content
        )}
      </View>
    );
  }

  // Contained mode with surface background
  if (contained) {
    return (
      <Surface style={styles.surface} elevation={0}>
        {content}
      </Surface>
    );
  }

  return content;
};

/**
 * Inline loading indicator for use within components
 */
export const InlineLoadingIndicator: React.FC<{
  size?: LoadingSize;
  color?: string;
  testID?: string;
}> = ({ size = 'small', color = colors.accent.primary, testID }) => {
  const spinnerSize = sizeMap[size];

  return (
    <ActivityIndicator
      animating
      size={spinnerSize}
      color={color}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      testID={testID}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    minHeight: 100,
  },
  containerContained: {
    padding: spacing.xl,
  },
  surface: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    margin: spacing.md,
  },
  message: {
    color: colors.text.secondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  messageSmall: {
    fontSize: 12,
    marginTop: spacing.sm,
  },
  messageLarge: {
    fontSize: 16,
    marginTop: spacing.lg,
  },
  fullScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  fullScreenDimmed: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
});

export default LoadingIndicator;
