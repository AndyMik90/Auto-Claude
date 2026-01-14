/**
 * Conda API for renderer process
 *
 * Provides access to Conda environment management:
 * - Detect Conda installations on the system
 * - Create and manage app-level Auto Claude environment
 * - Create and manage project-level Python environments
 * - Install dependencies and check Python versions
 */

import { IPC_CHANNELS } from '../../../shared/constants';
import type {
  IPCResult,
  CondaDetectionResult,
  CondaEnvValidation,
  PythonVersionResult,
  SetupProgress,
  CondaProjectPaths,
} from '../../../shared/types';
import { createIpcListener, invokeIpc, IpcListenerCleanup } from './ipc-utils';

/**
 * Conda API interface exposed to renderer
 */
export interface CondaAPI {
  // Detection
  detectConda: () => Promise<IPCResult<CondaDetectionResult>>;
  refreshConda: () => Promise<IPCResult<CondaDetectionResult>>;

  // App-level environment
  setupAutoClaudeEnv: () => Promise<IPCResult<void>>;
  checkAutoClaudeEnv: () => Promise<IPCResult<CondaEnvValidation>>;

  // Project-level environment
  setupProjectEnv: (projectPath: string, projectName: string, pythonVersion?: string) => Promise<IPCResult<void>>;
  checkProjectEnv: (envPath: string) => Promise<IPCResult<CondaEnvValidation>>;
  deleteProjectEnv: (envPath: string) => Promise<IPCResult<void>>;
  deleteActivationScripts: (projectPath: string) => Promise<IPCResult<void>>;
  regenerateScripts: (envPath: string, projectPath: string) => Promise<IPCResult<{ workspacePath: string; initScriptPath: string }>>;

  // General
  getPythonVersion: (projectPath: string) => Promise<IPCResult<PythonVersionResult>>;
  installDeps: (envPath: string, requirementsPath: string) => Promise<IPCResult<void>>;
  getProjectPaths: (projectPath: string, projectName: string) => Promise<IPCResult<CondaProjectPaths>>;
  listPythonVersions: (projectPath?: string) => Promise<IPCResult<{ versions: string[]; recommended: string; detectedVersion?: string }>>;

  // Progress event listener
  onSetupProgress: (callback: (progress: SetupProgress) => void) => IpcListenerCleanup;
}

/**
 * Creates the Conda API implementation
 */
export const createCondaAPI = (): CondaAPI => ({
  // Detection
  detectConda: (): Promise<IPCResult<CondaDetectionResult>> =>
    invokeIpc(IPC_CHANNELS.CONDA_DETECT),

  refreshConda: (): Promise<IPCResult<CondaDetectionResult>> =>
    invokeIpc(IPC_CHANNELS.CONDA_REFRESH),

  // App-level environment
  setupAutoClaudeEnv: (): Promise<IPCResult<void>> =>
    invokeIpc(IPC_CHANNELS.CONDA_SETUP_AUTO_CLAUDE),

  checkAutoClaudeEnv: (): Promise<IPCResult<CondaEnvValidation>> =>
    invokeIpc(IPC_CHANNELS.CONDA_CHECK_AUTO_CLAUDE),

  // Project-level environment
  setupProjectEnv: (projectPath: string, projectName: string, pythonVersion?: string): Promise<IPCResult<void>> =>
    invokeIpc(IPC_CHANNELS.CONDA_SETUP_PROJECT_ENV, projectPath, projectName, pythonVersion),

  checkProjectEnv: (envPath: string): Promise<IPCResult<CondaEnvValidation>> =>
    invokeIpc(IPC_CHANNELS.CONDA_CHECK_PROJECT_ENV, envPath),

  deleteProjectEnv: (envPath: string): Promise<IPCResult<void>> =>
    invokeIpc(IPC_CHANNELS.CONDA_DELETE_PROJECT_ENV, envPath),

  deleteActivationScripts: (projectPath: string): Promise<IPCResult<void>> =>
    invokeIpc(IPC_CHANNELS.CONDA_DELETE_ACTIVATION_SCRIPTS, projectPath),

  regenerateScripts: (envPath: string, projectPath: string): Promise<IPCResult<{ workspacePath: string; initScriptPath: string }>> =>
    invokeIpc(IPC_CHANNELS.CONDA_REGENERATE_SCRIPTS, envPath, projectPath),

  // General
  getPythonVersion: (projectPath: string): Promise<IPCResult<PythonVersionResult>> =>
    invokeIpc(IPC_CHANNELS.CONDA_GET_PYTHON_VERSION, projectPath),

  installDeps: (envPath: string, requirementsPath: string): Promise<IPCResult<void>> =>
    invokeIpc(IPC_CHANNELS.CONDA_INSTALL_DEPS, envPath, requirementsPath),

  getProjectPaths: (projectPath: string, projectName: string): Promise<IPCResult<CondaProjectPaths>> =>
    invokeIpc(IPC_CHANNELS.CONDA_GET_PROJECT_PATHS, projectPath, projectName),

  listPythonVersions: (projectPath?: string): Promise<IPCResult<{ versions: string[]; recommended: string; detectedVersion?: string }>> =>
    invokeIpc(IPC_CHANNELS.CONDA_LIST_PYTHON_VERSIONS, projectPath),

  // Progress event listener
  onSetupProgress: (callback: (progress: SetupProgress) => void): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.CONDA_SETUP_PROGRESS, callback)
});
