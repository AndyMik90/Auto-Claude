/**
 * Shared type definitions for Auto Claude Web UI
 * These types mirror the Electron app types but are adapted for web usage
 */

// Task-related types
export type TaskStatus =
  | 'backlog'
  | 'queue'
  | 'in_progress'
  | 'ai_review'
  | 'human_review'
  | 'done'
  | 'pr_created'
  | 'error';

export type SubtaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export type ReviewReason =
  | 'needs_context'
  | 'security_check'
  | 'breaking_change'
  | 'manual_verification'
  | 'test_failures';

export type ExecutionPhase =
  | 'initializing'
  | 'planning'
  | 'executing'
  | 'testing'
  | 'reviewing'
  | 'completed'
  | 'failed';

export interface Subtask {
  id: string;
  description: string;
  status: SubtaskStatus;
  phase?: string;
  files?: string[];
  verification?: string;
  notes?: string;
  error?: string;
}

export interface TaskMetadata {
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDuration?: string;
}

export interface ExecutionProgress {
  phase: ExecutionPhase;
  currentSubtask?: string;
  completedSubtasks: number;
  totalSubtasks: number;
  startTime?: Date;
  endTime?: Date;
  logs?: string[];
}

export interface ImplementationPhase {
  name: string;
  description?: string;
  subtasks: Subtask[];
  order: number;
}

export interface ImplementationPlan {
  phases: ImplementationPhase[];
  totalSubtasks?: number;
  estimatedDuration?: string;
}

export interface ImageAttachment {
  id: string;
  path: string;
  name: string;
  mimeType: string;
  size: number;
  addedAt: Date;
}

export interface TaskDraft {
  title: string;
  description: string;
  images?: ImageAttachment[];
}

export interface Task {
  id: string;
  specId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  metadata: TaskMetadata;
  plan?: ImplementationPlan;
  progress?: ExecutionProgress;
  reviewReason?: ReviewReason;
  reviewNotes?: string;
  images?: ImageAttachment[];
  draft?: TaskDraft;
}

export interface TaskOrderState {
  backlog: string[];
  queue: string[];
  in_progress: string[];
  ai_review: string[];
  human_review: string[];
  done: string[];
  pr_created: string[];
  error: string[];
}

// Settings-related types
export interface APIProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  provider: 'anthropic' | 'openai' | 'custom';
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileFormData {
  name: string;
  baseUrl: string;
  apiKey: string;
  provider: 'anthropic' | 'openai' | 'custom';
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  maxTokens?: number;
}

export interface DiscoverModelsResult {
  success: boolean;
  models?: ModelInfo[];
  error?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  autoSave: boolean;
  notifications: boolean;
  activeProfileId?: string | null;
}

// Terminal-related types
export type TerminalStatus = 'idle' | 'running' | 'claude-active' | 'exited';

export interface TerminalWorktreeConfig {
  path: string;
  branch: string;
  taskId: string;
}

export interface Terminal {
  id: string;
  title: string;
  status: TerminalStatus;
  cwd: string;
  createdAt: Date;
  isClaudeMode: boolean;
  claudeSessionId?: string;
  isRestored?: boolean;
  associatedTaskId?: string;
  projectPath?: string;
  worktreeConfig?: TerminalWorktreeConfig;
  isClaudeBusy?: boolean;
  pendingClaudeResume?: boolean;
  displayOrder?: number;
  claudeNamedOnce?: boolean;
}

export interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  isClaudeMode: boolean;
  claudeSessionId?: string;
  buffer: string;
  createdAt: Date;
  projectPath?: string;
  worktreeConfig?: TerminalWorktreeConfig;
  associatedTaskId?: string;
  displayOrder?: number;
  claudeNamedOnce?: boolean;
}

export interface TerminalLayout {
  id: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
