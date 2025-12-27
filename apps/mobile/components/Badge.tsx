/**
 * Badge Component
 * Displays status, priority, and custom badges with consistent styling
 * Supports multiple variants and customization options
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle, TextStyle } from 'react-native';
import { Chip, Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius } from '../theme';
import type { TaskStatus, TaskPriority, TaskCategory } from '../types';

/**
 * Badge variant types
 */
type BadgeVariant = 'status' | 'priority' | 'category' | 'custom' | 'count';

/**
 * Badge size options
 */
type BadgeSize = 'small' | 'medium' | 'large';

/**
 * Props for the Badge component
 */
interface BadgeProps {
  /** Badge variant type */
  variant?: BadgeVariant;
  /** Label text to display */
  label: string;
  /** Color override (uses variant color by default) */
  color?: string;
  /** Background color override */
  backgroundColor?: string;
  /** Icon name (optional) */
  icon?: string;
  /** Badge size */
  size?: BadgeSize;
  /** Task status (for status variant) */
  status?: TaskStatus;
  /** Task priority (for priority variant) */
  priority?: TaskPriority;
  /** Task category (for category variant) */
  category?: TaskCategory;
  /** Whether to show as outlined instead of filled */
  outlined?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Get color for task status
 */
const getStatusColor = (status: TaskStatus): string => {
  return colors.taskStatus[status] || colors.taskStatus.backlog;
};

/**
 * Get label for task status
 */
const getStatusLabel = (status: TaskStatus): string => {
  const labels: Record<TaskStatus, string> = {
    backlog: 'Backlog',
    in_progress: 'In Progress',
    ai_review: 'AI Review',
    human_review: 'Human Review',
    done: 'Done',
  };
  return labels[status] || status;
};

/**
 * Get color for task priority
 */
const getPriorityColor = (priority: TaskPriority): string => {
  return colors.priority[priority] || colors.priority.medium;
};

/**
 * Get label for task priority
 */
const getPriorityLabel = (priority: TaskPriority): string => {
  const labels: Record<TaskPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };
  return labels[priority] || priority;
};

/**
 * Get icon for task priority
 */
const getPriorityIcon = (priority: TaskPriority): string | undefined => {
  if (priority === 'critical') return 'alert-circle';
  if (priority === 'high') return 'arrow-up';
  if (priority === 'low') return 'arrow-down';
  return undefined;
};

/**
 * Get icon for task category
 */
const getCategoryIcon = (category: TaskCategory): string => {
  const icons: Record<TaskCategory, string> = {
    feature: 'star-outline',
    bug: 'bug-outline',
    refactor: 'wrench-outline',
    documentation: 'file-document-outline',
    test: 'test-tube',
    chore: 'cog-outline',
    research: 'magnify',
  };
  return icons[category] || 'help-circle-outline';
};

/**
 * Get category label
 */
const getCategoryLabel = (category: TaskCategory): string => {
  const labels: Record<TaskCategory, string> = {
    feature: 'Feature',
    bug: 'Bug',
    refactor: 'Refactor',
    documentation: 'Docs',
    test: 'Test',
    chore: 'Chore',
    research: 'Research',
  };
  return labels[category] || category;
};

/**
 * Size configurations
 */
const sizeConfig: Record<BadgeSize, { height: number; fontSize: number; iconSize: number; paddingHorizontal: number }> = {
  small: { height: 20, fontSize: 10, iconSize: 12, paddingHorizontal: 6 },
  medium: { height: 24, fontSize: 11, iconSize: 14, paddingHorizontal: 8 },
  large: { height: 28, fontSize: 12, iconSize: 16, paddingHorizontal: 10 },
};

