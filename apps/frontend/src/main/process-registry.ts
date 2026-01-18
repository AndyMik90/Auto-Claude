/**
 * Process Registry - Tracks spawned dev server processes per task/worktree
 *
 * Enables:
 * - Clean shutdown of dev servers when switching tasks
 * - "Stop App" functionality
 * - Automatic cleanup on app close
 * - Recovery after crash (persisted to disk)
 */

import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'java' | 'dotnet' | 'ruby' | 'php' | 'unknown';

export interface TrackedProcess {
  pid: number;
  taskId: string;
  worktreePath: string;
  command: string;
  startedAt: string;  // ISO date string for JSON serialization
  port?: number;
  type: ProjectType;
}

interface ProcessRegistryData {
  version: number;
  processes: TrackedProcess[];
}

const REGISTRY_VERSION = 1;
const SAVE_DEBOUNCE_MS = 1000;

class ProcessRegistry {
  private processes: Map<number, TrackedProcess> = new Map();
  private registryPath: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.registryPath = path.join(userDataPath, 'process-registry.json');
  }

  /**
   * Initialize the registry - load from disk and clean stale entries
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.loadFromDisk();
    await this.cleanStaleProcesses();
    this.initialized = true;
  }

  /**
   * Register a new process
   */
  register(process: TrackedProcess): void {
    this.processes.set(process.pid, process);
    this.scheduleSave();
  }

  /**
   * Unregister a process by PID
   */
  unregister(pid: number): void {
    this.processes.delete(pid);
    this.scheduleSave();
  }

  /**
   * Get all processes for a specific worktree
   */
  getByWorktree(worktreePath: string): TrackedProcess[] {
    const normalizedPath = this.normalizePath(worktreePath);
    return Array.from(this.processes.values()).filter(
      p => this.normalizePath(p.worktreePath) === normalizedPath
    );
  }

  /**
   * Get all processes for a specific task
   */
  getByTaskId(taskId: string): TrackedProcess[] {
    return Array.from(this.processes.values()).filter(p => p.taskId === taskId);
  }

  /**
   * Get all tracked processes
   */
  getAll(): TrackedProcess[] {
    return Array.from(this.processes.values());
  }

  /**
   * Check if a worktree has any running processes
   */
  hasRunningProcesses(worktreePath: string): boolean {
    return this.getByWorktree(worktreePath).length > 0;
  }

  /**
   * Kill all processes for a specific worktree
   */
  async killByWorktree(worktreePath: string): Promise<{ killed: number; errors: string[] }> {
    const processes = this.getByWorktree(worktreePath);
    return this.killProcesses(processes);
  }

  /**
   * Kill all processes for a specific task
   */
  async killByTaskId(taskId: string): Promise<{ killed: number; errors: string[] }> {
    const processes = this.getByTaskId(taskId);
    return this.killProcesses(processes);
  }

  /**
   * Kill all tracked processes (nuclear option)
   */
  async killAll(): Promise<{ killed: number; errors: string[] }> {
    const processes = this.getAll();
    return this.killProcesses(processes);
  }

  /**
   * Kill a list of processes
   */
  private async killProcesses(processes: TrackedProcess[]): Promise<{ killed: number; errors: string[] }> {
    let killed = 0;
    const errors: string[] = [];

    for (const proc of processes) {
      try {
        const success = await this.killProcess(proc.pid);
        if (success) {
          killed++;
          this.unregister(proc.pid);
        } else {
          // Process might already be dead - remove from registry
          this.unregister(proc.pid);
        }
      } catch (err) {
        errors.push(`Failed to kill PID ${proc.pid}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { killed, errors };
  }

  /**
   * Kill a single process by PID
   */
  private async killProcess(pid: number): Promise<boolean> {
    const isRunning = await this.isProcessRunning(pid);
    if (!isRunning) {
      return false;
    }

    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        // Windows: Use taskkill with /T to kill process tree
        const proc = spawn('taskkill', ['/F', '/T', '/PID', pid.toString()], {
          stdio: 'pipe'
        });
        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
      } else {
        // Unix: Try SIGTERM first, then SIGKILL
        try {
          process.kill(pid, 'SIGTERM');

          // Wait a bit then check if still running
          setTimeout(async () => {
            const stillRunning = await this.isProcessRunning(pid);
            if (stillRunning) {
              try {
                process.kill(pid, 'SIGKILL');
              } catch {
                // Ignore
              }
            }
            resolve(true);
          }, 1000);
        } catch {
          resolve(false);
        }
      }
    });
  }

  /**
   * Check if a process is still running
   */
  private async isProcessRunning(pid: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        const proc = spawn('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], {
          stdio: 'pipe'
        });
        let output = '';
        proc.stdout?.on('data', (data) => { output += data.toString(); });
        proc.on('close', () => {
          // Check that the PID appears as a whole word in the output to avoid partial matches
          const pidRegex = new RegExp(`\\b${pid}\\b`);
          resolve(pidRegex.test(output));
        });
        proc.on('error', () => resolve(false));
      } else {
        try {
          // Sending signal 0 checks if process exists without killing it
          process.kill(pid, 0);
          resolve(true);
        } catch {
          resolve(false);
        }
      }
    });
  }

  /**
   * Clean up processes that are no longer running
   */
  private async cleanStaleProcesses(): Promise<void> {
    const processes = this.getAll();

    for (const proc of processes) {
      const isRunning = await this.isProcessRunning(proc.pid);
      if (!isRunning) {
        this.processes.delete(proc.pid);
      }
    }

    this.scheduleSave();
  }

  /**
   * Load registry from disk
   */
  private loadFromDisk(): void {
    try {
      if (existsSync(this.registryPath)) {
        const content = readFileSync(this.registryPath, 'utf-8');
        const data: ProcessRegistryData = JSON.parse(content);

        if (data.version === REGISTRY_VERSION && Array.isArray(data.processes)) {
          for (const proc of data.processes) {
            this.processes.set(proc.pid, proc);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load process registry:', err);
      // Start fresh if corrupted
      this.processes.clear();
    }
  }

  /**
   * Save registry to disk (debounced)
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveToDisk();
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Immediately save registry to disk
   */
  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.registryPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data: ProcessRegistryData = {
        version: REGISTRY_VERSION,
        processes: Array.from(this.processes.values())
      };

      writeFileSync(this.registryPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save process registry:', err);
    }
  }

  /**
   * Normalize path for comparison
   */
  private normalizePath(p: string): string {
    return path.normalize(p).toLowerCase();
  }

  /**
   * Cleanup on app quit - optionally kill all processes
   */
  async onAppQuit(killProcesses = false): Promise<void> {
    if (killProcesses) {
      await this.killAll();
    }

    // Final save
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveToDisk();
  }
}

// Singleton instance
export const processRegistry = new ProcessRegistry();
