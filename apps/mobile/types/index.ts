/**
 * Types Index
 * Re-exports all type definitions for easy importing
 *
 * Usage:
 * import { Task, Project, ChatSession } from '@/types';
 *
 * Or import from specific modules:
 * import type { Task, TaskStatus } from '@/types/task';
 */

// Task types
export type {
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskExecutionState,
  TaskLogEntry,
  TaskFile,
  TaskPlanStep,
  TaskPlan,
  Task,
  TaskCreateInput,
  TaskUpdateInput,
  KanbanColumn,
  TaskFilters,
  TaskSortOptions,
} from './task';

// Project types
export type {
  ProjectStatus,
  ProjectMemberRole,
  ProjectMember,
  ProjectStats,
  RoadmapFeature,
  ProjectIdea,
  ContextFile,
  ContextMemory,
  Project,
  ProjectSettings,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectFilters,
  RecentProject,
} from './project';

// Chat types
export type {
  MessageRole,
  MessageStatus,
  ToolCallStatus,
  ToolCall,
  ChatMessage,
  ChatSession,
  ChatSessionCreateInput,
  ChatSessionUpdateInput,
  SendMessageInput,
  MessageAttachment,
  ClaudeProfile,
  ChatSessionFilters,
  QuickPrompt,
} from './chat';

// Settings types
export type {
  ThemeMode,
  NotificationType,
  ConnectionStatus,
  ConnectionSettings,
  NotificationSettings,
  DisplaySettings,
  SecuritySettings,
  RateLimitConfig,
  RateLimitUsage,
  SyncSettings,
  AppSettings,
  SettingsUpdateInput,
} from './settings';

export {
  defaultNotificationSettings,
  defaultDisplaySettings,
  defaultSecuritySettings,
  defaultSyncSettings,
  defaultRateLimitConfig,
} from './settings';

// GitHub types
export type {
  IssueState,
  PRState,
  PRReviewState,
  GitHubLabel,
  GitHubUser,
  GitHubMilestone,
  GitHubComment,
  GitHubIssue,
  PRReview,
  PRCheck,
  GitHubPR,
  GitHubActionRequest,
  IssueFilters,
  PRFilters,
  GitHubRepository,
  GitHubIntegrationStatus,
} from './github';

// Terminal types
export type {
  TerminalStatus,
  OutputLineType,
  TerminalOutputLine,
  TerminalProcess,
  TerminalSession,
  TerminalSessionSummary,
  TerminalUpdateEvent,
  TerminalFilters,
  TerminalScrollState,
  TerminalDisplaySettings,
} from './terminal';

export { defaultTerminalDisplaySettings } from './terminal';

/**
 * Common utility types
 */

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: ApiError;
}

/**
 * API error
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Pagination params
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | 'task_update'
  | 'terminal_output'
  | 'chat_message'
  | 'notification'
  | 'connection_status'
  | 'sync';

/**
 * WebSocket message wrapper
 */
export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  payload: T;
  timestamp: string;
}
