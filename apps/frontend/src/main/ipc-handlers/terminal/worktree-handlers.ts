import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import type {
  IPCResult,
  CreateTerminalWorktreeRequest,
  TerminalWorktreeConfig,
  TerminalWorktreeResult,
} from '../../../shared/types';
import path from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { debugLog, debugError } from '../../../shared/utils/debug-logger';
import { projectStore } from '../../project-store';
import { parseEnvFile } from '../utils';

const TERMINAL_WORKTREE_DIR = '.auto-claude/worktrees/terminal';
const MAX_TERMINAL_WORKTREES = 12;

function getTerminalWorktreeDir(projectPath: string): string {
  return path.join(projectPath, TERMINAL_WORKTREE_DIR);
}

function getTerminalWorktreePath(projectPath: string, name: string): string {
  return path.join(projectPath, TERMINAL_WORKTREE_DIR, name);
}

/**
 * Get the default branch from project settings OR env config
 */
function getDefaultBranch(projectPath: string): string {
  const project = projectStore.getProjects().find(p => p.path === projectPath);
  if (project?.settings?.mainBranch) {
    debugLog('[TerminalWorktree] Using mainBranch from project settings:', project.settings.mainBranch);
    return project.settings.mainBranch;
  }

  const envPath = path.join(projectPath, '.auto-claude', '.env');
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      const vars = parseEnvFile(content);
      if (vars['DEFAULT_BRANCH']) {
        debugLog('[TerminalWorktree] Using DEFAULT_BRANCH from env config:', vars['DEFAULT_BRANCH']);
        return vars['DEFAULT_BRANCH'];
      }
    } catch (error) {
      debugError('[TerminalWorktree] Error reading env file:', error);
    }
  }

  for (const branch of ['main', 'master']) {
    try {
      execSync(`git rev-parse --verify ${branch}`, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      debugLog('[TerminalWorktree] Auto-detected branch:', branch);
      return branch;
    } catch {
      // Branch doesn't exist, try next
    }
  }

  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: projectPath,
    encoding: 'utf-8',
  }).trim();
  debugLog('[TerminalWorktree] Falling back to current branch:', currentBranch);
  return currentBranch;
}

function saveWorktreeConfig(worktreePath: string, config: TerminalWorktreeConfig): void {
  writeFileSync(path.join(worktreePath, 'config.json'), JSON.stringify(config, null, 2));
}

