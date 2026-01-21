/**
 * Cross-platform regex patterns for worktree detection
 *
 * These patterns use [/\\] to match both Unix (/) and Windows (\) path separators,
 * ensuring the worktree detection feature works correctly on all platforms.
 *
 * Pattern structure: .auto-claude/worktrees/tasks/XXX-name/
 * Where XXX is a 3-digit spec number (001-999)
 */

/** Detects if path is within a worktree (basic test) */
export const WORKTREE_PATTERN = /\.auto-claude[/\\]worktrees[/\\]tasks[/\\][0-9]{3}-/;

/** Extracts worktree root path (full path to spec directory) */
export const WORKTREE_ROOT_PATTERN = /(.*\.auto-claude[/\\]worktrees[/\\]tasks[/\\][0-9]{3}-[^/\\]+)/;

/** Extracts spec number only (e.g., "009") */
export const WORKTREE_SPEC_PATTERN = /\.auto-claude[/\\]worktrees[/\\]tasks[/\\]([0-9]{3})-[^/\\]+/;

/** Extracts spec directory name (e.g., "009-feature-name") */
export const WORKTREE_SPEC_DIR_PATTERN = /\.auto-claude[/\\]worktrees[/\\]tasks[/\\](\d{3}-[^/\\]+)/;
