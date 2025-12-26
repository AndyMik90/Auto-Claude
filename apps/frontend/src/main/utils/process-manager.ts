/**
 * Cross-platform process tree management
 * Handles killing process trees reliably on Windows, macOS, and Linux
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Kill a process and all its children
 * Works cross-platform (Windows, macOS, Linux)
 */
export async function killProcessTree(pid: number): Promise<void> {
  if (!pid || pid <= 0) {
    throw new Error('Invalid PID');
  }

  const platform = process.platform;

  try {
    if (platform === 'win32') {
      // Windows: Use taskkill with /T (tree) and /F (force) flags
      await execAsync(`taskkill /PID ${pid} /T /F`);
    } else {
      // macOS/Linux: Kill process group
      // First, try to kill the process group
      try {
        process.kill(-pid, 'SIGTERM');

        // Wait a bit and force kill if still alive
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          process.kill(-pid, 'SIGKILL');
        } catch (error) {
          // Process might already be dead, ignore error
        }
      } catch (error) {
        // If process group kill fails, try individual process kill
        try {
          process.kill(pid, 'SIGTERM');
          await new Promise(resolve => setTimeout(resolve, 1000));
          process.kill(pid, 'SIGKILL');
        } catch (killError) {
          // Process might already be dead, ignore error
        }
      }
    }
  } catch (error) {
    // Log error but don't throw - process might already be dead
    console.error(`Error killing process tree ${pid}:`, error);
  }
}

/**
 * Check if a process is still running
 */
export function isProcessRunning(pid: number): boolean {
  if (!pid || pid <= 0) return false;

  try {
    // Sending signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Store for active Unity processes
 */
class UnityProcessStore {
  private processes: Map<string, number> = new Map();

  register(runId: string, pid: number): void {
    this.processes.set(runId, pid);
  }

  unregister(runId: string): void {
    this.processes.delete(runId);
  }

  get(runId: string): number | undefined {
    return this.processes.get(runId);
  }

  async cancel(runId: string): Promise<boolean> {
    const pid = this.processes.get(runId);
    if (!pid) {
      return false;
    }

    try {
      await killProcessTree(pid);
      this.unregister(runId);
      return true;
    } catch (error) {
      console.error(`Failed to cancel Unity process ${runId}:`, error);
      return false;
    }
  }

  isRunning(runId: string): boolean {
    const pid = this.processes.get(runId);
    if (!pid) return false;
    return isProcessRunning(pid);
  }
}

// Export singleton instance
export const unityProcessStore = new UnityProcessStore();
