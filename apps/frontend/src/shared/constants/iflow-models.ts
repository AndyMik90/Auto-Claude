/**
 * iFlow Model Configurations and Recommendations
 *
 * Constants for iFlow model selection and task-specific recommendations.
 */

import type { IFlowModel } from '../types/project';

/**
 * Default iFlow models with their configurations
 */
export const IFLOW_DEFAULT_MODELS: IFlowModel[] = [
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    capabilities: ['general', 'code', 'reasoning'],
    description: 'Cost-effective for general tasks and research',
    recommendedFor: ['spec_researcher', 'insights', 'commit_message', 'analysis'],
  },
  {
    id: 'deepseek-v3.2',
    name: 'DeepSeek V3.2',
    capabilities: ['general', 'code', 'reasoning'],
    description: 'Updated DeepSeek with improved capabilities',
    recommendedFor: ['spec_researcher', 'insights'],
  },
  {
    id: 'kimi-k2',
    name: 'Kimi K2 (Thinking)',
    capabilities: ['reasoning', 'planning', 'analysis'],
    description: 'Best for complex reasoning and planning tasks',
    recommendedFor: ['spec_writer', 'spec_critic', 'spec_validation', 'planner', 'pr_reviewer'],
  },
  {
    id: 'qwen3-coder',
    name: 'Qwen3 Coder',
    capabilities: ['code', 'implementation', 'debugging'],
    description: 'Optimized for code generation and understanding',
    recommendedFor: ['spec_gatherer', 'coder'],
  },
  {
    id: 'glm-4.7',
    name: 'GLM-4.7',
    capabilities: ['chinese', 'translation', 'general'],
    description: 'Best for Chinese language tasks',
    recommendedFor: [],
  },
  {
    id: 'tbstars2-200b',
    name: 'TBStars2-200B',
    capabilities: ['generation', 'quality', 'creativity'],
    description: 'High-quality generation for demanding tasks',
    recommendedFor: [],
  },
];

/**
 * UI badges for model capabilities
 */
export const MODEL_CAPABILITY_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  code: { label: 'Code', variant: 'default' },
  reasoning: { label: 'Reasoning', variant: 'secondary' },
  planning: { label: 'Planning', variant: 'secondary' },
  general: { label: 'General', variant: 'outline' },
  chinese: { label: 'Chinese', variant: 'outline' },
  translation: { label: 'Translation', variant: 'outline' },
  generation: { label: 'Generation', variant: 'outline' },
  quality: { label: 'Quality', variant: 'secondary' },
  creativity: { label: 'Creative', variant: 'outline' },
  analysis: { label: 'Analysis', variant: 'outline' },
  debugging: { label: 'Debug', variant: 'outline' },
  implementation: { label: 'Impl', variant: 'outline' },
};

/**
 * Model badges for special characteristics
 */
export const MODEL_SPECIAL_BADGES: Record<string, string> = {
  'kimi-k2': 'Best for Planning',
  'qwen3-coder': 'Best for Code',
  'deepseek-v3': 'Cost Effective',
  'glm-4.7': 'Chinese Expert',
  'tbstars2-200b': 'Premium Quality',
};

/**
 * Task type to recommended model mapping
 */
export const TASK_MODEL_RECOMMENDATIONS: Record<string, { model: string; reason: string }> = {
  spec_gathering: { model: 'qwen3-coder', reason: 'Good at understanding requirements' },
  research: { model: 'deepseek-v3', reason: 'Cost-effective for research tasks' },
  planning: { model: 'kimi-k2', reason: 'Strong reasoning capabilities' },
  coding: { model: 'qwen3-coder', reason: 'Optimized for code generation' },
  qa_review: { model: 'kimi-k2', reason: 'Thorough analysis capabilities' },
  insights: { model: 'deepseek-v3', reason: 'Fast and cheap for extraction' },
  commit_message: { model: 'deepseek-v3', reason: 'Simple task, any model works' },
  spec_writing: { model: 'kimi-k2', reason: 'Strong reasoning for spec creation' },
  spec_critique: { model: 'kimi-k2', reason: 'Deep analysis for self-critique' },
  translation: { model: 'glm-4.7', reason: 'Best for Chinese language tasks' },
};

/**
 * Phase to task type mapping
 */
export const PHASE_TO_TASK_TYPE: Record<string, string> = {
  spec: 'spec_gathering',
  planning: 'planning',
  coding: 'coding',
  qa: 'qa_review',
};

/**
 * Get recommended model for a specific phase
 */
export function getRecommendedModelForPhase(phase: string): { model: string; reason: string } | null {
  const taskType = PHASE_TO_TASK_TYPE[phase];
  if (!taskType) return null;
  return TASK_MODEL_RECOMMENDATIONS[taskType] || null;
}

/**
 * Get model info by ID
 */
export function getModelById(modelId: string): IFlowModel | undefined {
  return IFLOW_DEFAULT_MODELS.find((m) => m.id === modelId);
}

/**
 * Get special badge for a model
 */
export function getModelBadge(modelId: string): string | undefined {
  return MODEL_SPECIAL_BADGES[modelId];
}

/**
 * Check if a model is recommended for a specific agent type
 */
export function isModelRecommendedFor(modelId: string, agentType: string): boolean {
  const model = getModelById(modelId);
  return model?.recommendedFor?.includes(agentType) || false;
}
