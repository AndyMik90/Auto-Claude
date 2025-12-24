/**
 * Project validation middleware for GitHub handlers
 *
 * Provides consistent project validation and error handling across all handlers.
 */

import { projectStore } from '../../../project-store';
import type { Project } from '../../../../shared/types';

/**
 * Execute a handler with automatic project validation
 *
 * Usage:
 * ```ts
 * ipcMain.handle('channel', async (_, projectId: string) => {
 *   return withProject(projectId, async (project) => {
 *     // Your handler logic here - project is guaranteed to exist
 *     return someResult;
 *   });
 * });
 * ```
 */
export async function withProject<T>(
  projectId: string,
  handler: (project: Project) => Promise<T>
): Promise<T> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  return handler(project);
}

/**
 * Execute a handler with project validation, returning null on missing project
 *
 * Usage for handlers that should return null instead of throwing:
 * ```ts
 * ipcMain.handle('channel', async (_, projectId: string) => {
 *   return withProjectOrNull(projectId, async (project) => {
 *     // Your handler logic here
 *     return someResult;
 *   });
 * });
 * ```
 */
export async function withProjectOrNull<T>(
  projectId: string,
  handler: (project: Project) => Promise<T>
): Promise<T | null> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    return null;
  }
  return handler(project);
}

/**
 * Execute a handler with project validation, returning a default value on missing project
 */
export async function withProjectOrDefault<T>(
  projectId: string,
  defaultValue: T,
  handler: (project: Project) => Promise<T>
): Promise<T> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    return defaultValue;
  }
  return handler(project);
}

/**
 * Synchronous version of withProject for non-async handlers
 */
export function withProjectSync<T>(
  projectId: string,
  handler: (project: Project) => T
): T {
  const project = projectStore.getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  return handler(project);
}

/**
 * Synchronous version that returns null on missing project
 */
export function withProjectSyncOrNull<T>(
  projectId: string,
  handler: (project: Project) => T
): T | null {
  const project = projectStore.getProject(projectId);
  if (!project) {
    return null;
  }
  return handler(project);
}
