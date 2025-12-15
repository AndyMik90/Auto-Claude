import { ipcMain, app } from 'electron';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/constants';
import type {
  Project,
  ProjectSettings,
  IPCResult,
  InitializationResult,
  AutoBuildVersionInfo
} from '../../shared/types';
import { projectStore } from '../project-store';
import {
  initializeProject,
  isInitialized,
  hasLocalSource
} from '../project-initializer';
import { PythonEnvManager, type PythonEnvStatus } from '../python-env-manager';
import { AgentManager } from '../agent';
import { changelogService } from '../changelog-service';
import { insightsService } from '../insights-service';
import { titleGenerator } from '../title-generator';
import type { BrowserWindow } from 'electron';

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

/**
 * Auto-detect the auto-claude source path relative to the app location
 * In dev: auto-claude-ui/../auto-claude
 * In prod: Could be bundled or configured
 */
const detectAutoBuildSourcePath = (): string | null => {
  // Try relative to app directory (works in dev and if repo structure is maintained)
  // __dirname in main process points to out/main in dev
  const possiblePaths = [
    // Dev mode: from out/main -> ../../../auto-claude (sibling to auto-claude-ui)
    path.resolve(__dirname, '..', '..', '..', 'auto-claude'),
    // Alternative: from app root (useful in some packaged scenarios)
    path.resolve(app.getAppPath(), '..', 'auto-claude'),
    // If running from repo root
    path.resolve(process.cwd(), 'auto-claude'),
    // Try one more level up (in case of different build output structure)
    path.resolve(__dirname, '..', '..', 'auto-claude')
  ];

  for (const p of possiblePaths) {
    if (existsSync(p) && existsSync(path.join(p, 'VERSION'))) {
      return p;
    }
  }
  return null;
};

/**
 * Get the configured auto-claude source path from settings, or auto-detect
 */
const getAutoBuildSourcePath = (): string | null => {
  // First check if manually configured
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content);
      if (settings.autoBuildPath && existsSync(settings.autoBuildPath)) {
        return settings.autoBuildPath;
      }
    } catch {
      // Fall through to auto-detect
    }
  }

  // Auto-detect from app location
  return detectAutoBuildSourcePath();
};

/**
 * Configure all Python-dependent services with the managed Python path
 */
const configureServicesWithPython = (
  pythonPath: string,
  autoBuildPath: string,
  agentManager: AgentManager
): void => {
  console.log('[IPC] Configuring services with Python:', pythonPath);
  agentManager.configure(pythonPath, autoBuildPath);
  changelogService.configure(pythonPath, autoBuildPath);
  insightsService.configure(pythonPath, autoBuildPath);
  titleGenerator.configure(pythonPath, autoBuildPath);
};

/**
 * Initialize the Python environment and configure services
 */
const initializePythonEnvironment = async (
  pythonEnvManager: PythonEnvManager,
  agentManager: AgentManager
): Promise<PythonEnvStatus> => {
  const autoBuildSource = getAutoBuildSourcePath();
  if (!autoBuildSource) {
    console.log('[IPC] Auto-build source not found, skipping Python env init');
    return {
      ready: false,
      pythonPath: null,
      venvExists: false,
      depsInstalled: false,
      error: 'Auto-build source not found'
    };
  }

  console.log('[IPC] Initializing Python environment...');
  const status = await pythonEnvManager.initialize(autoBuildSource);

  if (status.ready && status.pythonPath) {
    configureServicesWithPython(status.pythonPath, autoBuildSource, agentManager);
  }

  return status;
};

/**
 * Register all project-related IPC handlers
 */
