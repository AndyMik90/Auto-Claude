/**
 * Task Types
 * Defines types for task management in the Kanban board
 */

/**
 * Task status - maps to Kanban columns
 */
export type TaskStatus =
  | 'backlog'
  | 'in_progress'
  | 'ai_review'
  | 'human_review'
  | 'done';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task category for organization
 */
export type TaskCategory =
  | 'feature'
  | 'bug'
  | 'refactor'
  | 'documentation'
  | 'test'
  | 'chore'
  | 'research';

/**
 * Task execution state
 */
export type TaskExecutionState =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

/**
 * Task log entry for execution logs
 */
export interface TaskLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  source?: string;
}

/**
 * Task file - files associated with a task
 */
export interface TaskFile {
  id: string;
  path: string;
  name: string;
  type: 'created' | 'modified' | 'deleted';
  language?: string;
}

/**
 * Task plan step
 */
export interface TaskPlanStep {
  id: string;
  order: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  estimatedDuration?: string;
}

/**
 * Task plan - implementation plan for a task
 */
export interface TaskPlan {
  id: string;
  steps: TaskPlanStep[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Main Task interface
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  complexity: number; // 1-10 scale
  impact: number; // 1-10 scale
  projectId: string;
  assignee?: string;
  labels?: string[];

  // Execution state
  executionState: TaskExecutionState;
  terminalSessionId?: string;

  // Related data
  logs?: TaskLogEntry[];
  files?: TaskFile[];
  plan?: TaskPlan;

  // Metadata
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: string;

  // Optional external references
  githubIssueId?: string;
  githubPRId?: string;
}

/**
 * Task creation input - subset of Task for creating new tasks
 */
export interface TaskCreateInput {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  complexity: number;
  impact: number;
  projectId: string;
  labels?: string[];
}

/**
 * Task update input - partial updates to a task
 */
export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  complexity?: number;
  impact?: number;
  labels?: string[];
  executionState?: TaskExecutionState;
}

/**
 * Column definition for Kanban board
 */
export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  tasks: Task[];
}

/**
 * Task filter options
 */
export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  category?: TaskCategory[];
  projectId?: string;
  search?: string;
}

/**
 * Task sort options
 */
export interface TaskSortOptions {
  field: 'createdAt' | 'updatedAt' | 'priority' | 'complexity' | 'impact' | 'title';
  direction: 'asc' | 'desc';
}
