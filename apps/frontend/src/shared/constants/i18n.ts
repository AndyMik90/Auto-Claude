/**
 * Internationalization constants
 * Available languages and display labels
 */

export type SupportedLanguage = 'en' | 'fr' | 'cn';

export const AVAILABLE_LANGUAGES = [
  { value: 'en' as const, label: 'English', nativeLabel: 'English' },
  { value: 'fr' as const, label: 'French', nativeLabel: 'Français' },
  { value: 'cn' as const, label: 'Chinese', nativeLabel: '中文' }
] as const;

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
