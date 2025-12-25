import { ipcMain, shell } from 'electron';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult } from '../../shared/types';
import { projectStore } from '../project-store';

interface UnityProjectInfo {
  isUnityProject: boolean;
  version?: string;
  projectPath: string;
}

interface UnityEditorInfo {
  version: string;
  path: string;
}

interface UnitySettings {
  editorPath?: string;
  buildExecuteMethod?: string;
}

interface UnityRun {
  id: string;
  action: 'editmode-tests' | 'build';
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  status: 'running' | 'success' | 'failed';
  exitCode?: number;
  command: string;
  artifactPaths: {
    runDir: string;
    log?: string;
    testResults?: string;
    stdout?: string;
    stderr?: string;
  };
}

/**
 * Detect if a directory is a Unity project and extract version info
 */
function detectUnityProject(projectPath: string): UnityProjectInfo {
  const projectVersionPath = join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');

  const result: UnityProjectInfo = {
    isUnityProject: false,
    projectPath
  };

  // Primary detection: ProjectSettings/ProjectVersion.txt must exist
  if (!existsSync(projectVersionPath)) {
    return result;
  }

  // Also check for Assets/ and Packages/manifest.json for additional confidence
  const assetsPath = join(projectPath, 'Assets');
  const manifestPath = join(projectPath, 'Packages', 'manifest.json');

  const hasAssets = existsSync(assetsPath);
  const hasManifest = existsSync(manifestPath);

  // If we have ProjectVersion.txt and at least one of the other indicators
  if (hasAssets || hasManifest) {
    result.isUnityProject = true;

    // Parse version from ProjectVersion.txt
    try {
      const content = readFileSync(projectVersionPath, 'utf-8');
      const versionMatch = content.match(/m_EditorVersion:\s*(.+)/);
      if (versionMatch) {
        result.version = versionMatch[1].trim();
      }
    } catch (error) {
      console.error('Failed to read Unity version:', error);
    }
  }

  return result;
}

/**
 * Discover Unity Editor installations on the system
 */
