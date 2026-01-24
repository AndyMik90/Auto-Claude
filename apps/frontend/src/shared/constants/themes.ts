/**
 * Theme constants
 * Color themes for multi-theme support with light/dark mode variants
 */

import type { ColorThemeDefinition } from '../types/settings';

// ============================================
// Color Themes
// ============================================

/**
 * All available color themes with preview colors for the theme selector.
 * Each theme has both light and dark mode variants defined in CSS.
 *
 * Theme names and descriptions use i18n keys:
 * - name: t('settings:theme.themes.{id}')
 * - description: t('settings:theme.themeDescriptions.{id}')
 */
export const COLOR_THEMES: ColorThemeDefinition[] = [
  {
    id: 'default',
    name: 'settings:theme.themes.default',
    description: 'settings:theme.themeDescriptions.default',
    previewColors: { bg: '#F2F2ED', accent: '#E6E7A3', darkBg: '#0B0B0F', darkAccent: '#E6E7A3' }
  },
  {
    id: 'dusk',
    name: 'settings:theme.themes.dusk',
    description: 'settings:theme.themeDescriptions.dusk',
    previewColors: { bg: '#F5F5F0', accent: '#E6E7A3', darkBg: '#131419', darkAccent: '#E6E7A3' }
  },
  {
    id: 'lime',
    name: 'settings:theme.themes.lime',
    description: 'settings:theme.themeDescriptions.lime',
    previewColors: { bg: '#E8F5A3', accent: '#7C3AED', darkBg: '#0F0F1A' }
  },
  {
    id: 'ocean',
    name: 'settings:theme.themes.ocean',
    description: 'settings:theme.themeDescriptions.ocean',
    previewColors: { bg: '#E0F2FE', accent: '#0284C7', darkBg: '#082F49' }
  },
  {
    id: 'retro',
    name: 'settings:theme.themes.retro',
    description: 'settings:theme.themeDescriptions.retro',
    previewColors: { bg: '#FEF3C7', accent: '#D97706', darkBg: '#1C1917' }
  },
  {
    id: 'neo',
    name: 'settings:theme.themes.neo',
    description: 'settings:theme.themeDescriptions.neo',
    previewColors: { bg: '#FDF4FF', accent: '#D946EF', darkBg: '#0F0720' }
  },
  {
    id: 'forest',
    name: 'settings:theme.themes.forest',
    description: 'settings:theme.themeDescriptions.forest',
    previewColors: { bg: '#DCFCE7', accent: '#16A34A', darkBg: '#052E16' }
  }
];
