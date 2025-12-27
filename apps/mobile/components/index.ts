/**
 * Components Index
 * Exports all reusable UI components for easy importing
 */

// Core Components
export { default as Badge, StatusBadge, PriorityBadge, CategoryBadge, CountBadge } from './Badge';
export type { } from './Badge'; // Badge doesn't export types

export { default as EmptyState } from './EmptyState';

export { default as ErrorMessage, InlineError } from './ErrorMessage';

export { default as Header, SimpleHeader, ModalHeader } from './Header';

export { default as LoadingIndicator, InlineLoadingIndicator } from './LoadingIndicator';

// Task Components
export { default as TaskCard } from './TaskCard';
export { default as KanbanBoard } from './KanbanBoard';
export { default as KanbanColumn, KANBAN_COLUMNS } from './KanbanColumn';

// Chat Components
export { default as ChatMessage } from './ChatMessage';

// Terminal Components
export { default as TerminalOutput } from './TerminalOutput';

// List Item Components
export { default as ProjectListItem } from './ProjectListItem';
export { default as IssueListItem } from './IssueListItem';
export { default as PRListItem } from './PRListItem';
export { default as TerminalListItem } from './TerminalListItem';

// Connection Components
export {
  default as ConnectionStatus,
  ConnectionStatusBadge,
  ConnectionStatusIcon,
  ConnectionStatusBar,
  useConnectionState,
} from './ConnectionStatus';

// Error Handling Components
export {
  default as ErrorBoundary,
  ScreenErrorBoundary,
  withErrorBoundary,
} from './ErrorBoundary';

// Offline Components
export {
  default as OfflineIndicator,
  OfflineBanner,
  OfflineBadge,
  OfflineToast,
  NetworkStatusBanner,
  useNetworkStatus,
} from './OfflineIndicator';
