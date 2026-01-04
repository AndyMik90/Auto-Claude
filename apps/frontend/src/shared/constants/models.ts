/**
 * Model and agent profile constants
 * Claude models, Ollama models, thinking levels, memory backends, and agent profiles
 */

import type { AgentProfile, PhaseModelConfig, FeatureModelConfig, FeatureThinkingConfig } from '../types/settings';

// ============================================
// Provider Types
// ============================================

export type AIProvider = 'claude' | 'ollama';

// ============================================
// Available Models - Claude (Cloud)
// ============================================

export const CLAUDE_MODELS = [
  { value: 'opus', label: 'Claude Opus 4.5', provider: 'claude' as AIProvider },
  { value: 'sonnet', label: 'Claude Sonnet 4.5', provider: 'claude' as AIProvider },
  { value: 'haiku', label: 'Claude Haiku 4.5', provider: 'claude' as AIProvider }
] as const;

// ============================================
// Available Models - Ollama (Local)
// ============================================

export const OLLAMA_MODELS = [
  // Llama 3.x Series
  { value: 'ollama:llama3.2:3b', label: 'Llama 3.2 3B (Fast)', provider: 'ollama' as AIProvider },
  { value: 'ollama:llama3.1:8b', label: 'Llama 3.1 8B (Balanced)', provider: 'ollama' as AIProvider },
  { value: 'ollama:llama3.1:70b', label: 'Llama 3.1 70B (Quality)', provider: 'ollama' as AIProvider },
  // Qwen Coder Series
  { value: 'ollama:qwen2.5-coder:7b', label: 'Qwen 2.5 Coder 7B', provider: 'ollama' as AIProvider },
  { value: 'ollama:qwen2.5-coder:14b', label: 'Qwen 2.5 Coder 14B', provider: 'ollama' as AIProvider },
  { value: 'ollama:qwen2.5-coder:32b', label: 'Qwen 2.5 Coder 32B', provider: 'ollama' as AIProvider },
  // DeepSeek Coder
  { value: 'ollama:deepseek-coder-v2:16b', label: 'DeepSeek Coder V2 16B', provider: 'ollama' as AIProvider },
  // CodeLlama
  { value: 'ollama:codellama:7b', label: 'CodeLlama 7B', provider: 'ollama' as AIProvider },
  { value: 'ollama:codellama:13b', label: 'CodeLlama 13B', provider: 'ollama' as AIProvider },
  { value: 'ollama:codellama:34b', label: 'CodeLlama 34B', provider: 'ollama' as AIProvider },
  // Mistral Series
  { value: 'ollama:mistral:7b', label: 'Mistral 7B', provider: 'ollama' as AIProvider },
  { value: 'ollama:mixtral:8x7b', label: 'Mixtral 8x7B', provider: 'ollama' as AIProvider },
  // Phi Series (Microsoft)
  { value: 'ollama:phi3:mini', label: 'Phi-3 Mini (3.8B)', provider: 'ollama' as AIProvider },
  { value: 'ollama:phi3:medium', label: 'Phi-3 Medium (14B)', provider: 'ollama' as AIProvider },
  // Gemma (Google)
  { value: 'ollama:gemma2:9b', label: 'Gemma 2 9B', provider: 'ollama' as AIProvider },
  { value: 'ollama:gemma2:27b', label: 'Gemma 2 27B', provider: 'ollama' as AIProvider },
  // StarCoder
  { value: 'ollama:starcoder2:7b', label: 'StarCoder2 7B', provider: 'ollama' as AIProvider },
  { value: 'ollama:starcoder2:15b', label: 'StarCoder2 15B', provider: 'ollama' as AIProvider },
] as const;

// Combined available models (for backward compatibility)
export const AVAILABLE_MODELS = [
  ...CLAUDE_MODELS,
  ...OLLAMA_MODELS
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
  planning: 'high',     // High thinking for planning complex features
  coding: 'low',        // Faster coding iterations
  qa: 'low'             // Efficient QA review
};

// ============================================
// Feature Settings (Non-Pipeline Features)
// ============================================

