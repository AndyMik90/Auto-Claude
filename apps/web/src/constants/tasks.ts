/**
 * Task-related constants for the Auto Claude Web UI
 */

import type { TaskStatus, ExecutionPhase } from '../types';

// Task status columns for Kanban board
export const TASK_STATUS_COLUMNS = [
  'backlog',
  'queue',
  'in_progress',
  'ai_review',
  'human_review',
  'done',
] as const;

// Task status labels (i18n keys)
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'status.backlog',
  queue: 'status.queue',
  in_progress: 'status.in_progress',
  ai_review: 'status.ai_review',
  human_review: 'status.human_review',
  done: 'status.done',
  pr_created: 'status.pr_created',
  error: 'status.error',
};

// Execution phase labels (i18n keys)
export const EXECUTION_PHASE_LABELS: Record<ExecutionPhase, string> = {
  initializing: 'phases.initializing',
  planning: 'phases.planning',
  executing: 'phases.executing',
  testing: 'phases.testing',
  reviewing: 'phases.reviewing',
  completed: 'phases.completed',
  failed: 'phases.failed',
};

// Execution phase badge colors
export const EXECUTION_PHASE_BADGE_COLORS: Record<ExecutionPhase, string> = {
  initializing: 'bg-muted text-muted-foreground border-border',
  planning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  executing: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  testing: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  reviewing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-400 border-red-500/30',
};
