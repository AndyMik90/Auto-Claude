/**
 * Git Environment Isolation Utility
 *
 * Prevents git environment variable contamination between worktrees
 * and the main repository. When running git commands in a worktree context,
 * environment variables like GIT_DIR, GIT_WORK_TREE, etc. can leak and
 * cause files to appear in the wrong repository.
 *
 * This utility clears problematic git env vars before spawning git processes,
 * ensuring each git operation targets the correct repository.
 *
 * Related fix: .husky/pre-commit hook also clears these vars.
 * Backend equivalent: apps/backend/core/git_executable.py:get_isolated_git_env()
 */

/**
 * Git environment variables that can cause cross-contamination between worktrees.
 *
 * GIT_DIR: Overrides the location of the .git directory
 * GIT_WORK_TREE: Overrides the working tree location
 * GIT_INDEX_FILE: Overrides the index file location
 * GIT_OBJECT_DIRECTORY: Overrides the object store location
 * GIT_ALTERNATE_OBJECT_DIRECTORIES: Additional object stores
 * GIT_AUTHOR_*: Can cause wrong commit attribution in automated contexts
 * GIT_COMMITTER_*: Can cause wrong commit attribution in automated contexts
 */
export const GIT_ENV_VARS_TO_CLEAR = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_AUTHOR_NAME',
  'GIT_AUTHOR_EMAIL',
  'GIT_AUTHOR_DATE',
  'GIT_COMMITTER_NAME',
  'GIT_COMMITTER_EMAIL',
  'GIT_COMMITTER_DATE',
] as const;

/**
 * Creates a clean environment for git subprocess operations.
 *
 * Copies the current process environment and removes git-specific
 * variables that can interfere with worktree operations.
 *
 * Also sets HUSKY=0 to disable the user's pre-commit hooks when
 * Auto-Claude manages commits, preventing double-hook execution
 * and potential conflicts.
 *
 * @param baseEnv - Optional base environment to start from. Defaults to process.env
 * @returns Clean environment object safe for git subprocess operations
 *
 * @example
 * ```typescript
 * import { spawn } from 'child_process';
 * import { getIsolatedGitEnv } from './git-isolation';
 *
 * spawn('git', ['status'], {
 *   cwd: worktreePath,
 *   env: getIsolatedGitEnv(),
 * });
 * ```
 */
export function getIsolatedGitEnv(
  baseEnv: NodeJS.ProcessEnv = process.env
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...baseEnv };

  for (const varName of GIT_ENV_VARS_TO_CLEAR) {
    delete env[varName];
  }

  env.HUSKY = '0';

  return env;
}

/**
 * Creates spawn options with isolated git environment.
 *
 * Convenience function that returns common spawn options
 * with the isolated environment already set.
 *
 * @param cwd - Working directory for the command
 * @param additionalOptions - Additional spawn options to merge
 * @returns Spawn options object with isolated git environment
 *
 * @example
 * ```typescript
 * import { execFileSync } from 'child_process';
 * import { getIsolatedGitSpawnOptions } from './git-isolation';
 *
 * execFileSync('git', ['status'], getIsolatedGitSpawnOptions(worktreePath));
 * ```
 */
export function getIsolatedGitSpawnOptions(
  cwd: string,
  additionalOptions: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    cwd,
    env: getIsolatedGitEnv(),
    encoding: 'utf-8',
    ...additionalOptions,
  };
}

/**
 * Refreshes the git index to ensure accurate status after external commits.
 *
 * Git caches file stat information in its index. When files are modified
 * externally (e.g., by another process or IDE), the cached stat info can
 * become stale, causing `git status` to report false positives for
 * uncommitted changes.
 *
 * This function runs `git update-index --refresh` which updates the cached
 * stat information to match the actual file system state.
 *
 * @param cwd - Working directory where the git command should run
 *
 * @example
 * ```typescript
 * import { refreshGitIndex } from './git-isolation';
 *
 * // Call before git status to ensure accurate results
 * refreshGitIndex(projectPath);
 * const status = execFileSync('git', ['status', '--porcelain'], { cwd: projectPath });
 * ```
 */
export function refreshGitIndex(cwd: string): void {
  // Import dynamically to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execFileSync } = require('child_process');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getToolPath } = require('../cli-tool-manager');

  try {
    execFileSync(getToolPath('git'), ['update-index', '--refresh'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    // Ignore refresh errors - it's a best-effort optimization
  }
}