// Default feature model configuration (for insights, ideation, roadmap, github, utility)
export const DEFAULT_FEATURE_MODELS: FeatureModelConfig = {
  insights: 'sonnet',     // Fast, responsive chat
  ideation: 'opus',       // Creative ideation benefits from Opus
  roadmap: 'opus',        // Strategic planning benefits from Opus
  githubIssues: 'opus',   // Issue triage and analysis benefits from Opus
  githubPrs: 'opus',      // PR review benefits from thorough Opus analysis
  utility: 'haiku'        // Fast utility operations (commit messages, merge resolution)
};

// Default feature thinking configuration
export const DEFAULT_FEATURE_THINKING: FeatureThinkingConfig = {
  insights: 'medium',     // Balanced thinking for chat
  ideation: 'high',       // Deep thinking for creative ideas
  roadmap: 'high',        // Strategic thinking for roadmap
  githubIssues: 'medium', // Moderate thinking for issue analysis
  githubPrs: 'medium',    // Moderate thinking for PR review
  utility: 'low'          // Fast thinking for utility operations
};

// Feature labels for UI display
export const FEATURE_LABELS: Record<keyof FeatureModelConfig, { label: string; description: string }> = {
  insights: { label: 'Insights Chat', description: 'Ask questions about your codebase' },
  ideation: { label: 'Ideation', description: 'Generate feature ideas and improvements' },
  roadmap: { label: 'Roadmap', description: 'Create strategic feature roadmaps' },
  githubIssues: { label: 'GitHub Issues', description: 'Automated issue triage and labeling' },
  githubPrs: { label: 'GitHub PR Review', description: 'AI-powered pull request reviews' },
  utility: { label: 'Utility', description: 'Commit messages and merge conflict resolution' }
};

// Default agent profiles for preset model/thinking configurations
export const DEFAULT_AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'auto',
    name: 'Auto (Optimized)',
    description: 'Uses Opus across all phases with optimized thinking levels',
    model: 'opus',  // Fallback/default model
    thinkingLevel: 'high',
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

// Ollama-specific agent profiles for local-only execution
export const OLLAMA_AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'ollama-balanced',
    name: 'Ollama Balanced',
    description: 'Balanced local model for most tasks (Llama 3.1 8B)',
    model: 'ollama:llama3.1:8b' as any,
    thinkingLevel: 'medium',
    icon: 'Server'
  },
  {
    id: 'ollama-coder',
    name: 'Ollama Coder',
    description: 'Optimized for coding tasks (Qwen 2.5 Coder)',
    model: 'ollama:qwen2.5-coder:7b' as any,
    thinkingLevel: 'medium',
    icon: 'Code'
  },
  {
    id: 'ollama-fast',
    name: 'Ollama Fast',
    description: 'Fast local model for quick edits (Llama 3.2 3B)',
    model: 'ollama:llama3.2:3b' as any,
    thinkingLevel: 'low',
    icon: 'Zap'
  },
  {
    id: 'ollama-quality',
    name: 'Ollama Quality',
    description: 'High quality local model (requires 48GB+ VRAM)',
    model: 'ollama:llama3.1:70b' as any,
    thinkingLevel: 'high',
    icon: 'Brain'
  }
];

// ============================================
// Memory Backends
// ============================================

export const MEMORY_BACKENDS = [
  { value: 'file', label: 'File-based (default)' },
  { value: 'graphiti', label: 'Graphiti (LadybugDB)' }
] as const;

// ============================================
// Helper Functions
// ============================================

/**
 * Check if a model is an Ollama model
 */
export function isOllamaModel(model: string): boolean {
  return model.startsWith('ollama:');
}

/**
 * Get the provider for a model
 */
export function getModelProvider(model: string): AIProvider {
  return isOllamaModel(model) ? 'ollama' : 'claude';
}

/**
 * Get the Ollama model name (without prefix)
 */
export function getOllamaModelName(model: string): string {
  return model.replace('ollama:', '');
}

/**
 * Get models filtered by provider
 */
export function getModelsByProvider(provider: AIProvider) {
  return provider === 'claude' ? CLAUDE_MODELS : OLLAMA_MODELS;
}
