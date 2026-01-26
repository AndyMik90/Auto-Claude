/**
 * Ideation-related constants
 * Types, categories, and configuration for AI-generated project improvements
 */

import type { TFunction } from 'i18next';

// ============================================
// Ideation Types
// ============================================

// Ideation type labels and descriptions
// Note: high_value_features removed - strategic features belong to Roadmap
// low_hanging_fruit renamed to code_improvements to cover all code-revealed opportunities
export const getIdeationTypeLabels = (t: TFunction): Record<string, string> => ({
  code_improvements: t('ideation:types.code_improvements'),
  ui_ux_improvements: t('ideation:types.ui_ux_improvements'),
  documentation_gaps: t('ideation:types.documentation_gaps'),
  security_hardening: t('ideation:types.security_hardening'),
  performance_optimizations: t('ideation:types.performance_optimizations'),
  code_quality: t('ideation:types.code_quality')
});

export const getIdeationTypeDescriptions = (t: TFunction): Record<string, string> => ({
  code_improvements: t('ideation:typeDescriptions.code_improvements'),
  ui_ux_improvements: t('ideation:typeDescriptions.ui_ux_improvements'),
  documentation_gaps: t('ideation:typeDescriptions.documentation_gaps'),
  security_hardening: t('ideation:typeDescriptions.security_hardening'),
  performance_optimizations: t('ideation:typeDescriptions.performance_optimizations'),
  code_quality: t('ideation:typeDescriptions.code_quality')
});

// Backward compatibility: export as functions that require t
export const IDEATION_TYPE_LABELS = getIdeationTypeLabels;
export const IDEATION_TYPE_DESCRIPTIONS = getIdeationTypeDescriptions;

// Ideation type colors
export const IDEATION_TYPE_COLORS: Record<string, string> = {
  code_improvements: 'bg-success/10 text-success border-success/30',
  ui_ux_improvements: 'bg-info/10 text-info border-info/30',
  documentation_gaps: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  security_hardening: 'bg-destructive/10 text-destructive border-destructive/30',
  performance_optimizations: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  code_quality: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
};

// Ideation type icons (Lucide icon names)
export const IDEATION_TYPE_ICONS: Record<string, string> = {
  code_improvements: 'Zap',
  ui_ux_improvements: 'Palette',
  documentation_gaps: 'BookOpen',
  security_hardening: 'Shield',
  performance_optimizations: 'Gauge',
  code_quality: 'Code2'
};

// ============================================
// Ideation Status
// ============================================

export const IDEATION_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  selected: 'bg-primary/10 text-primary',
  converted: 'bg-success/10 text-success',
  dismissed: 'bg-destructive/10 text-destructive line-through',
  archived: 'bg-violet-500/10 text-violet-400'
};

// ============================================
// Ideation Effort/Complexity
// ============================================

// Ideation effort colors (full spectrum for code_improvements)
export const IDEATION_EFFORT_COLORS: Record<string, string> = {
  trivial: 'bg-success/10 text-success',
  small: 'bg-info/10 text-info',
  medium: 'bg-warning/10 text-warning',
  large: 'bg-orange-500/10 text-orange-400',
  complex: 'bg-destructive/10 text-destructive'
};

// ============================================
// Ideation Impact
// ============================================

export const IDEATION_IMPACT_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive'
};

// ============================================
// Category-Specific Labels
// ============================================

// Security severity colors
export const SECURITY_SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-info/10 text-info',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-orange-500/10 text-orange-500',
  critical: 'bg-destructive/10 text-destructive'
};

// UI/UX category labels
export const getUIUXCategoryLabels = (t: TFunction): Record<string, string> => ({
  usability: t('ideation:categories.uiux.usability'),
  accessibility: t('ideation:categories.uiux.accessibility'),
  performance: t('ideation:categories.uiux.performance'),
  visual: t('ideation:categories.uiux.visual'),
  interaction: t('ideation:categories.uiux.interaction')
});

// Documentation category labels
export const getDocumentationCategoryLabels = (t: TFunction): Record<string, string> => ({
  readme: t('ideation:categories.documentation.readme'),
  api_docs: t('ideation:categories.documentation.api_docs'),
  inline_comments: t('ideation:categories.documentation.inline_comments'),
  examples: t('ideation:categories.documentation.examples'),
  architecture: t('ideation:categories.documentation.architecture'),
  troubleshooting: t('ideation:categories.documentation.troubleshooting')
});

// Security category labels
export const getSecurityCategoryLabels = (t: TFunction): Record<string, string> => ({
  authentication: t('ideation:categories.security.authentication'),
  authorization: t('ideation:categories.security.authorization'),
  input_validation: t('ideation:categories.security.input_validation'),
  data_protection: t('ideation:categories.security.data_protection'),
  dependencies: t('ideation:categories.security.dependencies'),
  configuration: t('ideation:categories.security.configuration'),
  secrets_management: t('ideation:categories.security.secrets_management')
});

// Performance category labels
export const getPerformanceCategoryLabels = (t: TFunction): Record<string, string> => ({
  bundle_size: t('ideation:categories.performance.bundle_size'),
  runtime: t('ideation:categories.performance.runtime'),
  memory: t('ideation:categories.performance.memory'),
  database: t('ideation:categories.performance.database'),
  network: t('ideation:categories.performance.network'),
  rendering: t('ideation:categories.performance.rendering'),
  caching: t('ideation:categories.performance.caching')
});

// Code quality category labels
export const getCodeQualityCategoryLabels = (t: TFunction): Record<string, string> => ({
  large_files: t('ideation:categories.codeQuality.large_files'),
  code_smells: t('ideation:categories.codeQuality.code_smells'),
  complexity: t('ideation:categories.codeQuality.complexity'),
  duplication: t('ideation:categories.codeQuality.duplication'),
  naming: t('ideation:categories.codeQuality.naming'),
  structure: t('ideation:categories.codeQuality.structure'),
  linting: t('ideation:categories.codeQuality.linting'),
  testing: t('ideation:categories.codeQuality.testing'),
  types: t('ideation:categories.codeQuality.types'),
  dependencies: t('ideation:categories.codeQuality.dependencies'),
  dead_code: t('ideation:categories.codeQuality.dead_code'),
  git_hygiene: t('ideation:categories.codeQuality.git_hygiene')
});

// Backward compatibility: export as functions that require t
export const UIUX_CATEGORY_LABELS = getUIUXCategoryLabels;
export const DOCUMENTATION_CATEGORY_LABELS = getDocumentationCategoryLabels;
export const SECURITY_CATEGORY_LABELS = getSecurityCategoryLabels;
export const PERFORMANCE_CATEGORY_LABELS = getPerformanceCategoryLabels;
export const CODE_QUALITY_CATEGORY_LABELS = getCodeQualityCategoryLabels;

// Code quality severity colors
export const CODE_QUALITY_SEVERITY_COLORS: Record<string, string> = {
  suggestion: 'bg-info/10 text-info',
  minor: 'bg-warning/10 text-warning',
  major: 'bg-orange-500/10 text-orange-500',
  critical: 'bg-destructive/10 text-destructive'
};

// ============================================
// Default Configuration
// ============================================

// Default ideation config
// Note: high_value_features removed, low_hanging_fruit renamed to code_improvements
export const DEFAULT_IDEATION_CONFIG = {
  enabledTypes: ['code_improvements', 'ui_ux_improvements', 'security_hardening'] as const,
  includeRoadmapContext: true,
  includeKanbanContext: true,
  maxIdeasPerType: 5
};
