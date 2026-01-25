/**
 * Internationalization constants
 * Available languages and display labels
 */

export type SupportedLanguage = 'en' | 'fr' | 'pt-br';

export const AVAILABLE_LANGUAGES = [
  { value: 'en' as const, label: 'English', nativeLabel: 'English' },
  { value: 'fr' as const, label: 'French', nativeLabel: 'Français' },
  { value: 'pt-br' as const, label: 'Portuguese (Brazil)', nativeLabel: 'Português (Brasil)' }
] as const;

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
