import { ChildProcess } from 'child_process';
import type { IdeationConfig } from '../../shared/types';
import type { CompletablePhase } from '../../shared/constants/phase-protocol';

/**
 * Agent-specific types for process and state management
 */

export type QueueProcessType = 'ideation' | 'roadmap';

export interface AgentProcess {
  taskId: string;
  process: ChildProcess;
  startedAt: Date;
  projectPath?: string; // For ideation processes to load session on completion
  spawnId: number; // Unique ID to identify this specific spawn
  queueProcessType?: QueueProcessType; // Type of queue process (ideation or roadmap)
}

export interface ExecutionProgressData {
  phase: 'idle' | 'planning' | 'coding' | 'qa_review' | 'qa_fixing' | 'complete' | 'failed';
  phaseProgress: number;
  overallProgress: number;
  currentSubtask?: string;
  message?: string;
  // FIX (ACS-203): Track completed phases to prevent phase overlaps
  completedPhases?: CompletablePhase[];
}

export type ProcessType = 'spec-creation' | 'task-execution' | 'qa-process';

export interface AgentManagerEvents {
  log: (taskId: string, log: string) => void;
  error: (taskId: string, error: string) => void;
  exit: (taskId: string, code: number | null, processType: ProcessType) => void;
  'execution-progress': (taskId: string, progress: ExecutionProgressData) => void;
}

// IdeationConfig now imported from shared types to maintain consistency

export interface RoadmapConfig {
  model?: string;          // Model shorthand (opus, sonnet, haiku)
  thinkingLevel?: string;  // Thinking level (none, low, medium, high, ultrathink)
}

export interface TaskExecutionOptions {
  parallel?: boolean;
  workers?: number;
  baseBranch?: string;
  useWorktree?: boolean; // If false, use --direct mode (no worktree isolation)
}

type ModelType = 'haiku' | 'sonnet' | 'opus';
type ThinkingLevelType = 'none' | 'low' | 'medium' | 'high' | 'ultrathink';

export interface SpecCreationMetadata {
  requireReviewBeforeCoding?: boolean;
  // Auto profile - phase-based model and thinking configuration
  isAutoProfile?: boolean;

  // Native methodology phase configuration (spec, planning, coding, qa)
  phaseModels?: {
    spec: ModelType;
    planning: ModelType;
    coding: ModelType;
    qa: ModelType;
  };
  phaseThinking?: {
    spec: ThinkingLevelType;
    planning: ThinkingLevelType;
    coding: ThinkingLevelType;
    qa: ThinkingLevelType;
  };

  // BMAD methodology phase configuration (analyze, prd, architecture, epics, stories, dev, review)
  bmadPhaseModels?: {
    analyze: ModelType;
    prd: ModelType;
    architecture: ModelType;
    epics: ModelType;
    stories: ModelType;
    dev: ModelType;
    review: ModelType;
  };
  bmadPhaseThinking?: {
    analyze: ThinkingLevelType;
    prd: ThinkingLevelType;
    architecture: ThinkingLevelType;
    epics: ThinkingLevelType;
    stories: ThinkingLevelType;
    dev: ThinkingLevelType;
    review: ThinkingLevelType;
  };

  // Non-auto profile - single model and thinking level
  model?: ModelType;
  thinkingLevel?: ThinkingLevelType;
  // Workspace mode - whether to use worktree isolation
  useWorktree?: boolean; // If false, use --direct mode (no worktree isolation)
  // Methodology plugin name (e.g., 'native', 'bmad')
  methodology?: string;
  // Task execution complexity (auto, quick, standard, complex)
  // Maps to BMAD tracks: quick→QUICK_FLOW, standard→BMAD_METHOD, complex→ENTERPRISE
  executionComplexity?: 'auto' | 'quick' | 'standard' | 'complex';
}

export interface IdeationProgressData {
  phase: string;
  progress: number;
  message: string;
  completedTypes?: string[];
}

export interface RoadmapProgressData {
  phase: string;
  progress: number;
  message: string;
}