function discoverUnityEditors(): UnityEditorInfo[] {
  const editors: UnityEditorInfo[] = [];
  const platform = process.platform;

  try {
    if (platform === 'win32') {
      // Windows: C:\Program Files\Unity\Hub\Editor\*\Editor\Unity.exe
      const hubPath = 'C:\\Program Files\\Unity\\Hub\\Editor';
      if (existsSync(hubPath)) {
        const versions = readdirSync(hubPath);
        for (const version of versions) {
          const editorPath = join(hubPath, version, 'Editor', 'Unity.exe');
          if (existsSync(editorPath)) {
            editors.push({ version, path: editorPath });
          }
        }
      }
    } else if (platform === 'darwin') {
      // macOS: /Applications/Unity/Hub/Editor/*/Unity.app/Contents/MacOS/Unity
      const hubPath = '/Applications/Unity/Hub/Editor';
      if (existsSync(hubPath)) {
        const versions = readdirSync(hubPath);
        for (const version of versions) {
          const editorPath = join(hubPath, version, 'Unity.app', 'Contents', 'MacOS', 'Unity');
          if (existsSync(editorPath)) {
            editors.push({ version, path: editorPath });
          }
        }
      }
    } else if (platform === 'linux') {
      // Linux: Try common paths
      const possiblePaths = [
        join(process.env.HOME || '', 'Unity', 'Hub', 'Editor'),
        join(process.env.HOME || '', '.local', 'share', 'Unity', 'Hub', 'Editor')
      ];

      for (const hubPath of possiblePaths) {
        if (existsSync(hubPath)) {
          const versions = readdirSync(hubPath);
          for (const version of versions) {
            const editorPath = join(hubPath, version, 'Editor', 'Unity');
            if (existsSync(editorPath)) {
              editors.push({ version, path: editorPath });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to discover Unity editors:', error);
  }

  return editors;
}

/**
 * Get Unity settings for a project
 */
function getUnitySettings(projectId: string): UnitySettings {
  const project = projectStore.getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const settingsPath = join(project.path, '.auto-claude', 'unity-settings.json');

  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read Unity settings:', error);
    }
  }

  return {};
}

/**
 * Save Unity settings for a project
 */
function saveUnitySettings(projectId: string, settings: UnitySettings): void {
  const project = projectStore.getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const autoCladePath = join(project.path, '.auto-claude');
  const settingsPath = join(autoCladePath, 'unity-settings.json');

  // Create .auto-claude directory if it doesn't exist
  if (!existsSync(autoCladePath)) {
    mkdirSync(autoCladePath, { recursive: true });
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Get the Unity runs directory for a project
 */
function getUnityRunsDir(projectId: string): string {
  const project = projectStore.getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const runsDir = join(project.path, '.auto-claude', 'unity-runs');

  // Create if it doesn't exist
  if (!existsSync(runsDir)) {
    mkdirSync(runsDir, { recursive: true });
  }

  return runsDir;
}

/**
 * Create a new run directory and return the run ID
 */
function createRunDir(projectId: string, action: 'editmode-tests' | 'build'): { id: string; dir: string } {
  const runsDir = getUnityRunsDir(projectId);

  // Generate run ID: YYYYMMDD-HHMMSS_action
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-').substring(0, 15);
  const id = `${timestamp}_${action}`;
  const runDir = join(runsDir, id);

  mkdirSync(runDir, { recursive: true });

  return { id, dir: runDir };
}

/**
 * Load Unity runs from disk
 */
function loadUnityRuns(projectId: string): UnityRun[] {
  const runsDir = getUnityRunsDir(projectId);
  const runs: UnityRun[] = [];

  try {
    if (existsSync(runsDir)) {
      const entries = readdirSync(runsDir);

      for (const entry of entries) {
        const runJsonPath = join(runsDir, entry, 'run.json');
        if (existsSync(runJsonPath)) {
          try {
            const content = readFileSync(runJsonPath, 'utf-8');
            const run = JSON.parse(content) as UnityRun;
            runs.push(run);
          } catch (error) {
            console.error(`Failed to read run ${entry}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to load Unity runs:', error);
  }

  // Sort by startedAt descending (newest first)
  runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  // Limit to last 50 runs
  return runs.slice(0, 50);
}

/**
 * Save a run record to disk
 */
function saveRunRecord(projectId: string, run: UnityRun): void {
  const runsDir = getUnityRunsDir(projectId);
  const runDir = join(runsDir, run.id);
  const runJsonPath = join(runDir, 'run.json');

  writeFileSync(runJsonPath, JSON.stringify(run, null, 2), 'utf-8');
}

/**
 * Run Unity EditMode tests
 */
async function runEditModeTests(projectId: string, editorPath: string): Promise<void> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const { id, dir: runDir } = createRunDir(projectId, 'editmode-tests');

  const logFile = join(runDir, 'unity-editor.log');
  const testResultsFile = join(runDir, 'test-results.xml');
  const stdoutFile = join(runDir, 'stdout.txt');
  const stderrFile = join(runDir, 'stderr.txt');

  const args = [
    '-runTests',
    '-batchmode',
    '-projectPath', project.path,
    '-testPlatform', 'EditMode',
    '-testResults', testResultsFile,
    '-logFile', logFile
  ];

  const command = `${editorPath} ${args.join(' ')}`;
  const startTime = new Date();

  // Create initial run record
  const run: UnityRun = {
    id,
    action: 'editmode-tests',
    startedAt: startTime.toISOString(),
    status: 'running',
    command,
    artifactPaths: {
      runDir,
      log: logFile,
      testResults: testResultsFile,
      stdout: stdoutFile,
      stderr: stderrFile
    }
  };

  saveRunRecord(projectId, run);

  return new Promise((resolve, reject) => {
    const process = spawn(editorPath, args, {
      cwd: project.path
    });

    let stdoutData = '';
    let stderrData = '';

    process.stdout?.on('data', (data) => {
      stdoutData += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderrData += data.toString();
    });

    process.on('close', (code) => {
      const endTime = new Date();

      // Save stdout and stderr
      writeFileSync(stdoutFile, stdoutData, 'utf-8');
      writeFileSync(stderrFile, stderrData, 'utf-8');

      // Update run record
      run.endedAt = endTime.toISOString();
      run.durationMs = endTime.getTime() - startTime.getTime();
      run.exitCode = code || 0;
      run.status = code === 0 ? 'success' : 'failed';

      saveRunRecord(projectId, run);
      resolve();
    });

    process.on('error', (error) => {
      const endTime = new Date();

      // Save stdout and stderr
      writeFileSync(stdoutFile, stdoutData, 'utf-8');
      writeFileSync(stderrFile, stderrData + '\n' + error.message, 'utf-8');

      // Update run record
      run.endedAt = endTime.toISOString();
      run.durationMs = endTime.getTime() - startTime.getTime();
      run.status = 'failed';

      saveRunRecord(projectId, run);
      reject(error);
    });
  });
}

/**
 * Run Unity custom build
 */
async function runBuild(projectId: string, editorPath: string, executeMethod: string): Promise<void> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const { id, dir: runDir } = createRunDir(projectId, 'build');

  const logFile = join(runDir, 'unity-editor.log');
  const stdoutFile = join(runDir, 'stdout.txt');
  const stderrFile = join(runDir, 'stderr.txt');

  const args = [
    '-batchmode',
    '-quit',
    '-projectPath', project.path,
    '-executeMethod', executeMethod,
    '-logFile', logFile
  ];

  const command = `${editorPath} ${args.join(' ')}`;
  const startTime = new Date();

  // Create initial run record
  const run: UnityRun = {
    id,
    action: 'build',
    startedAt: startTime.toISOString(),
    status: 'running',
    command,
    artifactPaths: {
      runDir,
      log: logFile,
      stdout: stdoutFile,
      stderr: stderrFile
    }
  };

  saveRunRecord(projectId, run);

  return new Promise((resolve, reject) => {
    const process = spawn(editorPath, args, {
      cwd: project.path
    });

    let stdoutData = '';
    let stderrData = '';

    process.stdout?.on('data', (data) => {
      stdoutData += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderrData += data.toString();
    });

    process.on('close', (code) => {
      const endTime = new Date();

      // Save stdout and stderr
      writeFileSync(stdoutFile, stdoutData, 'utf-8');
      writeFileSync(stderrFile, stderrData, 'utf-8');

      // Update run record
      run.endedAt = endTime.toISOString();
      run.durationMs = endTime.getTime() - startTime.getTime();
      run.exitCode = code || 0;
      run.status = code === 0 ? 'success' : 'failed';

      saveRunRecord(projectId, run);
      resolve();
    });

    process.on('error', (error) => {
      const endTime = new Date();

      // Save stdout and stderr
      writeFileSync(stdoutFile, stdoutData, 'utf-8');
      writeFileSync(stderrFile, stderrData + '\n' + error.message, 'utf-8');

      // Update run record
      run.endedAt = endTime.toISOString();
      run.durationMs = endTime.getTime() - startTime.getTime();
      run.status = 'failed';

      saveRunRecord(projectId, run);
      reject(error);
    });
  });
}

/**
 * Register all Unity-related IPC handlers
 */
export function registerUnityHandlers(): void {
  // Detect Unity project
  ipcMain.handle(
    IPC_CHANNELS.UNITY_DETECT_PROJECT,
    async (_, projectPath: string): Promise<IPCResult<UnityProjectInfo>> => {
      try {
        const info = detectUnityProject(projectPath);
        return { success: true, data: info };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to detect Unity project'
        };
      }
    }
  );

  // Discover Unity editors
  ipcMain.handle(
    IPC_CHANNELS.UNITY_DISCOVER_EDITORS,
    async (): Promise<IPCResult<{ editors: UnityEditorInfo[] }>> => {
      try {
        const editors = discoverUnityEditors();
        return { success: true, data: { editors } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to discover Unity editors'
        };
      }
    }
  );

  // Get Unity settings
  ipcMain.handle(
    IPC_CHANNELS.UNITY_GET_SETTINGS,
    async (_, projectId: string): Promise<IPCResult<UnitySettings>> => {
      try {
        const settings = getUnitySettings(projectId);
        return { success: true, data: settings };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get Unity settings'
        };
      }
    }
  );

  // Save Unity settings
  ipcMain.handle(
    IPC_CHANNELS.UNITY_SAVE_SETTINGS,
    async (_, projectId: string, settings: UnitySettings): Promise<IPCResult<void>> => {
      try {
        saveUnitySettings(projectId, settings);
        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save Unity settings'
        };
      }
    }
  );

  // Run EditMode tests
  ipcMain.handle(
    IPC_CHANNELS.UNITY_RUN_EDITMODE_TESTS,
    async (_, projectId: string, editorPath: string): Promise<IPCResult<void>> => {
      try {
        await runEditModeTests(projectId, editorPath);
        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to run EditMode tests'
        };
      }
    }
  );

  // Run build
  ipcMain.handle(
    IPC_CHANNELS.UNITY_RUN_BUILD,
    async (_, projectId: string, editorPath: string, executeMethod: string): Promise<IPCResult<void>> => {
      try {
        await runBuild(projectId, editorPath, executeMethod);
        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to run build'
        };
      }
    }
  );

  // Load runs
  ipcMain.handle(
    IPC_CHANNELS.UNITY_LOAD_RUNS,
    async (_, projectId: string): Promise<IPCResult<{ runs: UnityRun[] }>> => {
      try {
        const runs = loadUnityRuns(projectId);
        return { success: true, data: { runs } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load Unity runs'
        };
      }
    }
  );

  // Open path (for artifacts)
  ipcMain.handle(
    IPC_CHANNELS.UNITY_OPEN_PATH,
    async (_, path: string): Promise<IPCResult<void>> => {
      try {
        await shell.openPath(path);
        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to open path'
        };
      }
    }
  );

  console.warn('[IPC] Unity handlers registered');
}
