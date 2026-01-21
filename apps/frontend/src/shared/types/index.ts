/**
 * Central export point for all shared types
 */

// Common types
export * from './common';

// Domain-specific types
// Export project types first (includes PhaseModelConfig and ThinkingLevel with provider support)
export * from './project';
export * from './task';
export * from './terminal';
export * from './agent';
// Export settings types - exclude PhaseModelConfig and ThinkingLevel to avoid conflicts with project.ts
// Import them explicitly when needed: import { PhaseModelConfig as SettingsPhaseModelConfig } from './settings'
export type {
  ColorTheme,
  SupportedIDE,
  SupportedTerminal,
  AgentProfile,
  AppSettings,
  SourceEnvConfig,
  SourceEnvCheckResult,
  FeatureModelConfig,
  FeatureThinkingConfig,
  PhaseModelConfig as SettingsPhaseModelConfig,
  ThinkingLevel as SettingsThinkingLevel,
  PhaseThinkingConfig,
  ModelTypeShort
} from './settings';
export * from './changelog';
export * from './insights';
export * from './roadmap';
export * from './integrations';
export * from './app-update';
export * from './cli';
export * from './human-input';

// IPC types (must be last to use types from other modules)
export * from './ipc';