function loadWorktreeConfig(worktreePath: string): TerminalWorktreeConfig | null {
  const configPath = path.join(worktreePath, 'config.json');
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

async function createTerminalWorktree(
  request: CreateTerminalWorktreeRequest
): Promise<TerminalWorktreeResult> {
  const { terminalId, name, taskId, createGitBranch, projectPath, baseBranch: customBaseBranch } = request;

  debugLog('[TerminalWorktree] Creating worktree:', { name, taskId, createGitBranch, projectPath, customBaseBranch });

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return {
      success: false,
      error: 'Invalid worktree name. Use only letters, numbers, dashes, and underscores.',
    };
  }

  const existing = await listTerminalWorktrees(projectPath);
  if (existing.length >= MAX_TERMINAL_WORKTREES) {
    return {
      success: false,
      error: `Maximum of ${MAX_TERMINAL_WORKTREES} terminal worktrees reached.`,
    };
  }

  const worktreePath = getTerminalWorktreePath(projectPath, name);
  const branchName = `terminal/${name}`;

  try {
    if (existsSync(worktreePath)) {
      return { success: false, error: `Worktree '${name}' already exists.` };
    }

    mkdirSync(getTerminalWorktreeDir(projectPath), { recursive: true });

    // Use custom base branch if provided, otherwise detect default
    const baseBranch = customBaseBranch || getDefaultBranch(projectPath);
    debugLog('[TerminalWorktree] Using base branch:', baseBranch, customBaseBranch ? '(custom)' : '(default)');

    try {
      execSync(`git fetch origin ${baseBranch}`, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      debugLog('[TerminalWorktree] Fetched latest from origin/' + baseBranch);
    } catch {
      debugLog('[TerminalWorktree] Could not fetch from remote, continuing with local branch');
    }

    let baseRef = baseBranch;
    try {
      execSync(`git rev-parse --verify origin/${baseBranch}`, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      baseRef = `origin/${baseBranch}`;
      debugLog('[TerminalWorktree] Using remote ref:', baseRef);
    } catch {
      debugLog('[TerminalWorktree] Remote ref not found, using local branch:', baseBranch);
    }

    if (createGitBranch) {
      execSync(`git worktree add -b "${branchName}" "${worktreePath}" "${baseRef}"`, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      debugLog('[TerminalWorktree] Created worktree with branch:', branchName, 'from', baseRef);
    } else {
      execSync(`git worktree add --detach "${worktreePath}" "${baseRef}"`, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      debugLog('[TerminalWorktree] Created worktree in detached HEAD mode from', baseRef);
    }

    const config: TerminalWorktreeConfig = {
      name,
      worktreePath,
      branchName: createGitBranch ? branchName : '',
      baseBranch,
      hasGitBranch: createGitBranch,
      taskId,
      createdAt: new Date().toISOString(),
      terminalId,
    };

    saveWorktreeConfig(worktreePath, config);
    debugLog('[TerminalWorktree] Saved config for worktree:', name);

    return { success: true, config };
  } catch (error) {
    debugError('[TerminalWorktree] Error creating worktree:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create worktree',
    };
  }
}

async function listTerminalWorktrees(projectPath: string): Promise<TerminalWorktreeConfig[]> {
  const configs: TerminalWorktreeConfig[] = [];
  const worktreeDir = getTerminalWorktreeDir(projectPath);

  if (existsSync(worktreeDir)) {
    try {
      for (const dir of readdirSync(worktreeDir, { withFileTypes: true })) {
        if (dir.isDirectory()) {
          const worktreePath = path.join(worktreeDir, dir.name);
          const config = loadWorktreeConfig(worktreePath);
          if (config) {
            configs.push(config);
          }
        }
      }
    } catch (error) {
      debugError('[TerminalWorktree] Error listing worktrees:', error);
    }
  }

  return configs;
}

async function removeTerminalWorktree(
  projectPath: string,
  name: string,
  deleteBranch: boolean = false
): Promise<IPCResult> {
  debugLog('[TerminalWorktree] Removing worktree:', { name, deleteBranch, projectPath });

  const worktreePath = getTerminalWorktreePath(projectPath, name);
  const config = loadWorktreeConfig(worktreePath);

  if (!config) {
    return { success: false, error: 'Worktree not found' };
  }

  try {
    if (existsSync(worktreePath)) {
      execSync(`git worktree remove --force "${worktreePath}"`, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      debugLog('[TerminalWorktree] Removed git worktree');
    }

    if (deleteBranch && config.hasGitBranch && config.branchName) {
      try {
        execSync(`git branch -D "${config.branchName}"`, {
          cwd: projectPath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        debugLog('[TerminalWorktree] Deleted branch:', config.branchName);
      } catch {
        debugLog('[TerminalWorktree] Branch not found or already deleted:', config.branchName);
      }
    }

    return { success: true };
  } catch (error) {
    debugError('[TerminalWorktree] Error removing worktree:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove worktree',
    };
  }
}

export function registerTerminalWorktreeHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_WORKTREE_CREATE,
    async (_, request: CreateTerminalWorktreeRequest): Promise<TerminalWorktreeResult> => {
      return createTerminalWorktree(request);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_WORKTREE_LIST,
    async (_, projectPath: string): Promise<IPCResult<TerminalWorktreeConfig[]>> => {
      try {
        const configs = await listTerminalWorktrees(projectPath);
        return { success: true, data: configs };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list worktrees',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_WORKTREE_REMOVE,
    async (
      _,
      projectPath: string,
      name: string,
      deleteBranch: boolean
    ): Promise<IPCResult> => {
      return removeTerminalWorktree(projectPath, name, deleteBranch);
    }
  );
}