/**
 * Badge Component
 * A versatile badge component for displaying status, priority, and custom labels
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'custom',
  label,
  color,
  backgroundColor,
  icon,
  size = 'medium',
  status,
  priority,
  category,
  outlined = false,
  testID,
}) => {
  // Determine color and label based on variant
  const { badgeColor, badgeLabel, badgeIcon } = useMemo(() => {
    let c = color || colors.text.secondary;
    let l = label;
    let i = icon;

    switch (variant) {
      case 'status':
        if (status) {
          c = color || getStatusColor(status);
          l = label || getStatusLabel(status);
        }
        break;
      case 'priority':
        if (priority) {
          c = color || getPriorityColor(priority);
          l = label || getPriorityLabel(priority);
          i = icon || getPriorityIcon(priority);
        }
        break;
      case 'category':
        if (category) {
          c = color || colors.accent.primary;
          l = label || getCategoryLabel(category);
          i = icon || getCategoryIcon(category);
        }
        break;
      case 'count':
        c = color || colors.accent.primary;
        break;
      default:
        break;
    }

    return { badgeColor: c, badgeLabel: l, badgeIcon: i };
  }, [variant, status, priority, category, color, label, icon]);

  const sizeStyle = sizeConfig[size];
  const bgColor = backgroundColor || (outlined ? 'transparent' : `${badgeColor}20`);
  const borderColor = outlined ? `${badgeColor}60` : 'transparent';

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    let prefix = '';
    if (variant === 'status') prefix = 'Status: ';
    else if (variant === 'priority') prefix = 'Priority: ';
    else if (variant === 'category') prefix = 'Category: ';
    else if (variant === 'count') prefix = 'Count: ';
    return `${prefix}${badgeLabel}`;
  }, [variant, badgeLabel]);

  // Count badge - simple circular badge
  if (variant === 'count') {
    return (
      <View
        style={[
          styles.countBadge,
          {
            backgroundColor: bgColor,
            borderColor,
            borderWidth: outlined ? 1 : 0,
            minWidth: sizeStyle.height,
            height: sizeStyle.height,
          },
        ]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="text"
        testID={testID}
      >
        <Text
          style={[
            styles.countText,
            { fontSize: sizeStyle.fontSize, color: badgeColor },
          ]}
        >
          {badgeLabel}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: outlined ? 1 : 0,
          height: sizeStyle.height,
          paddingHorizontal: sizeStyle.paddingHorizontal,
        },
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      testID={testID}
    >
      {badgeIcon && (
        <Icon
          name={badgeIcon}
          size={sizeStyle.iconSize}
          color={badgeColor}
          style={styles.icon}
          accessibilityElementsHidden
        />
      )}
      <Text
        style={[
          styles.text,
          { fontSize: sizeStyle.fontSize, color: badgeColor },
        ]}
        numberOfLines={1}
      >
        {badgeLabel}
      </Text>
    </View>
  );
};

/**
 * StatusBadge - Convenience component for task status badges
 */
export const StatusBadge: React.FC<{
  status: TaskStatus;
  size?: BadgeSize;
  testID?: string;
}> = ({ status, size = 'medium', testID }) => (
  <Badge
    variant="status"
    status={status}
    label={getStatusLabel(status)}
    size={size}
    testID={testID}
  />
);

/**
 * PriorityBadge - Convenience component for task priority badges
 */
export const PriorityBadge: React.FC<{
  priority: TaskPriority;
  size?: BadgeSize;
  showIcon?: boolean;
  testID?: string;
}> = ({ priority, size = 'medium', showIcon = true, testID }) => (
  <Badge
    variant="priority"
    priority={priority}
    label={getPriorityLabel(priority)}
    icon={showIcon ? getPriorityIcon(priority) : undefined}
    size={size}
    testID={testID}
  />
);

/**
 * CategoryBadge - Convenience component for task category badges
 */
export const CategoryBadge: React.FC<{
  category: TaskCategory;
  size?: BadgeSize;
  showIcon?: boolean;
  testID?: string;
}> = ({ category, size = 'medium', showIcon = true, testID }) => (
  <Badge
    variant="category"
    category={category}
    label={getCategoryLabel(category)}
    icon={showIcon ? getCategoryIcon(category) : undefined}
    size={size}
    testID={testID}
  />
);

/**
 * CountBadge - Convenience component for count/number badges
 */
export const CountBadge: React.FC<{
  count: number;
  color?: string;
  size?: BadgeSize;
  testID?: string;
}> = ({ count, color = colors.accent.primary, size = 'small', testID }) => (
  <Badge
    variant="count"
    label={count.toString()}
    color={color}
    size={size}
    testID={testID}
  />
);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '500',
  },
  countBadge: {
    borderRadius: borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  countText: {
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default Badge;
