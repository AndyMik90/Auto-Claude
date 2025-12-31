/**
 * Model and agent profile constants
 * Claude models, thinking levels, memory backends, and agent profiles
 * EXTENDED: Added multi-provider support for GLM models
 */

import type { AgentProfile, PhaseModelConfig, FeatureModelConfig, FeatureThinkingConfig, ModelProvider, ModelProviderConfig, ModelTier } from '../types/settings';

// ============================================
// Model Providers (NEW)
// ============================================

/**
 * Available model providers
 */
export const MODEL_PROVIDERS = [
  {
    value: 'anthropic' as const,
    label: 'Anthropic (Claude)',
    description: 'Official Claude models from Anthropic',
    icon: 'Cpu',
    baseUrl: 'https://api.anthropic.com'
  },
  {
    value: 'openrouter' as const,
    label: 'OpenRouter',
    description: 'Multi-provider aggregator with free GLM tier',
    icon: 'Zap',
    baseUrl: 'https://openrouter.ai/api/v1'
  },
  {
    value: 'zai' as const,
    label: 'Z.AI',
    description: 'Direct GLM API access',
    icon: 'Sparkles',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/'
  }
] as const;

/**
 * Default provider configurations
 */
export const DEFAULT_PROVIDER_CONFIGS: Record<ModelProvider, ModelProviderConfig> = {
  anthropic: {
    provider: 'anthropic',
    supportsExtendedThinking: true,
    maxThinkingTokens: 200000
  },
  openrouter: {
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    supportsExtendedThinking: false,
    modelMapping: {
      opus: 'anthropic/claude-opus-4-5-20251101',
      sonnet: 'anthropic/claude-sonnet-4-5-20250929',
      haiku: 'anthropic/claude-haiku-4-5-20251001'
      // GLM models available but not in default mapping
    }
  },
  zai: {
    provider: 'zai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
    supportsExtendedThinking: false,
    modelMapping: {
      opus: 'glm-4.7',
      sonnet: 'glm-4.7',
      haiku: 'glm-4.5-air'
    }
  }
};

/**
 * Available models by provider
 */
