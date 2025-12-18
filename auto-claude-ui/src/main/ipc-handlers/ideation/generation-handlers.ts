/**
 * Ideation generation handlers (start/stop generation)
 */

import type { IpcMainEvent, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult, IdeationConfig, IdeationGenerationStatus } from '../../../shared/types';
import { projectStore } from '../../project-store';
import type { AgentManager } from '../../agent';
import { debugLog } from '../../../shared/utils/debug-logger';

/**
 * Start ideation generation for a project
 */
export function startIdeationGeneration(
  _event: IpcMainEvent,
  projectId: string,
  config: IdeationConfig,
  agentManager: AgentManager,
  mainWindow: BrowserWindow | null
): void {
  debugLog('[Ideation Handler] Start generation request:', {
    projectId,
    enabledTypes: config.enabledTypes,
    maxIdeasPerType: config.maxIdeasPerType
  });

  if (!mainWindow) return;

  const project = projectStore.getProject(projectId);
  if (!project) {
    debugLog('[Ideation Handler] Project not found:', projectId);
    mainWindow.webContents.send(
      IPC_CHANNELS.IDEATION_ERROR,
      projectId,
      'Project not found'
    );
    return;
  }

  debugLog('[Ideation Handler] Starting agent manager generation:', {
    projectId,
    projectPath: project.path
  });

  // Start ideation generation via agent manager
  agentManager.startIdeationGeneration(projectId, project.path, config, false);

  // Send initial progress
  mainWindow.webContents.send(
    IPC_CHANNELS.IDEATION_PROGRESS,
    projectId,
    {
      phase: 'analyzing',
      progress: 10,
      message: 'Analyzing project structure...'
    } as IdeationGenerationStatus
  );
}

/**
 * Refresh ideation session (regenerate with new ideas)
 */
export function refreshIdeationSession(
  _event: IpcMainEvent,
  projectId: string,
  config: IdeationConfig,
  agentManager: AgentManager,
  mainWindow: BrowserWindow | null
): void {
  if (!mainWindow) return;

  const project = projectStore.getProject(projectId);
  if (!project) {
    mainWindow.webContents.send(
      IPC_CHANNELS.IDEATION_ERROR,
      projectId,
      'Project not found'
    );
    return;
  }

  // Start ideation regeneration with refresh flag
  agentManager.startIdeationGeneration(projectId, project.path, config, true);

  // Send initial progress
  mainWindow.webContents.send(
    IPC_CHANNELS.IDEATION_PROGRESS,
    projectId,
    {
      phase: 'analyzing',
      progress: 10,
      message: 'Refreshing ideation...'
    } as IdeationGenerationStatus
  );
}

/**
 * Stop ideation generation
 */
export async function stopIdeationGeneration(
  _event: IpcMainInvokeEvent,
  projectId: string,
  agentManager: AgentManager,
  mainWindow: BrowserWindow | null
): Promise<IPCResult> {
  debugLog('[Ideation Handler] Stop generation request:', { projectId });

  const wasStopped = agentManager.stopIdeation(projectId);

  debugLog('[Ideation Handler] Stop result:', { projectId, wasStopped });

  if (wasStopped && mainWindow) {
    debugLog('[Ideation Handler] Sending stopped event to renderer');
    mainWindow.webContents.send(IPC_CHANNELS.IDEATION_STOPPED, projectId);
  }

  return { success: wasStopped };
}
