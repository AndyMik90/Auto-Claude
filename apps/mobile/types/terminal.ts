/**
 * Terminal Types
 * Defines types for terminal sessions (read-only viewer)
 */

/**
 * Terminal session status
 */
export type TerminalStatus = 'active' | 'idle' | 'closed' | 'error';

/**
 * Terminal output line type
 */
export type OutputLineType =
  | 'stdout'
  | 'stderr'
  | 'command'
  | 'info'
  | 'warning'
  | 'error'
  | 'system';

/**
 * Terminal output line
 */
export interface TerminalOutputLine {
  id: string;
  type: OutputLineType;
  content: string;
  timestamp: string;

  // ANSI color support
  hasAnsiCodes?: boolean;
  rawContent?: string;
}

/**
 * Terminal process info
 */
export interface TerminalProcess {
  pid: number;
  command: string;
  args?: string[];
  cwd?: string;
  startedAt: string;
  exitCode?: number;
  exitedAt?: string;
}

/**
 * Terminal session
 */
export interface TerminalSession {
  id: string;
  name: string;
  status: TerminalStatus;

  // Process info
  process?: TerminalProcess;
  currentCommand?: string;

  // Output
  output: TerminalOutputLine[];
  outputLineCount: number;

  // Buffer settings
  maxBufferLines: number;

  // Associated task
  taskId?: string;
  taskTitle?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;

  // Display preferences
  fontSize?: number;
  wordWrap?: boolean;
}

/**
 * Terminal session summary (for list view)
 */
export interface TerminalSessionSummary {
  id: string;
  name: string;
  status: TerminalStatus;
  taskId?: string;
  taskTitle?: string;
  lastCommand?: string;
  lastActivityAt?: string;
  outputLineCount: number;
}

/**
 * Terminal update event (from WebSocket)
 */
export interface TerminalUpdateEvent {
  type: 'output' | 'status' | 'clear' | 'process';
  sessionId: string;
  data: TerminalOutputLine | TerminalStatus | TerminalProcess | null;
}

/**
 * Terminal filter options
 */
export interface TerminalFilters {
  status?: TerminalStatus[];
  taskId?: string;
  search?: string;
}

/**
 * Terminal scroll position (for restoring view state)
 */
export interface TerminalScrollState {
  sessionId: string;
  scrollPosition: number;
  isAutoScrollEnabled: boolean;
}

/**
 * Terminal display settings
 */
export interface TerminalDisplaySettings {
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'monospace' | 'system';
  wordWrap: boolean;
  showTimestamps: boolean;
  showLineNumbers: boolean;
  theme: 'dark' | 'light' | 'solarized';
}

/**
 * Default terminal display settings
 */
export const defaultTerminalDisplaySettings: TerminalDisplaySettings = {
  fontSize: 'medium',
  fontFamily: 'monospace',
  wordWrap: false,
  showTimestamps: false,
  showLineNumbers: false,
  theme: 'dark',
};
