/**
 * Terminal Module
 * Modular terminal management system with Claude integration
 */

// Main manager
export { TerminalManager } from './terminal-manager';

// Types
export type {
  TerminalProcess,
  RateLimitEvent,
  OAuthTokenEvent,
  SessionCaptureResult,
  TerminalOperationResult,
  WindowGetter
} from './types';

// Output parsing utilities
export * as OutputParser from './output-parser';

// PTY management utilities
export * as PtyManager from './pty-manager';

// Session management utilities
export * as SessionHandler from './session-handler';
