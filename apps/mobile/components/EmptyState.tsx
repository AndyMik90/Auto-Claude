/**
 * EmptyState Component
 * Displays a message and icon when a list or view is empty
 * Supports customizable icon, title, description, and optional action button
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius } from '../theme';

/**
 * Props for the EmptyState component
 */
interface EmptyStateProps {
  /** Icon name from MaterialCommunityIcons */
  icon?: string;
  /** Main title text */
  title: string;
  /** Optional description/subtitle text */
  description?: string;
  /** Optional action button label */
  actionLabel?: string;
  /** Called when the action button is pressed */
  onAction?: () => void;
  /** Icon color (defaults to muted text color) */
  iconColor?: string;
  /** Icon size (defaults to 64) */
  iconSize?: number;
  /** Whether to show a subtle background surface */
  showBackground?: boolean;
  /** Whether to render in compact mode (smaller spacing) */
  compact?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * EmptyState Component
 * A placeholder component for empty lists and views
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox-outline',
  title,
  description,
  actionLabel,
  onAction,
  iconColor = colors.text.muted,
  iconSize = 64,
  showBackground = false,
  compact = false,
  testID,
}) => {
  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    let label = title;
    if (description) {
      label += `. ${description}`;
    }
    if (actionLabel) {
      label += `. ${actionLabel} button available.`;
    }
    return label;
  }, [title, description, actionLabel]);

  const content = (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      testID={testID}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconContainer,
          compact && styles.iconContainerCompact,
        ]}
        accessibilityElementsHidden
      >
        <Icon name={icon} size={iconSize} color={iconColor} />
      </View>

      {/* Title */}
      <Text
        style={styles.title}
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
          numberOfLines={3}
        >
          {description}
        </Text>
      )}

      {/* Action button */}
      {actionLabel && onAction && (
        <Button
          mode="contained"
          onPress={onAction}
          style={styles.actionButton}
          contentStyle={styles.actionButtonContent}
          accessibilityLabel={actionLabel}
          accessibilityHint="Tap to perform action"
        >
          {actionLabel}
        </Button>
      )}
    </View>
  );

  // Optionally wrap in a Surface for background
  if (showBackground) {
    return (
      <Surface style={styles.surface} elevation={0}>
        {content}
      </Surface>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    margin: spacing.md,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    minHeight: 200,
  },
  containerCompact: {
    padding: spacing.lg,
    minHeight: 120,
  },
  iconContainer: {
    marginBottom: spacing.lg,
    opacity: 0.6,
  },
  iconContainerCompact: {
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  actionButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent.primary,
    borderRadius: borderRadius.md,
  },
  actionButtonContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});

export default EmptyState;
