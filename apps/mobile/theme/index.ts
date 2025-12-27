/**
 * AutoClaude Mobile Theme Configuration
 * Dark theme matching the desktop application
 */

import { MD3DarkTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

/**
 * AutoClaude color palette
 * Derived from desktop app's default theme (Oscura-inspired with pale yellow accent)
 */
export const colors = {
  // Core background colors
  background: {
    primary: '#0B0B0F', // Main background (desktop darkBg)
    secondary: '#1a1a2e', // Card/elevated surfaces
    tertiary: '#16162a', // Subtle contrast elements
    elevated: '#222236', // Floating elements, modals
  },

  // Primary accent - pale yellow
  accent: {
    primary: '#E6E7A3', // Main accent color
    secondary: '#D4D58C', // Darker variant
    tertiary: '#F0F1B8', // Lighter variant
  },

  // Text colors
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B0B0',
    muted: '#707070',
    disabled: '#505050',
    inverse: '#0B0B0F',
  },

  // Status colors
  status: {
    success: '#22C55E',
    warning: '#EAB308',
    error: '#EF4444',
    info: '#3B82F6',
  },

  // Task status colors (matching desktop Kanban)
  taskStatus: {
    backlog: '#6B7280', // Gray
    in_progress: '#3B82F6', // Blue
    ai_review: '#8B5CF6', // Purple
    human_review: '#F59E0B', // Amber
    done: '#22C55E', // Green
  },

  // Priority colors
  priority: {
    low: '#6B7280', // Gray
    medium: '#3B82F6', // Blue
    high: '#F59E0B', // Amber
    critical: '#EF4444', // Red
  },

  // Surface colors
  surface: {
    primary: '#16162a',
    secondary: '#222236',
    border: '#2a2a44',
    divider: '#333355',
  },

  // Navigation
  navigation: {
    active: '#E6E7A3',
    inactive: '#707070',
    background: '#0B0B0F',
  },
} as const;

/**
 * Font configuration for React Native Paper
 */
const fontConfig = {
  fontFamily: 'System',
};

/**
 * AutoClaude Dark Theme for React Native Paper
 * Extends MD3DarkTheme with custom colors matching desktop app
 */
export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  dark: true,
  roundness: 8,
  colors: {
    ...MD3DarkTheme.colors,
    // Primary colors - pale yellow accent
    primary: colors.accent.primary,
    onPrimary: colors.text.inverse,
    primaryContainer: colors.accent.secondary,
    onPrimaryContainer: colors.text.inverse,

    // Secondary colors
    secondary: colors.accent.tertiary,
    onSecondary: colors.text.inverse,
    secondaryContainer: colors.background.tertiary,
    onSecondaryContainer: colors.text.primary,

    // Tertiary colors
    tertiary: colors.status.info,
    onTertiary: colors.text.primary,
    tertiaryContainer: colors.surface.primary,
    onTertiaryContainer: colors.text.primary,

    // Background and surface
    background: colors.background.primary,
    onBackground: colors.text.primary,
    surface: colors.background.secondary,
    onSurface: colors.text.primary,
    surfaceVariant: colors.surface.primary,
    onSurfaceVariant: colors.text.secondary,
    surfaceDisabled: colors.background.tertiary,
    onSurfaceDisabled: colors.text.disabled,

    // Error colors
    error: colors.status.error,
    onError: colors.text.primary,
    errorContainer: '#7F1D1D',
    onErrorContainer: '#FCA5A5',

    // Outline and borders
    outline: colors.surface.border,
    outlineVariant: colors.surface.divider,

    // Inverse colors
    inverseSurface: colors.text.primary,
    inverseOnSurface: colors.background.primary,
    inversePrimary: colors.accent.secondary,

    // Shadow and scrim
    shadow: '#000000',
    scrim: '#000000',

    // Backdrop
    backdrop: 'rgba(0, 0, 0, 0.5)',

    // Elevation (for Paper components)
    elevation: {
      level0: 'transparent',
      level1: colors.background.secondary,
      level2: colors.surface.primary,
      level3: colors.surface.secondary,
      level4: colors.background.elevated,
      level5: colors.background.elevated,
    },
  },
  fonts: configureFonts({ config: fontConfig }),
};

/**
 * Export default theme (currently only dark theme supported)
 */
export const theme = darkTheme;

/**
 * Common spacing values for consistent layouts
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Common border radius values
 */
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 9999,
} as const;

/**
 * Shadow styles for elevation
 */
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;
