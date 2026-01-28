/**
 * Internationalization constants
 * Available languages and display labels
 */

export type SupportedLanguage = 'en' | 'fr' | 'hu';

export const AVAILABLE_LANGUAGES = [
  { value: 'en' as const, label: 'English', nativeLabel: 'English' },
  { value: 'fr' as const, label: 'French', nativeLabel: 'Français' },
  { value: 'hu' as const, label: 'Hungarian', nativeLabel: 'Magyar' }
] as const;

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