export function registerProjectHandlers(
  pythonEnvManager: PythonEnvManager,
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  // ============================================
  // Project Operations
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_ADD,
    async (_, projectPath: string): Promise<IPCResult<Project>> => {
      try {
        // Validate path exists
        if (!existsSync(projectPath)) {
          return { success: false, error: 'Directory does not exist' };
        }

        const project = projectStore.addProject(projectPath);
        return { success: true, data: project };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_REMOVE,
    async (_, projectId: string): Promise<IPCResult> => {
      const success = projectStore.removeProject(projectId);
      return { success };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_LIST,
    async (): Promise<IPCResult<Project[]>> => {
      // Validate that .auto-claude folders still exist for all projects
      // If a folder was deleted, reset autoBuildPath so UI prompts for reinitialization
      const resetIds = projectStore.validateProjects();
      if (resetIds.length > 0) {
        console.log('[IPC] PROJECT_LIST: Detected missing .auto-claude folders for', resetIds.length, 'project(s)');
      }

      const projects = projectStore.getProjects();
      console.log('[IPC] PROJECT_LIST returning', projects.length, 'projects');
      return { success: true, data: projects };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_UPDATE_SETTINGS,
    async (
      _,
      projectId: string,
      settings: Partial<ProjectSettings>
    ): Promise<IPCResult> => {
      const project = projectStore.updateProjectSettings(projectId, settings);
      if (project) {
        return { success: true };
      }
      return { success: false, error: 'Project not found' };
    }
  );

  // ============================================
  // Project Initialization Operations
  // ============================================

  // Set up Python environment status events
  pythonEnvManager.on('status', (message: string) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('python-env:status', message);
    }
  });

  pythonEnvManager.on('error', (error: string) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('python-env:error', error);
    }
  });

  pythonEnvManager.on('ready', (pythonPath: string) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('python-env:ready', pythonPath);
    }
  });

  // Initialize Python environment on startup (non-blocking)
  initializePythonEnvironment(pythonEnvManager, agentManager).then((status) => {
    console.log('[IPC] Python environment initialized:', status);
  });

  // IPC handler to get Python environment status
  ipcMain.handle(
    'python-env:get-status',
    async (): Promise<IPCResult<PythonEnvStatus>> => {
      const status = await pythonEnvManager.getStatus();
      return { success: true, data: status };
    }
  );

  // IPC handler to reinitialize Python environment
  ipcMain.handle(
    'python-env:reinitialize',
    async (): Promise<IPCResult<PythonEnvStatus>> => {
      const status = await initializePythonEnvironment(pythonEnvManager, agentManager);
      return { success: status.ready, data: status, error: status.error };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_INITIALIZE,
    async (_, projectId: string): Promise<IPCResult<InitializationResult>> => {
      try {
        const project = projectStore.getProject(projectId);
        if (!project) {
          return { success: false, error: 'Project not found' };
        }

        const result = initializeProject(project.path);

        if (result.success) {
          // Update project's autoBuildPath
          projectStore.updateAutoBuildPath(projectId, '.auto-claude');
        }

        return { success: result.success, data: result, error: result.error };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // PROJECT_UPDATE_AUTOBUILD is deprecated - .auto-claude only contains data, no code to update
  // Kept for API compatibility, returns success immediately
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_UPDATE_AUTOBUILD,
    async (_, projectId: string): Promise<IPCResult<InitializationResult>> => {
      try {
        const project = projectStore.getProject(projectId);
        if (!project) {
          return { success: false, error: 'Project not found' };
        }

        // Nothing to update - .auto-claude only contains data directories
        // The framework runs from the source repo
        return { success: true, data: { success: true } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // PROJECT_CHECK_VERSION now just checks if project is initialized
  // Version tracking for .auto-claude is removed since it only contains data
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CHECK_VERSION,
    async (_, projectId: string): Promise<IPCResult<AutoBuildVersionInfo>> => {
      try {
        const project = projectStore.getProject(projectId);
        if (!project) {
          return { success: false, error: 'Project not found' };
        }

        return {
          success: true,
          data: {
            isInitialized: isInitialized(project.path),
            updateAvailable: false // No updates for .auto-claude - it's just data
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Check if project has local auto-claude source (is dev project)
  ipcMain.handle(
    'project:has-local-source',
    async (_, projectId: string): Promise<IPCResult<boolean>> => {
      try {
        const project = projectStore.getProject(projectId);
        if (!project) {
          return { success: false, error: 'Project not found' };
        }
        return { success: true, data: hasLocalSource(project.path) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );
}
