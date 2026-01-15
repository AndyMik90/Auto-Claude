import { EventEmitter } from 'events';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { AgentManager } from './agent/agent-manager';
import type { ImplementationPlan, TaskStatus } from '../shared/types';

/**
 * Configuration for task recovery behavior
 */
export interface RecoveryConfig {
  enabled: boolean;
  cooldownPeriodMs: number;
  maxRecoveryAttempts: number;
  scanIntervalMs: number;
}

/**
 * Default recovery configuration
 */
export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  enabled: true,
  cooldownPeriodMs: 5 * 60 * 1000, // 5 minutes
  maxRecoveryAttempts: 3,
  scanIntervalMs: 60 * 1000 // 60 seconds
};

/**
 * Information about a stuck task that needs recovery
 */
export interface StuckTask {
  taskId: string;
  projectId: string;
  projectPath: string;
  specId: string;
  status: 'ai_review' | 'in_progress';
  timeSinceLastUpdate: number;
  lastUpdatedAt: string;
}

/**
 * Recovery statistics
 */
export interface RecoveryStats {
  totalAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  tasksCurrentlyStuck: number;
}

/**
 * Health check status
 */
export interface RecoveryHealthStatus {
  isRunning: boolean;
  isEnabled: boolean;
  lastScanTime: number | null;
  nextScanTime: number | null;
  currentStats: RecoveryStats;
  config: RecoveryConfig;
  errors: string[];
}

/**
 * TaskRecoveryService - Automatically detects and recovers stuck tasks
 *
 * This service runs in the Electron main process and periodically scans
 * all projects for tasks that are stuck in ai_review or in_progress status
 * without an active agent process. When detected, it automatically restarts
 * the appropriate agent to unstick the task.
 */
export class TaskRecoveryService extends EventEmitter {
  private scanInterval: NodeJS.Timeout | null = null;
  private recoveryAttempts: Map<string, number> = new Map();
  private lastSeenTimestamps: Map<string, number> = new Map();
  private lastScanTime: number | null = null;
  private errors: string[] = [];
  private stats: RecoveryStats = {
    totalAttempts: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    tasksCurrentlyStuck: 0
  };

  constructor(
    private agentManager: AgentManager,
    private config: RecoveryConfig = DEFAULT_RECOVERY_CONFIG,
    private getProjectsFn: () => Promise<Array<{ id: string; path: string; name: string }>>
  ) {
    super();
  }

