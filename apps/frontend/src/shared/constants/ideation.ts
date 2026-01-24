/**
 * Ideation-related constants
 * Types, categories, and configuration for AI-generated project improvements
 */

// ============================================
// Ideation Types
// ============================================

// Ideation type labels (i18n keys - use with t('ideation:types.{key}'))
// Note: high_value_features removed - strategic features belong to Roadmap
// low_hanging_fruit renamed to code_improvements to cover all code-revealed opportunities
export const IDEATION_TYPE_LABELS: Record<string, string> = {
  code_improvements: 'ideation:types.code_improvements',
  ui_ux_improvements: 'ideation:types.ui_ux_improvements',
  documentation_gaps: 'ideation:types.documentation_gaps',
  security_hardening: 'ideation:types.security_hardening',
  performance_optimizations: 'ideation:types.performance_optimizations',
  code_quality: 'ideation:types.code_quality'
};

// Ideation type descriptions (i18n keys - use with t('ideation:typeDescriptions.{key}'))
export const IDEATION_TYPE_DESCRIPTIONS: Record<string, string> = {
  code_improvements: 'ideation:typeDescriptions.code_improvements',
  ui_ux_improvements: 'ideation:typeDescriptions.ui_ux_improvements',
  documentation_gaps: 'ideation:typeDescriptions.documentation_gaps',
  security_hardening: 'ideation:typeDescriptions.security_hardening',
  performance_optimizations: 'ideation:typeDescriptions.performance_optimizations',
  code_quality: 'ideation:typeDescriptions.code_quality'
};

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

// UI/UX category labels (i18n keys - use with t('ideation:uiuxCategories.{key}'))
export const UIUX_CATEGORY_LABELS: Record<string, string> = {
  usability: 'ideation:uiuxCategories.usability',
  accessibility: 'ideation:uiuxCategories.accessibility',
  performance: 'ideation:uiuxCategories.performance',
  visual: 'ideation:uiuxCategories.visual',
  interaction: 'ideation:uiuxCategories.interaction'
};

// Documentation category labels (i18n keys - use with t('ideation:documentationCategories.{key}'))
export const DOCUMENTATION_CATEGORY_LABELS: Record<string, string> = {
  readme: 'ideation:documentationCategories.readme',
  api_docs: 'ideation:documentationCategories.api_docs',
  inline_comments: 'ideation:documentationCategories.inline_comments',
  examples: 'ideation:documentationCategories.examples',
  architecture: 'ideation:documentationCategories.architecture',
  troubleshooting: 'ideation:documentationCategories.troubleshooting'
};

// Security category labels (i18n keys - use with t('ideation:securityCategories.{key}'))
export const SECURITY_CATEGORY_LABELS: Record<string, string> = {
  authentication: 'ideation:securityCategories.authentication',
  authorization: 'ideation:securityCategories.authorization',
  input_validation: 'ideation:securityCategories.input_validation',
  data_protection: 'ideation:securityCategories.data_protection',
  dependencies: 'ideation:securityCategories.dependencies',
  configuration: 'ideation:securityCategories.configuration',
  secrets_management: 'ideation:securityCategories.secrets_management'
};

// Performance category labels (i18n keys - use with t('ideation:performanceCategories.{key}'))
export const PERFORMANCE_CATEGORY_LABELS: Record<string, string> = {
  bundle_size: 'ideation:performanceCategories.bundle_size',
  runtime: 'ideation:performanceCategories.runtime',
  memory: 'ideation:performanceCategories.memory',
  database: 'ideation:performanceCategories.database',
  network: 'ideation:performanceCategories.network',
  rendering: 'ideation:performanceCategories.rendering',
  caching: 'ideation:performanceCategories.caching'
};

// Code quality category labels (i18n keys - use with t('ideation:codeQualityCategories.{key}'))
export const CODE_QUALITY_CATEGORY_LABELS: Record<string, string> = {
  large_files: 'ideation:codeQualityCategories.large_files',
  code_smells: 'ideation:codeQualityCategories.code_smells',
  complexity: 'ideation:codeQualityCategories.complexity',
  duplication: 'ideation:codeQualityCategories.duplication',
  naming: 'ideation:codeQualityCategories.naming',
  structure: 'ideation:codeQualityCategories.structure',
  linting: 'ideation:codeQualityCategories.linting',
  testing: 'ideation:codeQualityCategories.testing',
  types: 'ideation:codeQualityCategories.types',
  dependencies: 'ideation:codeQualityCategories.dependencies',
  dead_code: 'ideation:codeQualityCategories.dead_code',
  git_hygiene: 'ideation:codeQualityCategories.git_hygiene'
};

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
