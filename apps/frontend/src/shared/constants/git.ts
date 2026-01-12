/**
 * Git-related constants
 *
 * NOTE: These constants are also defined in apps/backend/core/worktree.py
 * If you modify BASE_BRANCHES here, ensure the Python version stays in sync.
 */

/**
 * Base/default branch names that should be filtered out when listing worktrees.
 * Used to detect orphaned worktrees after GitHub merge operations.
 * Comparison should be case-insensitive (use .toLowerCase()).
 */
export const BASE_BRANCHES = ['main', 'master', 'develop', 'head'] as const;

export type BaseBranch = (typeof BASE_BRANCHES)[number];