  /**
   * Start the recovery service
   * Begins periodic scanning for stuck tasks
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('[TaskRecoveryService] Auto-recovery is disabled in config');
      return;
    }

    if (this.scanInterval) {
      console.warn('[TaskRecoveryService] Already started');
      return;
    }

    console.log('[TaskRecoveryService] 🔄 Starting auto-recovery service', {
      scanInterval: `${this.config.scanIntervalMs / 1000}s`,
      cooldown: `${this.config.cooldownPeriodMs / 60000}min`,
      maxAttempts: this.config.maxRecoveryAttempts
    });

    // Run initial healthcheck and scan
    this.runHealthcheck().then(() => {
      console.log('[TaskRecoveryService] ✅ Initial healthcheck passed');

      // Run initial scan immediately
      this.scanForStuckTasks()
        .then(() => {
          this.lastScanTime = Date.now();
        })
        .catch((error) => {
          console.error('[TaskRecoveryService] Initial scan failed:', error);
          this.errors.push(`Initial scan failed: ${error.message}`);
        });
    });

    // Schedule periodic scans
    this.scanInterval = setInterval(() => {
      this.scanForStuckTasks()
        .then(() => {
          this.lastScanTime = Date.now();
        })
        .catch((error) => {
          console.error('[TaskRecoveryService] Periodic scan failed:', error);
          this.errors.push(`Scan failed: ${error.message}`);
          // Keep only last 10 errors
          if (this.errors.length > 10) {
            this.errors = this.errors.slice(-10);
          }
        });
    }, this.config.scanIntervalMs);

    this.emit('started');
  }

  /**
   * Stop the recovery service
   * Cancels periodic scanning
   */
  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      console.log('[TaskRecoveryService] Stopped auto-recovery service');
      this.emit('stopped');
    }
  }

  /**
   * Manually trigger a scan for stuck tasks
   * Returns array of detected stuck tasks
   */
  async scanForStuckTasks(): Promise<StuckTask[]> {
    try {
      const projects = await this.getProjectsFn();
      const stuckTasks: StuckTask[] = [];

      for (const project of projects) {
        const projectStuckTasks = await this.scanProject(project);
        stuckTasks.push(...projectStuckTasks);
      }

      // Update stats
      this.stats.tasksCurrentlyStuck = stuckTasks.length;

      if (stuckTasks.length > 0) {
        console.log(`[TaskRecoveryService] Found ${stuckTasks.length} stuck tasks`);

        // Attempt recovery for each stuck task
        for (const task of stuckTasks) {
          await this.recoverTask(task);
        }
      }

      return stuckTasks;
    } catch (error) {
      console.error('[TaskRecoveryService] Scan failed:', error);
      return [];
    }
  }

  /**
   * Scan a single project for stuck tasks
   */
  private async scanProject(project: { id: string; path: string; name: string }): Promise<StuckTask[]> {
    const stuckTasks: StuckTask[] = [];
    const autoClaudeDir = join(project.path, '.auto-claude', 'specs');

    if (!existsSync(autoClaudeDir)) {
      return stuckTasks;
    }

    try {
      const { readdirSync } = await import('fs');
      const specDirs = readdirSync(autoClaudeDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const specDir of specDirs) {
        const planPath = join(autoClaudeDir, specDir, 'implementation_plan.json');

        if (!existsSync(planPath)) continue;

        try {
          const planContent = readFileSync(planPath, 'utf-8');
          const plan: ImplementationPlan = JSON.parse(planContent);

          // Check if task is stuck
          const stuckTask = this.isTaskStuck(plan, project, specDir);
          if (stuckTask) {
            stuckTasks.push(stuckTask);
          }
        } catch (error) {
          console.warn(`[TaskRecoveryService] Failed to parse plan for ${specDir}:`, error);
        }
      }
    } catch (error) {
      console.error(`[TaskRecoveryService] Failed to scan project ${project.name}:`, error);
    }

    return stuckTasks;
  }

  /**
   * Check if a task is stuck and needs recovery
   */
  private isTaskStuck(
    plan: ImplementationPlan,
    project: { id: string; path: string; name: string },
    specDir: string
  ): StuckTask | null {
    const status = plan.status as TaskStatus;

    // Only recover tasks in ai_review or in_progress
    if (status !== 'ai_review' && status !== 'in_progress') {
      return null;
    }

    // Check if agent is currently running for this task
    // Note: We need to check if AgentManager has active process for this spec
    // For now, we'll use a simple heuristic based on timestamp
    const lastUpdated = plan.last_updated || plan.updated_at;
    if (!lastUpdated) {
      return null; // No timestamp, can't determine if stuck
    }

    const lastUpdateTime = new Date(lastUpdated).getTime();
    const now = Date.now();
    const timeSinceUpdate = now - lastUpdateTime;

    // Task is stuck if not updated for longer than cooldown period
    if (timeSinceUpdate < this.config.cooldownPeriodMs) {
      return null;
    }

    // Check if we've already attempted recovery too many times
    const taskKey = `${project.id}:${specDir}`;
    const attempts = this.recoveryAttempts.get(taskKey) || 0;
    if (attempts >= this.config.maxRecoveryAttempts) {
      console.log(`[TaskRecoveryService] Max recovery attempts reached for ${specDir}`);
      return null;
    }

    // Task is stuck!
    return {
      taskId: taskKey,
      projectId: project.id,
      projectPath: project.path,
      specId: specDir,
      status,
      timeSinceLastUpdate: timeSinceUpdate,
      lastUpdatedAt: lastUpdated
    };
  }

  /**
   * Attempt to recover a stuck task
   */
  async recoverTask(task: StuckTask): Promise<boolean> {
    const attempts = this.recoveryAttempts.get(task.taskId) || 0;

    console.log(`[TaskRecoveryService] Attempting recovery for ${task.specId}`, {
      status: task.status,
      timeSinceUpdate: `${Math.floor(task.timeSinceUpdate / 60000)}min`,
      attempt: `${attempts + 1}/${this.config.maxRecoveryAttempts}`
    });

    this.stats.totalAttempts++;
    this.recoveryAttempts.set(task.taskId, attempts + 1);

    try {
      // Determine which recovery action to take
      let success = false;

      if (task.status === 'ai_review') {
        // Start QA review
        console.log(`[TaskRecoveryService] Starting QA review for ${task.specId}`);
        await this.agentManager.startQAProcess(
          task.taskId,
          task.projectPath,
          task.specId
        );
        success = true;
      } else if (task.status === 'in_progress') {
        // Continue execution
        console.log(`[TaskRecoveryService] Continuing execution for ${task.specId}`);
        await this.agentManager.startTaskExecution(
          task.taskId,
          task.projectPath,
          task.specId,
          {} // Empty options - will use defaults (auto-continue, force, worktree)
        );
        success = true;
      }

      if (success) {
        this.stats.successfulRecoveries++;
        this.emit('task-recovered', task);
        console.log(`[TaskRecoveryService] ✓ Successfully recovered ${task.specId}`);
      }

      return success;
    } catch (error) {
      this.stats.failedRecoveries++;
      console.error(`[TaskRecoveryService] ✗ Failed to recover ${task.specId}:`, error);
      this.emit('task-recovery-failed', task, error);
      return false;
    }
  }

  /**
   * Get current recovery statistics
   */
  getRecoveryStats(): RecoveryStats {
    return { ...this.stats };
  }

  /**
   * Get current recovery configuration
   */
  getConfig(): RecoveryConfig {
    return { ...this.config };
  }

  /**
   * Reset recovery attempt counter for a task
   * Useful when task completes successfully
   */
  resetRecoveryAttempts(taskId: string): void {
    this.recoveryAttempts.delete(taskId);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart if scan interval changed
    if (newConfig.scanIntervalMs !== undefined && this.scanInterval) {
      this.stop();
      this.start();
    }
  }

  /**
   * Run healthcheck to verify service is working correctly
   * Called at startup and when switching projects
   */
  async runHealthcheck(): Promise<void> {
    console.log('[TaskRecoveryService] 🏥 Running healthcheck...');

    try {
      // Check if getProjectsFn works
      const projects = await this.getProjectsFn();
      console.log(`[TaskRecoveryService] ✓ Can access ${projects.length} project(s)`);

      // Check if agentManager is available
      if (!this.agentManager) {
        throw new Error('AgentManager not available');
      }
      console.log('[TaskRecoveryService] ✓ AgentManager available');

      // Verify config is valid
      if (this.config.scanIntervalMs < 10000) {
        console.warn('[TaskRecoveryService] ⚠️ Scan interval is very short (< 10s)');
      }
      if (this.config.cooldownPeriodMs < 60000) {
        console.warn('[TaskRecoveryService] ⚠️ Cooldown period is very short (< 1min)');
      }

      console.log('[TaskRecoveryService] ✅ Healthcheck passed', {
        enabled: this.config.enabled,
        scanInterval: `${this.config.scanIntervalMs / 1000}s`,
        cooldown: `${this.config.cooldownPeriodMs / 60000}min`,
        maxAttempts: this.config.maxRecoveryAttempts,
        projects: projects.length
      });

      this.emit('healthcheck-passed');
    } catch (error) {
      console.error('[TaskRecoveryService] ❌ Healthcheck failed:', error);
      this.errors.push(`Healthcheck failed: ${error.message}`);
      this.emit('healthcheck-failed', error);
      throw error;
    }
  }

  /**
   * Get current health status
   * Useful for monitoring and debugging
   */
  getHealthStatus(): RecoveryHealthStatus {
    const nextScanTime = this.lastScanTime && this.scanInterval
      ? this.lastScanTime + this.config.scanIntervalMs
      : null;

    return {
      isRunning: this.scanInterval !== null,
      isEnabled: this.config.enabled,
      lastScanTime: this.lastScanTime,
      nextScanTime,
      currentStats: { ...this.stats },
      config: { ...this.config },
      errors: [...this.errors]
    };
  }
}
