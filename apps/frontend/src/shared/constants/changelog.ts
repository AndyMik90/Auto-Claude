/**
 * Changelog-related constants
 * Format options, audience types, and generation configuration
 */

// ============================================
// Changelog Formats
// ============================================

// Changelog format labels (i18n keys - use with t('changelog:formats.{key}'))
export const CHANGELOG_FORMAT_LABELS: Record<string, string> = {
  'keep-a-changelog': 'changelog:formats.keep-a-changelog',
  'simple-list': 'changelog:formats.simple-list',
  'github-release': 'changelog:formats.github-release'
};

// Changelog format descriptions (i18n keys - use with t('changelog:formatDescriptions.{key}'))
export const CHANGELOG_FORMAT_DESCRIPTIONS: Record<string, string> = {
  'keep-a-changelog': 'changelog:formatDescriptions.keep-a-changelog',
  'simple-list': 'changelog:formatDescriptions.simple-list',
  'github-release': 'changelog:formatDescriptions.github-release'
};

// ============================================
// Changelog Audience
// ============================================

// Changelog audience labels (i18n keys - use with t('changelog:audiences.{key}'))
export const CHANGELOG_AUDIENCE_LABELS: Record<string, string> = {
  'technical': 'changelog:audiences.technical',
  'user-facing': 'changelog:audiences.user-facing',
  'marketing': 'changelog:audiences.marketing'
};

// Changelog audience descriptions (i18n keys - use with t('changelog:audienceDescriptions.{key}'))
export const CHANGELOG_AUDIENCE_DESCRIPTIONS: Record<string, string> = {
  'technical': 'changelog:audienceDescriptions.technical',
  'user-facing': 'changelog:audienceDescriptions.user-facing',
  'marketing': 'changelog:audienceDescriptions.marketing'
};

// ============================================
// Changelog Emoji Level
// ============================================

// Changelog emoji level labels (i18n keys - use with t('changelog:emojiLevels.{key}'))
export const CHANGELOG_EMOJI_LEVEL_LABELS: Record<string, string> = {
  'none': 'changelog:emojiLevels.none',
  'little': 'changelog:emojiLevels.little',
  'medium': 'changelog:emojiLevels.medium',
  'high': 'changelog:emojiLevels.high'
};

// Changelog emoji level descriptions (i18n keys - use with t('changelog:emojiLevelDescriptions.{key}'))
export const CHANGELOG_EMOJI_LEVEL_DESCRIPTIONS: Record<string, string> = {
  'none': 'changelog:emojiLevelDescriptions.none',
  'little': 'changelog:emojiLevelDescriptions.little',
  'medium': 'changelog:emojiLevelDescriptions.medium',
  'high': 'changelog:emojiLevelDescriptions.high'
};

// ============================================
// Changelog Source Mode
// ============================================

// Changelog source mode labels (i18n keys - use with t('changelog:sourceModes.{key}'))
export const CHANGELOG_SOURCE_MODE_LABELS: Record<string, string> = {
  'tasks': 'changelog:sourceModes.tasks',
  'git-history': 'changelog:sourceModes.git-history',
  'branch-diff': 'changelog:sourceModes.branch-diff'
};

// Changelog source mode descriptions (i18n keys - use with t('changelog:sourceModeDescriptions.{key}'))
export const CHANGELOG_SOURCE_MODE_DESCRIPTIONS: Record<string, string> = {
  'tasks': 'changelog:sourceModeDescriptions.tasks',
  'git-history': 'changelog:sourceModeDescriptions.git-history',
  'branch-diff': 'changelog:sourceModeDescriptions.branch-diff'
};

// ============================================
// Git History Types
// ============================================

// Git history type labels (i18n keys - use with t('changelog:gitHistoryTypes.{key}'))
export const GIT_HISTORY_TYPE_LABELS: Record<string, string> = {
  'recent': 'changelog:gitHistoryTypes.recent',
  'since-date': 'changelog:gitHistoryTypes.since-date',
  'tag-range': 'changelog:gitHistoryTypes.tag-range'
};

// Git history type descriptions (i18n keys - use with t('changelog:gitHistoryTypeDescriptions.{key}'))
export const GIT_HISTORY_TYPE_DESCRIPTIONS: Record<string, string> = {
  'recent': 'changelog:gitHistoryTypeDescriptions.recent',
  'since-date': 'changelog:gitHistoryTypeDescriptions.since-date',
  'tag-range': 'changelog:gitHistoryTypeDescriptions.tag-range'
};

// ============================================
// Changelog Generation Stages
// ============================================

// Changelog generation stage labels (i18n keys - use with t('changelog:stages.{key}'))
export const CHANGELOG_STAGE_LABELS: Record<string, string> = {
  'loading_specs': 'changelog:stages.loading_specs',
  'loading_commits': 'changelog:stages.loading_commits',
  'generating': 'changelog:stages.generating',
  'formatting': 'changelog:stages.formatting',
  'complete': 'changelog:stages.complete',
  'error': 'changelog:stages.error'
};

// ============================================
// Default Configuration
// ============================================

// Default changelog file path
export const DEFAULT_CHANGELOG_PATH = 'CHANGELOG.md';