export const PROVIDER_MODELS: Record<ModelProvider, Array<{value: string; label: string; tier?: ModelTier}>> = {
  anthropic: [
    { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5', tier: 'opus' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', tier: 'sonnet' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', tier: 'haiku' }
  ],
  openrouter: [
    // Claude models via OpenRouter
    { value: 'anthropic/claude-opus-4-5-20251101', label: 'Claude Opus 4.5', tier: 'opus' },
    { value: 'anthropic/claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', tier: 'sonnet' },
    { value: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', tier: 'haiku' },
    // GLM models via OpenRouter
    { value: 'glm/glm-4-plus', label: 'GLM-4 Plus', tier: 'opus' },
    { value: 'glm/glm-4-0520', label: 'GLM-4 (0520)', tier: 'sonnet' },
    { value: 'glm/glm-4-air', label: 'GLM-4 Air', tier: 'haiku' },
    { value: 'glm/glm-4-flash', label: 'GLM-4 Flash', tier: 'haiku' },
    // Other OpenRouter models
    { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
    { value: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5' }
  ],
  zai: [
    { value: 'glm-4.7', label: 'GLM-4.7', tier: 'opus' },
    { value: 'glm-4-plus', label: 'GLM-4 Plus', tier: 'opus' },
    { value: 'glm-4-0520', label: 'GLM-4 (0520)', tier: 'sonnet' },
    { value: 'glm-4-air', label: 'GLM-4 Air', tier: 'haiku' },
    { value: 'glm-4-flash', label: 'GLM-4 Flash', tier: 'haiku' }
  ]
};

/**
 * Resolve model ID with provider support
 * Handles both shorthand (opus, sonnet, haiku) and provider-qualified IDs
 */
export function resolveModelId(model: string, provider: ModelProvider = 'anthropic'): string {
  // Check if it's a provider-qualified ID (e.g., "openrouter/glm-4-plus")
  if (model.includes('/')) {
    return model; // Already fully qualified
  }

  // Check if it's a shorthand
  if (model in MODEL_ID_MAP) {
    const tier = model as ModelTier;
    const providerConfig = DEFAULT_PROVIDER_CONFIGS[provider];

    // Use provider's model mapping if available
    if (providerConfig.modelMapping?.[tier]) {
      return providerConfig.modelMapping[tier]!;
    }

    // Fall back to default Anthropic IDs
    return MODEL_ID_MAP[model];
  }

  // Already a full model ID
  return model;
}

// ============================================
// Available Models (LEGACY - Backward Compatible)
// ============================================

export const AVAILABLE_MODELS = [
  { value: 'opus', label: 'Claude Opus 4.5' },
  { value: 'sonnet', label: 'Claude Sonnet 4.5' },
  { value: 'haiku', label: 'Claude Haiku 4.5' }
] as const;

// Maps model shorthand to actual Claude model IDs
export const MODEL_ID_MAP: Record<string, string> = {
  opus: 'claude-opus-4-5-20251101',
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001'
} as const;

// Maps thinking levels to budget tokens (null = no extended thinking)
export const THINKING_BUDGET_MAP: Record<string, number | null> = {
  none: null,
  low: 1024,
  medium: 4096,
  high: 16384,
  ultrathink: 65536
} as const;

// ============================================
// Thinking Levels
// ============================================

// Thinking levels for Claude model (budget token allocation)
export const THINKING_LEVELS = [
  { value: 'none', label: 'None', description: 'No extended thinking' },
  { value: 'low', label: 'Low', description: 'Brief consideration' },
  { value: 'medium', label: 'Medium', description: 'Moderate analysis' },
  { value: 'high', label: 'High', description: 'Deep thinking' },
  { value: 'ultrathink', label: 'Ultra Think', description: 'Maximum reasoning depth' }
] as const;

// ============================================
// Agent Profiles
// ============================================

// Default phase model configuration for Auto profile
// Uses Opus across all phases for maximum quality
export const DEFAULT_PHASE_MODELS: PhaseModelConfig = {
  spec: 'opus',       // Best quality for spec creation
  planning: 'opus',   // Complex architecture decisions benefit from Opus
  coding: 'opus',     // Highest quality implementation
  qa: 'opus'          // Thorough QA review
};

// Default phase thinking configuration for Auto profile
export const DEFAULT_PHASE_THINKING: import('../types/settings').PhaseThinkingConfig = {
  spec: 'ultrathink',   // Deep thinking for comprehensive spec creation
  planning: 'ultrathink',     // High thinking for planning complex features
  coding: 'ultrathink',        // Faster coding iterations
  qa: 'ultrathink'             // Efficient QA review
};

// ============================================
// Feature Settings (Non-Pipeline Features)
// ============================================

// Default feature model configuration (for insights, ideation, roadmap, github)
export const DEFAULT_FEATURE_MODELS: FeatureModelConfig = {
  insights: 'sonnet',     // Fast, responsive chat
  ideation: 'opus',       // Creative ideation benefits from Opus
  roadmap: 'opus',        // Strategic planning benefits from Opus
  githubIssues: 'opus',   // Issue triage and analysis benefits from Opus
  githubPrs: 'opus'       // PR review benefits from thorough Opus analysis
};

// Default feature thinking configuration
export const DEFAULT_FEATURE_THINKING: FeatureThinkingConfig = {
  insights: 'ultrathink',     // Balanced thinking for chat
  ideation: 'ultrathink',       // Deep thinking for creative ideas
  roadmap: 'ultrathink',        // Strategic thinking for roadmap
  githubIssues: 'ultrathink', // Moderate thinking for issue analysis
  githubPrs: 'ultrathink'     // Moderate thinking for PR review
};

// Feature labels for UI display
export const FEATURE_LABELS: Record<keyof FeatureModelConfig, { label: string; description: string }> = {
  insights: { label: 'Insights Chat', description: 'Ask questions about your codebase' },
  ideation: { label: 'Ideation', description: 'Generate feature ideas and improvements' },
  roadmap: { label: 'Roadmap', description: 'Create strategic feature roadmaps' },
  githubIssues: { label: 'GitHub Issues', description: 'Automated issue triage and labeling' },
  githubPrs: { label: 'GitHub PR Review', description: 'AI-powered pull request reviews' }
};

// Default agent profiles for preset model/thinking configurations
export const DEFAULT_AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'auto',
    name: 'Auto (Optimized)',
    description: 'Uses Opus across all phases with optimized thinking levels',
    model: 'opus',  // Fallback/default model
    thinkingLevel: 'ultrathink',
    icon: 'Sparkles',
    isAutoProfile: true,
    phaseModels: DEFAULT_PHASE_MODELS,
    phaseThinking: DEFAULT_PHASE_THINKING
  },
  {
    id: 'complex',
    name: 'Complex Tasks',
    description: 'For intricate, multi-step implementations requiring deep analysis',
    model: 'opus',
    thinkingLevel: 'ultrathink',
    icon: 'Brain'
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Good balance of speed and quality for most tasks',
    model: 'sonnet',
    thinkingLevel: 'medium',
    icon: 'Scale'
  },
  {
    id: 'quick',
    name: 'Quick Edits',
    description: 'Fast iterations for simple changes and quick fixes',
    model: 'haiku',
    thinkingLevel: 'low',
    icon: 'Zap'
  }
];

// ============================================
// Memory Backends
// ============================================

export const MEMORY_BACKENDS = [
  { value: 'file', label: 'File-based (default)' },
  { value: 'graphiti', label: 'Graphiti (LadybugDB)' }
] as const;
