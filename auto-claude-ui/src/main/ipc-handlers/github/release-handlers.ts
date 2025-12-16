/**
 * GitHub release creation IPC handlers
 */

import { ipcMain } from 'electron';
import { execSync } from 'child_process';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult } from '../../../shared/types';
import { projectStore } from '../../project-store';
import type { ReleaseOptions } from './types';

/**
 * Check if gh CLI is installed
 */
function checkGhCli(): { installed: boolean; error?: string } {
  try {
    const checkCmd = process.platform === 'win32' ? 'where gh' : 'which gh';
    execSync(checkCmd, { encoding: 'utf-8', stdio: 'pipe' });
    return { installed: true };
  } catch {
    return {
      installed: false,
      error: 'GitHub CLI (gh) not found. Please install it: https://cli.github.com/'
    };
  }
}

/**
 * Check if user is authenticated with gh CLI
 */
function checkGhAuth(projectPath: string): { authenticated: boolean; error?: string } {
  try {
    execSync('gh auth status', { cwd: projectPath, encoding: 'utf-8', stdio: 'pipe' });
    return { authenticated: true };
  } catch {
    return {
      authenticated: false,
      error: 'Not authenticated with GitHub. Run "gh auth login" in terminal first.'
    };
  }
}

/**
 * Build gh release command arguments
 */
function buildReleaseArgs(version: string, releaseNotes: string, options?: ReleaseOptions): string[] {
  const tag = version.startsWith('v') ? version : `v${version}`;
  const args = ['release', 'create', tag, '--title', tag, '--notes', releaseNotes];

  if (options?.draft) {
    args.push('--draft');
  }
  if (options?.prerelease) {
    args.push('--prerelease');
  }

  return args;
}

/**
 * Create a GitHub release using gh CLI
 */
export function registerCreateRelease(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_CREATE_RELEASE,
    async (
      _,
      projectId: string,
      version: string,
      releaseNotes: string,
      options?: ReleaseOptions
    ): Promise<IPCResult<{ url: string }>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      // Check if gh CLI is available
      const cliCheck = checkGhCli();
      if (!cliCheck.installed) {
        return { success: false, error: cliCheck.error };
      }

      // Check if user is authenticated
      const authCheck = checkGhAuth(project.path);
      if (!authCheck.authenticated) {
        return { success: false, error: authCheck.error };
      }

      try {
        // Build and execute release command
        const args = buildReleaseArgs(version, releaseNotes, options);
        const command = `gh ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`;

        const output = execSync(command, {
          cwd: project.path,
          encoding: 'utf-8',
          stdio: 'pipe'
        }).trim();

        // Output is typically the release URL
        const tag = version.startsWith('v') ? version : `v${version}`;
        const releaseUrl = output || `https://github.com/releases/tag/${tag}`;

        return {
          success: true,
          data: { url: releaseUrl }
        };
      } catch (error) {
        // Extract error message from stderr if available
        const errorMsg = error instanceof Error ? error.message : 'Failed to create release';
        if (error && typeof error === 'object' && 'stderr' in error) {
          return { success: false, error: String(error.stderr) || errorMsg };
        }
        return { success: false, error: errorMsg };
      }
    }
  );
}

/**
 * Register all release-related handlers
 */
export function registerReleaseHandlers(): void {
  registerCreateRelease();
}
