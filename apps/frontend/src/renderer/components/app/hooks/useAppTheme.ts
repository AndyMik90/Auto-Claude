import { useEffect } from 'react';
import type { AppSettings } from '@shared/types';
import { COLOR_THEMES, UI_SCALE_MIN, UI_SCALE_DEFAULT, UI_SCALE_MAX, type ColorTheme } from '@shared/constants';

/**
 * Hook to apply theme settings to the document
 * Handles light/dark mode, color themes, and UI scale
 */
export function useAppTheme(settings: AppSettings) {
  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      // Apply light/dark mode
      if (settings.theme === 'dark') {
        root.classList.add('dark');
      } else if (settings.theme === 'light') {
        root.classList.remove('dark');
      } else {
        // System preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    // Apply color theme via data-theme attribute
    // Validate colorTheme against known themes, fallback to 'default' if invalid
    const validThemeIds = COLOR_THEMES.map((t) => t.id);
    const rawColorTheme = settings.colorTheme ?? 'default';
    const colorTheme: ColorTheme = validThemeIds.includes(rawColorTheme as ColorTheme)
      ? (rawColorTheme as ColorTheme)
      : 'default';

    if (colorTheme === 'default') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', colorTheme);
    }

    applyTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (settings.theme === 'system') {
        applyTheme();
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [settings.theme, settings.colorTheme]);

  // Apply UI scale
  useEffect(() => {
    const root = document.documentElement;
    const scale = settings.uiScale ?? UI_SCALE_DEFAULT;
    const clampedScale = Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, scale));
    root.setAttribute('data-ui-scale', clampedScale.toString());
  }, [settings.uiScale]);
}
