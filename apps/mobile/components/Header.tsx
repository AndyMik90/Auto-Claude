/**
 * Header Component
 * Displays a screen header with title, optional subtitle, and action buttons
 * Supports back navigation, project switcher, and custom actions
 */

import React, { useMemo, useCallback } from 'react';
import { StyleSheet, View, Pressable, Platform, StatusBar } from 'react-native';
import { Text, IconButton, Surface, Menu, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius, shadows } from '../theme';

/**
 * Header action button configuration
 */
interface HeaderAction {
  /** Icon name for the action button */
  icon: string;
  /** Called when the action is pressed */
  onPress: () => void;
  /** Accessibility label */
  accessibilityLabel: string;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Badge count to display on the icon */
  badge?: number;
}

/**
 * Project item for the project switcher
 */
interface ProjectItem {
  id: string;
  name: string;
  status?: 'active' | 'paused' | 'completed' | 'archived';
}

/**
 * Props for the Header component
 */
interface HeaderProps {
  /** Main title text */
  title: string;
  /** Optional subtitle text */
  subtitle?: string;
  /** Whether to show the back button */
  showBack?: boolean;
  /** Custom back navigation handler (defaults to router.back()) */
  onBack?: () => void;
  /** Right-side action buttons */
  actions?: HeaderAction[];
  /** Whether to show the project switcher */
  showProjectSwitcher?: boolean;
  /** Current project for the project switcher */
  currentProject?: ProjectItem;
  /** List of projects for the switcher menu */
  projects?: ProjectItem[];
  /** Called when a project is selected from the switcher */
  onProjectSelect?: (project: ProjectItem) => void;
  /** Whether to show a border at the bottom */
  showBorder?: boolean;
  /** Whether to use a transparent background */
  transparent?: boolean;
  /** Whether this is a large/expanded header */
  large?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Header Component
 * A customizable screen header component
 */
export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  actions = [],
  showProjectSwitcher = false,
  currentProject,
  projects = [],
  onProjectSelect,
  showBorder = false,
  transparent = false,
  large = false,
  testID,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = React.useState(false);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }, [onBack, router]);

  // Project switcher menu handlers
  const openMenu = useCallback(() => setMenuVisible(true), []);
  const closeMenu = useCallback(() => setMenuVisible(false), []);

  const handleProjectSelect = useCallback((project: ProjectItem) => {
    closeMenu();
    if (onProjectSelect) {
      onProjectSelect(project);
    }
  }, [closeMenu, onProjectSelect]);

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    let label = title;
    if (subtitle) {
      label += `. ${subtitle}`;
    }
    if (showProjectSwitcher && currentProject) {
      label += `. Current project: ${currentProject.name}`;
    }
    return label;
  }, [title, subtitle, showProjectSwitcher, currentProject]);

  // Calculate header padding
  const headerPaddingTop = Platform.select({
    ios: insets.top > 0 ? insets.top : spacing.md,
    android: (StatusBar.currentHeight || 0) + spacing.sm,
    default: spacing.md,
  });

  return (
    <Surface
      style={[
        styles.container,
        { paddingTop: headerPaddingTop },
        transparent && styles.containerTransparent,
        showBorder && styles.containerWithBorder,
        large && styles.containerLarge,
      ]}
      elevation={transparent ? 0 : 1}
      testID={testID}
    >
      <View
        style={styles.content}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="header"
      >
        {/* Left section */}
        <View style={styles.leftSection}>
          {/* Back button */}
          {showBack && (
            <IconButton
              icon="arrow-left"
              size={24}
              iconColor={colors.text.primary}
              onPress={handleBack}
              style={styles.backButton}
              accessibilityLabel="Go back"
              accessibilityHint="Navigates to the previous screen"
            />
          )}

          {/* Title section */}
          <View style={styles.titleContainer}>
            {/* Project switcher or title */}
            {showProjectSwitcher && currentProject ? (
              <Menu
                visible={menuVisible}
                onDismiss={closeMenu}
                anchor={
                  <Pressable
                    onPress={openMenu}
                    style={styles.projectSwitcher}
                    accessibilityLabel={`Current project: ${currentProject.name}. Tap to switch project.`}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[styles.title, large && styles.titleLarge]}
                      variant="titleLarge"
                      numberOfLines={1}
                    >
                      {currentProject.name}
                    </Text>
                    <Icon
                      name="chevron-down"
                      size={20}
                      color={colors.text.secondary}
                      style={styles.chevron}
                    />
                  </Pressable>
                }
                contentStyle={styles.menuContent}
              >
                <View style={styles.menuHeader}>
                  <Text style={styles.menuHeaderText}>Switch Project</Text>
                </View>
                <Divider style={styles.menuDivider} />
                {projects.map((project) => (
                  <Menu.Item
                    key={project.id}
                    onPress={() => handleProjectSelect(project)}
                    title={project.name}
                    leadingIcon={project.id === currentProject.id ? 'check' : 'folder-outline'}
                    titleStyle={[
                      styles.menuItemTitle,
                      project.id === currentProject.id && styles.menuItemTitleActive,
                    ]}
                  />
                ))}
              </Menu>
            ) : (
              <Text
                style={[styles.title, large && styles.titleLarge]}
                variant="titleLarge"
                numberOfLines={1}
              >
                {title}
              </Text>
            )}

            {/* Subtitle */}
            {subtitle && (
              <Text
                style={styles.subtitle}
                variant="bodySmall"
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Right section - Action buttons */}
        {actions.length > 0 && (
          <View style={styles.rightSection}>
            {actions.map((action, index) => (
              <View key={index} style={styles.actionWrapper}>
                <IconButton
                  icon={action.icon}
                  size={24}
                  iconColor={action.disabled ? colors.text.disabled : colors.text.primary}
                  onPress={action.onPress}
                  disabled={action.disabled}
                  accessibilityLabel={action.accessibilityLabel}
                />
                {action.badge !== undefined && action.badge > 0 && (
                  <View
                    style={styles.badge}
                    accessibilityLabel={`${action.badge} notifications`}
                  >
                    <Text style={styles.badgeText}>
                      {action.badge > 99 ? '99+' : action.badge}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </Surface>
  );
};

/**
 * SimpleHeader - A minimal header with just a title
 */
export const SimpleHeader: React.FC<{
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  testID?: string;
}> = ({ title, showBack = false, onBack, testID }) => (
  <Header
    title={title}
    showBack={showBack}
    onBack={onBack}
    transparent
    testID={testID}
  />
);

/**
 * ModalHeader - Header optimized for modal screens
 */
export const ModalHeader: React.FC<{
  title: string;
  onClose?: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  testID?: string;
}> = ({ title, onClose, onSave, saveLabel = 'Save', saveDisabled = false, testID }) => {
  const router = useRouter();

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  }, [onClose, router]);

  return (
    <View
      style={styles.modalContainer}
      testID={testID}
      accessibilityRole="header"
      accessibilityLabel={`${title} modal`}
    >
      <View style={styles.modalContent}>
        <IconButton
          icon="close"
          size={24}
          iconColor={colors.text.primary}
          onPress={handleClose}
          accessibilityLabel="Close"
          accessibilityHint="Closes this modal"
        />
        <Text
          style={styles.modalTitle}
          variant="titleMedium"
          numberOfLines={1}
        >
          {title}
        </Text>
        {onSave && (
          <Pressable
            onPress={onSave}
            disabled={saveDisabled}
            style={styles.modalSaveButton}
            accessibilityLabel={saveLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: saveDisabled }}
            accessibilityHint="Tap to save changes"
          >
            <Text
              style={[
                styles.modalSaveText,
                saveDisabled && styles.modalSaveTextDisabled,
              ]}
            >
              {saveLabel}
            </Text>
          </Pressable>
        )}
      </View>
      <Divider style={styles.modalDivider} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    paddingBottom: spacing.sm,
    ...shadows.small,
  },
  containerTransparent: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  containerWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  containerLarge: {
    paddingBottom: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: 44,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: spacing.xs,
    marginLeft: -spacing.xs,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  titleLarge: {
    fontSize: 24,
  },
  subtitle: {
    color: colors.text.secondary,
    marginTop: 2,
  },
  projectSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.status.error,
    borderRadius: borderRadius.round,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.text.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  menuContent: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
  },
  menuHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuHeaderText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuDivider: {
    backgroundColor: colors.surface.divider,
  },
  menuItemTitle: {
    color: colors.text.primary,
  },
  menuItemTitleActive: {
    color: colors.accent.primary,
    fontWeight: '600',
  },
  // Modal header styles
  modalContainer: {
    backgroundColor: colors.background.secondary,
  },
  modalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  modalTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  modalSaveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalSaveText: {
    color: colors.accent.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveTextDisabled: {
    color: colors.text.disabled,
  },
  modalDivider: {
    backgroundColor: colors.surface.border,
  },
});

export default Header;
