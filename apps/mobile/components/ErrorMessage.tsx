/**
 * ErrorMessage Component
 * Displays an error message with icon, title, description, and optional retry action
 * Supports different error types and severity levels
 */

import React, { useMemo, useCallback } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, Button, Surface, IconButton } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius } from '../theme';

/**
 * Error severity levels
 */
type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Props for the ErrorMessage component
 */
interface ErrorMessageProps {
  /** Main error title/message */
  title: string;
  /** Optional detailed error description */
  description?: string;
  /** Error severity level (affects colors and icon) */
  severity?: ErrorSeverity;
  /** Custom icon name (overrides default based on severity) */
  icon?: string;
  /** Optional retry button handler */
  onRetry?: () => void;
  /** Optional dismiss/close handler */
  onDismiss?: () => void;
  /** Custom retry button label */
  retryLabel?: string;
  /** Whether to show in a contained card/surface */
  contained?: boolean;
  /** Whether to render in compact/inline mode */
  compact?: boolean;
  /** Whether to show as a full-screen error state */
  fullScreen?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Get color based on severity
 */
const getSeverityColor = (severity: ErrorSeverity): string => {
  const colorMap: Record<ErrorSeverity, string> = {
    error: colors.status.error,
    warning: colors.status.warning,
    info: colors.status.info,
  };
  return colorMap[severity];
};

/**
 * Get icon based on severity
 */
const getSeverityIcon = (severity: ErrorSeverity): string => {
  const iconMap: Record<ErrorSeverity, string> = {
    error: 'alert-circle-outline',
    warning: 'alert-outline',
    info: 'information-outline',
  };
  return iconMap[severity];
};

/**
 * Get background color based on severity
 */
const getSeverityBackgroundColor = (severity: ErrorSeverity): string => {
  const colorMap: Record<ErrorSeverity, string> = {
    error: `${colors.status.error}15`,
    warning: `${colors.status.warning}15`,
    info: `${colors.status.info}15`,
  };
  return colorMap[severity];
};

/**
 * ErrorMessage Component
 * A reusable error display component
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title,
  description,
  severity = 'error',
  icon,
  onRetry,
  onDismiss,
  retryLabel = 'Retry',
  contained = false,
  compact = false,
  fullScreen = false,
  testID,
}) => {
  const severityColor = useMemo(() => getSeverityColor(severity), [severity]);
  const iconName = icon || getSeverityIcon(severity);
  const backgroundColor = useMemo(() => getSeverityBackgroundColor(severity), [severity]);

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    let label = `${severity === 'error' ? 'Error' : severity === 'warning' ? 'Warning' : 'Information'}: ${title}`;
    if (description) {
      label += `. ${description}`;
    }
    if (onRetry) {
      label += `. ${retryLabel} button available.`;
    }
    return label;
  }, [severity, title, description, onRetry, retryLabel]);

  const handleDismiss = useCallback(() => {
    if (onDismiss) {
      onDismiss();
    }
  }, [onDismiss]);

  // Compact/inline mode
  if (compact) {
    return (
      <Pressable
        style={[
          styles.compactContainer,
          { backgroundColor },
          { borderColor: `${severityColor}40` },
        ]}
        onPress={onDismiss}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="alert"
        testID={testID}
      >
        <Icon
          name={iconName}
          size={18}
          color={severityColor}
          style={styles.compactIcon}
        />
        <Text
          style={[styles.compactText, { color: severityColor }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {onDismiss && (
          <Icon
            name="close"
            size={16}
            color={colors.text.muted}
            style={styles.compactCloseIcon}
          />
        )}
      </Pressable>
    );
  }

  const content = (
    <View
      style={[
        styles.container,
        fullScreen && styles.containerFullScreen,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="alert"
      testID={testID}
    >
      {/* Dismiss button (top right) */}
      {onDismiss && !fullScreen && (
        <IconButton
          icon="close"
          size={20}
          iconColor={colors.text.muted}
          onPress={handleDismiss}
          style={styles.dismissButton}
          accessibilityLabel="Dismiss error"
          accessibilityHint="Tap to dismiss this message"
        />
      )}

      {/* Icon */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor },
        ]}
        accessibilityElementsHidden
      >
        <Icon name={iconName} size={fullScreen ? 48 : 32} color={severityColor} />
      </View>

      {/* Title */}
      <Text
        style={[
          styles.title,
          fullScreen && styles.titleFullScreen,
        ]}
        variant="titleMedium"
        numberOfLines={2}
      >
        {title}
      </Text>

      {/* Description */}
      {description && (
        <Text
          style={styles.description}
          variant="bodyMedium"
          numberOfLines={4}
        >
          {description}
        </Text>
      )}

      {/* Action buttons */}
      {(onRetry || (onDismiss && fullScreen)) && (
        <View style={styles.buttonContainer}>
          {onRetry && (
            <Button
              mode="contained"
              onPress={onRetry}
              style={styles.retryButton}
              buttonColor={severityColor}
              icon="refresh"
              accessibilityLabel={retryLabel}
              accessibilityHint="Tap to retry the action"
            >
              {retryLabel}
            </Button>
          )}
          {onDismiss && fullScreen && (
            <Button
              mode="text"
              onPress={handleDismiss}
              textColor={colors.text.secondary}
              style={styles.dismissButtonAlt}
              accessibilityLabel="Dismiss"
              accessibilityHint="Tap to dismiss this message"
            >
              Dismiss
            </Button>
          )}
        </View>
      )}
    </View>
  );

  // Full-screen mode
  if (fullScreen) {
    return (
      <View style={styles.fullScreenContainer}>
        {content}
      </View>
    );
  }

  // Contained mode with surface background
  if (contained) {
    return (
      <Surface
        style={[
          styles.surface,
          { borderColor: `${severityColor}30` },
        ]}
        elevation={0}
      >
        {content}
      </Surface>
    );
  }

  return content;
};

/**
 * InlineError - Minimal inline error display
 */
export const InlineError: React.FC<{
  message: string;
  onRetry?: () => void;
  testID?: string;
}> = ({ message, onRetry, testID }) => {
  return (
    <View
      style={styles.inlineContainer}
      accessibilityLabel={`Error: ${message}`}
      accessibilityRole="alert"
      testID={testID}
    >
      <Icon
        name="alert-circle-outline"
        size={14}
        color={colors.status.error}
        style={styles.inlineIcon}
      />
      <Text style={styles.inlineText} numberOfLines={1}>
        {message}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          accessibilityLabel="Retry"
          accessibilityRole="button"
        >
          <Icon name="refresh" size={16} color={colors.accent.primary} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    margin: spacing.md,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    position: 'relative',
  },
  containerFullScreen: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  titleFullScreen: {
    fontSize: 20,
  },
  description: {
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  buttonContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  retryButton: {
    borderRadius: borderRadius.md,
    minWidth: 120,
  },
  dismissButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  dismissButtonAlt: {
    marginTop: spacing.xs,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginVertical: spacing.xs,
  },
  compactIcon: {
    marginRight: spacing.sm,
  },
  compactText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  compactCloseIcon: {
    marginLeft: spacing.sm,
  },
  // Inline styles
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  inlineIcon: {
    marginRight: 2,
  },
  inlineText: {
    color: colors.status.error,
    fontSize: 12,
    flex: 1,
  },
});

export default ErrorMessage;
