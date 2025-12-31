import { spawn, execSync, ChildProcess } from 'child_process';
import { existsSync, readdirSync, mkdirSync, appendFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { app } from 'electron';
import { findPythonCommand, getBundledPythonPath } from './python-detector';

/**
 * Logger for Python environment validation.
 * Writes startup validation logs to ~/Library/Logs/auto-claude/env-validation.log
 *
 * Following patterns from log-service.ts for consistent logging across the application.
 */
class EnvValidationLogger {
  private logDir: string;
  private logFile: string;
  private initialized = false;

  constructor() {
    // ~/Library/Logs/auto-claude/ on macOS
    // For cross-platform support, fall back to userData/logs on other platforms
    if (process.platform === 'darwin') {
      this.logDir = path.join(os.homedir(), 'Library', 'Logs', 'auto-claude');
    } else if (process.platform === 'win32') {
      this.logDir = path.join(os.homedir(), 'AppData', 'Local', 'auto-claude', 'logs');
    } else {
      this.logDir = path.join(os.homedir(), '.local', 'share', 'auto-claude', 'logs');
    }
    this.logFile = path.join(this.logDir, 'env-validation.log');
  }

  /**
   * Ensure log directory exists and initialize the log file
   */
  private ensureInitialized(): void {
    if (this.initialized) return;

    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }
      this.initialized = true;
    } catch (error) {
      console.error('[EnvValidationLogger] Failed to create log directory:', error);
    }
  }

  /**
   * Write a log entry with timestamp
   */
  log(level: 'INFO' | 'WARN' | 'ERROR', message: string, details?: Record<string, unknown>): void {
    this.ensureInitialized();
    if (!this.initialized) return;

    try {
      const timestamp = new Date().toISOString();
      let logLine = `[${timestamp}] [${level}] ${message}`;

      if (details) {
        logLine += ` | ${JSON.stringify(details)}`;
      }

      logLine += '\n';
      appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('[EnvValidationLogger] Failed to write log:', error);
    }
  }

  /**
   * Log the start of a validation session with header
   */
  logSessionStart(): void {
    this.ensureInitialized();
    if (!this.initialized) return;

    try {
      const timestamp = new Date().toISOString();
      const header = [
        '',
        '='.repeat(80),
        `PYTHON ENV VALIDATION SESSION: ${timestamp}`,
        `Platform: ${process.platform}`,
        `Arch: ${process.arch}`,
        `Node: ${process.version}`,
        `App Packaged: ${app?.isPackaged ?? 'unknown'}`,
        '='.repeat(80),
        ''
      ].join('\n');

      appendFileSync(this.logFile, header);
    } catch (error) {
      console.error('[EnvValidationLogger] Failed to write session header:', error);
    }
  }

  /**
   * Log validation step with result
   */
  logValidationStep(step: string, success: boolean, details?: Record<string, unknown>): void {
    const level = success ? 'INFO' : 'WARN';
    const status = success ? 'PASS' : 'FAIL';
    this.log(level, `[${status}] ${step}`, details);
  }

  /**
   * Log Python path discovery
   */
  logPythonPath(type: string, pythonPath: string | null): void {
    if (pythonPath) {
      this.log('INFO', `Python path (${type}): ${pythonPath}`);
    } else {
      this.log('WARN', `Python path (${type}): NOT FOUND`);
    }
  }

  /**
   * Log validation summary
   */
  logSummary(success: boolean, summary: string): void {
    const level = success ? 'INFO' : 'ERROR';
    this.log(level, `VALIDATION SUMMARY: ${summary}`);
  }
}

// Singleton logger instance
const envValidationLogger = new EnvValidationLogger();

export interface PythonEnvStatus {
  ready: boolean;
  pythonPath: string | null;
  sitePackagesPath: string | null;
  venvExists: boolean;
  depsInstalled: boolean;
  usingBundledPackages: boolean;
  error?: string;
}

/**
 * Manages the Python environment for the auto-claude backend.
 *
 * For packaged apps:
 *   - Uses bundled Python binary (resources/python/)
 *   - Uses bundled site-packages (resources/python-site-packages/)
 *   - No venv creation or pip install needed - everything is pre-bundled
 *
 * For development mode:
 *   - Creates venv in the source directory
 *   - Installs dependencies via pip
 *
 * On packaged apps (especially Linux AppImages), the bundled source is read-only,
 * so for dev mode fallback we create the venv in userData instead.
 */
export class PythonEnvManager extends EventEmitter {
  private autoBuildSourcePath: string | null = null;
  private pythonPath: string | null = null;
  private sitePackagesPath: string | null = null;
  private usingBundledPackages = false;
  private isInitializing = false;
  private isReady = false;
  private initializationPromise: Promise<PythonEnvStatus> | null = null;
  private activeProcesses: Set<ChildProcess> = new Set();
  private static readonly VENV_CREATION_TIMEOUT_MS = 120000; // 2 minutes timeout for venv creation

  /**
   * Get the path where the venv should be created.
   * For packaged apps, this is in userData to avoid read-only filesystem issues.
   * For development, this is inside the source directory.
   */
  private getVenvBasePath(): string | null {
    if (!this.autoBuildSourcePath) return null;

    // For packaged apps, put venv in userData (writable location)
    // This fixes Linux AppImage where resources are read-only
    if (app.isPackaged) {
      return path.join(app.getPath('userData'), 'python-venv');
    }

    // Development mode - use source directory
    return path.join(this.autoBuildSourcePath, '.venv');
  }

  /**
   * Get the path to the venv Python executable
   */
  private getVenvPythonPath(): string | null {
    const venvPath = this.getVenvBasePath();
    if (!venvPath) return null;

    const venvPython =
      process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python');

    return venvPython;
  }

  /**
   * Get the path to pip in the venv
   * Returns null - we use python -m pip instead for better compatibility
   * @deprecated Use getVenvPythonPath() with -m pip instead
   */
  private getVenvPipPath(): string | null {
    return null; // Not used - we use python -m pip
  }

  /**
   * Check if venv exists
   */
  private venvExists(): boolean {
    const venvPython = this.getVenvPythonPath();
    return venvPython ? existsSync(venvPython) : false;
  }

  /**
   * Get the path to bundled site-packages (for packaged apps).
   * These are pre-installed during the build process.
   */
  private getBundledSitePackagesPath(): string | null {
    if (!app.isPackaged) {
      return null;
    }

    const sitePackagesPath = path.join(process.resourcesPath, 'python-site-packages');

    if (existsSync(sitePackagesPath)) {
      console.log(`[PythonEnvManager] Found bundled site-packages at: ${sitePackagesPath}`);
      return sitePackagesPath;
    }

    console.log(`[PythonEnvManager] Bundled site-packages not found at: ${sitePackagesPath}`);
    return null;
  }

  /**
   * Check if bundled packages are available and valid.
   * For packaged apps, we check if the bundled site-packages directory exists
   * and contains the marker file indicating successful bundling.
   */
  private hasBundledPackages(): boolean {
    const sitePackagesPath = this.getBundledSitePackagesPath();
    if (!sitePackagesPath) {
      return false;
    }

    // Check for the marker file that indicates successful bundling
    const markerPath = path.join(sitePackagesPath, '.bundled');
    if (existsSync(markerPath)) {
      console.log(`[PythonEnvManager] Found bundle marker, using bundled packages`);
      return true;
    }

    // Fallback: check if key packages exist
    // This handles cases where the marker might be missing but packages are there
    const claudeSdkPath = path.join(sitePackagesPath, 'claude_agent_sdk');
    const dotenvPath = path.join(sitePackagesPath, 'dotenv');
    if (existsSync(claudeSdkPath) || existsSync(dotenvPath)) {
      console.log(`[PythonEnvManager] Found key packages, using bundled packages`);
      return true;
    }

    return false;
  }

  /**
   * Check if required dependencies are installed.
   * Verifies all packages that must be present for the backend to work.
   * This ensures users don't encounter broken functionality when using features.
   */
  private async checkDepsInstalled(): Promise<boolean> {
    const venvPython = this.getVenvPythonPath();
    if (!venvPython || !existsSync(venvPython)) return false;

    try {
      // Check all dependencies - if any fail, we need to reinstall
      // This prevents issues where partial installs leave some packages missing
      // See: https://github.com/AndyMik90/Auto-Claude/issues/359
      //
      // Dependencies checked:
      // - claude_agent_sdk: Core agent SDK (required)
      // - dotenv: Environment variable loading (required)
      // - google.generativeai: Google AI/Gemini support (required for full functionality)
      // - real_ladybug + graphiti_core: Graphiti memory system (Python 3.12+ only)
      const checkScript = `
import sys
import claude_agent_sdk
import dotenv
import google.generativeai
# Graphiti dependencies only available on Python 3.12+
if sys.version_info >= (3, 12):
    import real_ladybug
    import graphiti_core
`;
      execSync(`"${venvPython}" -c "${checkScript.replace(/\n/g, '; ').replace(/; ; /g, '; ')}"`, {
        stdio: 'pipe',
        timeout: 15000
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate both bundled and venv Python environments.
   * Calls the backend environment_validator.py to check that both interpreters
   * have all required dependencies installed. This ensures features like
   * Insights, Roadmap, and Ideation don't fail with "Process exited with code 1".
   *
   * @returns Object with validation results for both environments
   */
  async validateBothEnvironments(): Promise<{
    success: boolean;
    bundled: { success: boolean; errors: string[] } | null;
    venv: { success: boolean; errors: string[] } | null;
    summary: string;
  }> {
    console.log('[PythonEnvManager] Validating both Python environments');

    // Start a new validation session in the log file
    envValidationLogger.logSessionStart();
    envValidationLogger.log('INFO', 'Starting Python environment validation');

    // Find a Python interpreter to run the validator
    const python = this.pythonPath || this.findSystemPython();
    envValidationLogger.logPythonPath('validator', python);

    if (!python) {
      const summary = 'No Python interpreter available to run validation';
      envValidationLogger.logSummary(false, summary);
      return {
        success: false,
        bundled: null,
        venv: null,
        summary
      };
    }

    // Locate the environment_validator.py script
    const validatorPath = this.autoBuildSourcePath
      ? path.join(this.autoBuildSourcePath, 'services', 'environment_validator.py')
      : null;

    envValidationLogger.log('INFO', 'Looking for validator script', {
      autoBuildSourcePath: this.autoBuildSourcePath,
      validatorPath,
      exists: validatorPath ? existsSync(validatorPath) : false
    });

    if (!validatorPath || !existsSync(validatorPath)) {
      // Fallback: try to find it in resources for packaged apps
      const resourcesPath = app.isPackaged
        ? path.join(process.resourcesPath, 'auto-claude', 'services', 'environment_validator.py')
        : null;

      envValidationLogger.log('INFO', 'Trying resources fallback', {
        resourcesPath,
        exists: resourcesPath ? existsSync(resourcesPath) : false
      });

      if (!resourcesPath || !existsSync(resourcesPath)) {
        console.log('[PythonEnvManager] environment_validator.py not found, skipping dual validation');
        envValidationLogger.log('WARN', 'Validator script not found in any location');
        return {
          success: true, // Don't block if validator not found
          bundled: null,
          venv: null,
          summary: 'Validator script not found (skipping dual environment check)'
        };
      }

      // Use the resources path
      envValidationLogger.log('INFO', 'Using resources validator path', { path: resourcesPath });
      return this._runEnvironmentValidator(python, resourcesPath);
    }

    envValidationLogger.log('INFO', 'Using source validator path', { path: validatorPath });
    return this._runEnvironmentValidator(python, validatorPath);
  }

  /**
   * Validate system build tools (make, cmake) are available.
   * Calls the backend system_check.py to verify build tools required for
   * compiling native packages like real_ladybug are installed.
   * This should be called BEFORE pip install to provide clear error messages
   * instead of cryptic build failures.
   *
   * @returns Object with validation results including missing tools and install instructions
   */
  async validateBuildTools(): Promise<{
    success: boolean;
    platform: string;
    missingTools: string[];
    errors: string[];
    installationInstructions: string;
  }> {
    console.log('[PythonEnvManager] Validating system build tools');

    // Find a Python interpreter to run the system check
    const python = this.pythonPath || this.findSystemPython();
    if (!python) {
      return {
        success: false,
        platform: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'Darwin' : 'Linux',
        missingTools: [],
        errors: ['No Python interpreter available to run system check'],
        installationInstructions: ''
      };
    }

    // Locate the system_check.py script
    const systemCheckPath = this.autoBuildSourcePath
      ? path.join(this.autoBuildSourcePath, 'services', 'system_check.py')
      : null;

    if (!systemCheckPath || !existsSync(systemCheckPath)) {
      // Fallback: try to find it in resources for packaged apps
      const resourcesPath = app.isPackaged
        ? path.join(process.resourcesPath, 'auto-claude', 'services', 'system_check.py')
        : null;

      if (!resourcesPath || !existsSync(resourcesPath)) {
        console.log('[PythonEnvManager] system_check.py not found, skipping build tools validation');
        return {
          success: true, // Don't block if validator not found
          platform: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'Darwin' : 'Linux',
          missingTools: [],
          errors: [],
          installationInstructions: ''
        };
      }

      // Use the resources path
      return this._runSystemCheck(python, resourcesPath);
    }

    return this._runSystemCheck(python, systemCheckPath);
  }

  /**
   * Internal method to run the system check script.
   * @param pythonPath Path to Python interpreter
   * @param systemCheckPath Path to system_check.py
   */
  private async _runSystemCheck(
    pythonPath: string,
    systemCheckPath: string
  ): Promise<{
    success: boolean;
    platform: string;
    missingTools: string[];
    errors: string[];
    installationInstructions: string;
  }> {
    const defaultPlatform = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'Darwin' : 'Linux';

    return new Promise((resolve) => {
      try {
        // Run with --json for structured output
        const result = execSync(
          `"${pythonPath}" "${systemCheckPath}" --json`,
          {
            stdio: 'pipe',
            timeout: 30000, // 30 second timeout for system check
            encoding: 'utf-8'
          }
        );

        // Parse JSON output
        const output = JSON.parse(result.trim());

        console.log('[PythonEnvManager] Build tools validation result:', output.success ? 'OK' : 'FAILED');

        if (output.missing_tools && output.missing_tools.length > 0) {
          console.log('[PythonEnvManager] Missing build tools:', output.missing_tools.join(', '));
        }

        resolve({
          success: output.success,
          platform: output.platform || defaultPlatform,
          missingTools: output.missing_tools || [],
          errors: output.errors || [],
          installationInstructions: output.installation_instructions || ''
        });
      } catch (error) {
        // Handle exec errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[PythonEnvManager] Failed to run system check:', errorMessage);

        // If the command failed but returned JSON (exit code 1 with valid output)
        if (error && typeof error === 'object' && 'stdout' in error) {
          const stdout = (error as { stdout: string }).stdout;
          if (stdout) {
            try {
              const output = JSON.parse(stdout.trim());
              console.log('[PythonEnvManager] Build tools validation result:', output.success ? 'OK' : 'FAILED');

              if (output.missing_tools && output.missing_tools.length > 0) {
                console.log('[PythonEnvManager] Missing build tools:', output.missing_tools.join(', '));
              }

              resolve({
                success: output.success,
                platform: output.platform || defaultPlatform,
                missingTools: output.missing_tools || [],
                errors: output.errors || [],
                installationInstructions: output.installation_instructions || ''
              });
              return;
            } catch {
              // JSON parse failed, continue to default error handling
            }
          }
        }

        resolve({
          success: false,
          platform: defaultPlatform,
          missingTools: [],
          errors: [`System check failed: ${errorMessage}`],
          installationInstructions: ''
        });
      }
    });
  }

  /**
   * Internal method to run the environment validator script.
   * @param pythonPath Path to Python interpreter
   * @param validatorPath Path to environment_validator.py
   */
  private async _runEnvironmentValidator(
    pythonPath: string,
    validatorPath: string
  ): Promise<{
    success: boolean;
    bundled: { success: boolean; errors: string[] } | null;
    venv: { success: boolean; errors: string[] } | null;
    summary: string;
  }> {
    envValidationLogger.log('INFO', 'Running environment validator', {
      pythonPath,
      validatorPath
    });

    return new Promise((resolve) => {
      try {
        // Run with --check-bundled --check-venv --json for structured output
        const result = execSync(
          `"${pythonPath}" "${validatorPath}" --check-bundled --check-venv --json`,
          {
            stdio: 'pipe',
            timeout: 60000, // 60 second timeout for validation
            encoding: 'utf-8'
          }
        );

        // Parse JSON output
        const output = JSON.parse(result.trim());

        console.log('[PythonEnvManager] Dual environment validation result:', output.success ? 'OK' : 'FAILED');

        // Log validation results
        envValidationLogger.logValidationStep('Dual environment validation', output.success);

        if (output.bundled) {
          console.log('[PythonEnvManager] Bundled Python:', output.bundled.success ? 'OK' : 'FAILED');
          envValidationLogger.logValidationStep('Bundled Python', output.bundled.success, {
            errors: output.bundled.errors || []
          });
        }
        if (output.venv) {
          console.log('[PythonEnvManager] Venv Python:', output.venv.success ? 'OK' : 'FAILED');
          envValidationLogger.logValidationStep('Venv Python', output.venv.success, {
            errors: output.venv.errors || []
          });
        }

        envValidationLogger.logSummary(output.success, output.summary || 'Validation completed');

        resolve({
          success: output.success,
          bundled: output.bundled
            ? { success: output.bundled.success, errors: output.bundled.errors || [] }
            : null,
          venv: output.venv
            ? { success: output.venv.success, errors: output.venv.errors || [] }
            : null,
          summary: output.summary || ''
        });
      } catch (error) {
        // Handle exec errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[PythonEnvManager] Failed to run environment validator:', errorMessage);
        envValidationLogger.log('ERROR', 'Validator execution failed', { error: errorMessage });

        // If the command failed but returned JSON (exit code 1 with valid output)
        if (error && typeof error === 'object' && 'stdout' in error) {
          const stdout = (error as { stdout: string }).stdout;
          if (stdout) {
            try {
              const output = JSON.parse(stdout.trim());
              envValidationLogger.logValidationStep('Validator (with errors)', output.success, {
                bundled: output.bundled,
                venv: output.venv
              });
              envValidationLogger.logSummary(output.success, output.summary || 'Completed with errors');
              resolve({
                success: output.success,
                bundled: output.bundled
                  ? { success: output.bundled.success, errors: output.bundled.errors || [] }
                  : null,
                venv: output.venv
                  ? { success: output.venv.success, errors: output.venv.errors || [] }
                  : null,
                summary: output.summary || ''
              });
              return;
            } catch {
              // JSON parse failed, continue to default error handling
              envValidationLogger.log('ERROR', 'Failed to parse validator output');
            }
          }
        }

        const summary = `Validation failed: ${errorMessage}`;
        envValidationLogger.logSummary(false, summary);

        resolve({
          success: false,
          bundled: null,
          venv: null,
          summary
        });
      }
    });
  }

  /**
   * Find Python 3.10+ (bundled or system).
   * Uses the shared python-detector logic which validates version requirements.
   * Priority: bundled Python (packaged apps) > system Python
   */
  private findSystemPython(): string | null {
    const pythonCmd = findPythonCommand();
    if (!pythonCmd) {
      return null;
    }

    // If this is the bundled Python path, use it directly
    const bundledPath = getBundledPythonPath();
    if (bundledPath && pythonCmd === bundledPath) {
      console.log(`[PythonEnvManager] Using bundled Python: ${bundledPath}`);
      return bundledPath;
    }

    try {
      // Get the actual executable path from the command
      // For commands like "py -3", we need to resolve to the actual executable
      const pythonPath = execSync(`${pythonCmd} -c "import sys; print(sys.executable)"`, {
        stdio: 'pipe',
        timeout: 5000
      }).toString().trim();

      console.log(`[PythonEnvManager] Found Python at: ${pythonPath}`);
      return pythonPath;
    } catch (err) {
      console.error(`[PythonEnvManager] Failed to get Python path for ${pythonCmd}:`, err);
      return null;
    }
  }

  /**
   * Create the virtual environment
   */
  private async createVenv(): Promise<boolean> {
    if (!this.autoBuildSourcePath) return false;

    const systemPython = this.findSystemPython();
    if (!systemPython) {
      const isPackaged = app.isPackaged;
      const errorMsg = isPackaged
        ? 'Python not found. The bundled Python may be corrupted.\n\n' +
          'Please try reinstalling the application, or install Python 3.10+ manually:\n' +
          'https://www.python.org/downloads/'
        : 'Python 3.10+ not found. Please install Python 3.10 or higher.\n\n' +
          'This is required for development mode. Download from:\n' +
          'https://www.python.org/downloads/';
      this.emit('error', errorMsg);
      return false;
    }

    this.emit('status', 'Creating Python virtual environment...');
    const venvPath = this.getVenvBasePath()!;
    console.warn('[PythonEnvManager] Creating venv at:', venvPath, 'with:', systemPython);

    return new Promise((resolve) => {
      const proc = spawn(systemPython, ['-m', 'venv', venvPath], {
        cwd: this.autoBuildSourcePath!,
        stdio: 'pipe'
      });

      // Track the process for cleanup on app exit
      this.activeProcesses.add(proc);

      let stderr = '';
      let resolved = false;

      // Set up timeout to kill hung venv creation
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.error('[PythonEnvManager] Venv creation timed out after', PythonEnvManager.VENV_CREATION_TIMEOUT_MS, 'ms');
          this.emit('error', 'Virtual environment creation timed out. This may indicate a system issue.');
          try {
            proc.kill();
          } catch {
            // Process may already be dead
          }
          this.activeProcesses.delete(proc);
          resolve(false);
        }
      }, PythonEnvManager.VENV_CREATION_TIMEOUT_MS);

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (resolved) return; // Already handled by timeout
        resolved = true;
        clearTimeout(timeoutId);
        this.activeProcesses.delete(proc);

        if (code === 0) {
          console.warn('[PythonEnvManager] Venv created successfully');
          resolve(true);
        } else {
          console.error('[PythonEnvManager] Failed to create venv:', stderr);
          this.emit('error', `Failed to create virtual environment: ${stderr}`);
          resolve(false);
        }
      });

      proc.on('error', (err) => {
        if (resolved) return; // Already handled by timeout
        resolved = true;
        clearTimeout(timeoutId);
        this.activeProcesses.delete(proc);

        console.error('[PythonEnvManager] Error creating venv:', err);
        this.emit('error', `Failed to create virtual environment: ${err.message}`);
        resolve(false);
      });
    });
  }

  /**
   * Bootstrap pip in the venv using ensurepip
   */
  private async bootstrapPip(): Promise<boolean> {
    const venvPython = this.getVenvPythonPath();
    if (!venvPython || !existsSync(venvPython)) {
      return false;
    }

    console.warn('[PythonEnvManager] Bootstrapping pip...');
    return new Promise((resolve) => {
      const proc = spawn(venvPython, ['-m', 'ensurepip'], {
        cwd: this.autoBuildSourcePath!,
        stdio: 'pipe'
      });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.warn('[PythonEnvManager] Pip bootstrapped successfully');
          resolve(true);
        } else {
          console.error('[PythonEnvManager] Failed to bootstrap pip:', stderr);
          resolve(false);
        }
      });

      proc.on('error', (err) => {
        console.error('[PythonEnvManager] Error bootstrapping pip:', err);
        resolve(false);
      });
    });
  }

  /**
   * Install dependencies from requirements.txt using python -m pip
   */
  private async installDeps(): Promise<boolean> {
    if (!this.autoBuildSourcePath) return false;

    const venvPython = this.getVenvPythonPath();
    const requirementsPath = path.join(this.autoBuildSourcePath, 'requirements.txt');

    if (!venvPython || !existsSync(venvPython)) {
      this.emit('error', 'Python not found in virtual environment');
      return false;
    }

    if (!existsSync(requirementsPath)) {
      this.emit('error', 'requirements.txt not found');
      return false;
    }

    // Bootstrap pip first if needed
    await this.bootstrapPip();

    this.emit('status', 'Installing Python dependencies (this may take a minute)...');
    console.warn('[PythonEnvManager] Installing dependencies from:', requirementsPath);

    return new Promise((resolve) => {
      // Use python -m pip for better compatibility across Python versions
      const proc = spawn(venvPython, ['-m', 'pip', 'install', '-r', requirementsPath], {
        cwd: this.autoBuildSourcePath!,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Emit progress updates for long-running installations
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.includes('Installing') || line.includes('Successfully')) {
            this.emit('status', line.trim());
          }
        }
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.warn('[PythonEnvManager] Dependencies installed successfully');
          this.emit('status', 'Dependencies installed successfully');
          resolve(true);
        } else {
          // Combine stderr and stdout for comprehensive error output
          const combinedOutput = (stderr + '\n' + stdout).trim();
          // Keep last 2000 chars to avoid overly long error messages but capture the actual error
          const truncatedOutput = combinedOutput.length > 2000
            ? '...' + combinedOutput.slice(-2000)
            : combinedOutput;

          console.error('[PythonEnvManager] Failed to install deps (exit code', code + '):', truncatedOutput);

          // Provide detailed error message with exit code and pip output
          const errorMessage = truncatedOutput
            ? `pip install failed (exit code ${code}):\n${truncatedOutput}`
            : `pip install failed with exit code ${code}`;

          this.emit('error', errorMessage);
          resolve(false);
        }
      });

      proc.on('error', (err) => {
        console.error('[PythonEnvManager] Error installing deps:', err);
        this.emit('error', `Failed to install dependencies: ${err.message}`);
        resolve(false);
      });
    });
  }

  /**
   * Initialize the Python environment.
   *
   * For packaged apps: Uses bundled Python + site-packages (no pip install needed)
   * For development: Creates venv and installs deps if needed.
   *
   * If initialization is already in progress, this will wait for and return
   * the existing initialization promise instead of starting a new one.
   */
  async initialize(autoBuildSourcePath: string): Promise<PythonEnvStatus> {
    // If there's already an initialization in progress, wait for it
    if (this.initializationPromise) {
      console.warn('[PythonEnvManager] Initialization already in progress, waiting...');
      return this.initializationPromise;
    }

    // If already ready and pointing to the same source, return cached status
    if (this.isReady && this.autoBuildSourcePath === autoBuildSourcePath) {
      return {
        ready: true,
        pythonPath: this.pythonPath,
        sitePackagesPath: this.sitePackagesPath,
        venvExists: true,
        depsInstalled: true,
        usingBundledPackages: this.usingBundledPackages
      };
    }

    // Start new initialization and store the promise
    this.initializationPromise = this._doInitialize(autoBuildSourcePath);

    try {
      return await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Internal initialization method that performs the actual setup.
   * This is separated from initialize() to support the promise queue pattern.
   */
  private async _doInitialize(autoBuildSourcePath: string): Promise<PythonEnvStatus> {
    this.isInitializing = true;
    this.autoBuildSourcePath = autoBuildSourcePath;

    console.warn('[PythonEnvManager] Initializing with path:', autoBuildSourcePath);

    // Log initialization start
    envValidationLogger.logSessionStart();
    envValidationLogger.log('INFO', 'Python environment initialization started', {
      autoBuildSourcePath,
      isPackaged: app.isPackaged,
      platform: process.platform
    });

    try {
      // For packaged apps, try to use bundled packages first (no pip install needed!)
      if (app.isPackaged && this.hasBundledPackages()) {
        console.warn('[PythonEnvManager] Using bundled Python packages (no pip install needed)');
        envValidationLogger.logValidationStep('Bundled packages check', true);

        const bundledPython = getBundledPythonPath();
        const bundledSitePackages = this.getBundledSitePackagesPath();

        envValidationLogger.logPythonPath('bundled', bundledPython);
        envValidationLogger.log('INFO', 'Bundled site-packages path', { path: bundledSitePackages });

        if (bundledPython && bundledSitePackages) {
          this.pythonPath = bundledPython;
          this.sitePackagesPath = bundledSitePackages;
          this.usingBundledPackages = true;
          this.isReady = true;
          this.isInitializing = false;

          this.emit('ready', this.pythonPath);
          console.warn('[PythonEnvManager] Ready with bundled Python:', this.pythonPath);
          console.warn('[PythonEnvManager] Using bundled site-packages:', this.sitePackagesPath);

          envValidationLogger.logSummary(true, 'Initialized with bundled Python');

          return {
            ready: true,
            pythonPath: this.pythonPath,
            sitePackagesPath: this.sitePackagesPath,
            venvExists: false, // Not using venv
            depsInstalled: true,
            usingBundledPackages: true
          };
        }
      }

      // Fallback to venv-based setup (for development or if bundled packages missing)
      console.warn('[PythonEnvManager] Using venv-based setup (development mode or bundled packages missing)');
      envValidationLogger.log('INFO', 'Using venv-based setup (development mode or bundled packages missing)');
      this.usingBundledPackages = false;

      // Check if venv exists
      const venvPath = this.getVenvBasePath();
      const venvPythonPath = this.getVenvPythonPath();
      envValidationLogger.log('INFO', 'Venv paths', { venvPath, venvPythonPath });

      if (!this.venvExists()) {
        console.warn('[PythonEnvManager] Venv not found, creating...');
        envValidationLogger.log('INFO', 'Venv not found, creating...');
        const created = await this.createVenv();
        envValidationLogger.logValidationStep('Venv creation', created);
        if (!created) {
          this.isInitializing = false;
          envValidationLogger.logSummary(false, 'Failed to create virtual environment');
          return {
            ready: false,
            pythonPath: null,
            sitePackagesPath: null,
            venvExists: false,
            depsInstalled: false,
            usingBundledPackages: false,
            error: 'Failed to create virtual environment'
          };
        }
      } else {
        console.warn('[PythonEnvManager] Venv already exists');
        envValidationLogger.logValidationStep('Venv exists', true);
      }

      // Check if deps are installed
      const depsInstalled = await this.checkDepsInstalled();
      envValidationLogger.logValidationStep('Dependencies check', depsInstalled);

      if (!depsInstalled) {
        console.warn('[PythonEnvManager] Dependencies not installed, installing...');
        envValidationLogger.log('INFO', 'Dependencies not installed, installing...');
        const installed = await this.installDeps();
        envValidationLogger.logValidationStep('Dependencies installation', installed);
        if (!installed) {
          this.isInitializing = false;
          envValidationLogger.logSummary(false, 'Failed to install dependencies');
          return {
            ready: false,
            pythonPath: this.getVenvPythonPath(),
            sitePackagesPath: null,
            venvExists: true,
            depsInstalled: false,
            usingBundledPackages: false,
            error: 'Failed to install dependencies'
          };
        }
      } else {
        console.warn('[PythonEnvManager] Dependencies already installed');
      }

      this.pythonPath = this.getVenvPythonPath();
      // For venv, site-packages is inside the venv
      const venvBase = this.getVenvBasePath();
      if (venvBase) {
        if (process.platform === 'win32') {
          // Windows venv structure: Lib/site-packages (no python version subfolder)
          this.sitePackagesPath = path.join(venvBase, 'Lib', 'site-packages');
        } else {
          // Unix venv structure: lib/python3.x/site-packages
          // Dynamically detect Python version from venv lib directory
          const libDir = path.join(venvBase, 'lib');
          let pythonVersion = 'python3.12'; // Fallback to bundled version

          if (existsSync(libDir)) {
            try {
              const entries = readdirSync(libDir);
              const pythonDir = entries.find(e => e.startsWith('python3.'));
              if (pythonDir) {
                pythonVersion = pythonDir;
              }
            } catch {
              // Use fallback version
            }
          }

          this.sitePackagesPath = path.join(venvBase, 'lib', pythonVersion, 'site-packages');
        }
      }

      this.isReady = true;
      this.isInitializing = false;

      this.emit('ready', this.pythonPath);
      console.warn('[PythonEnvManager] Ready with Python path:', this.pythonPath);

      envValidationLogger.logPythonPath('venv', this.pythonPath);
      envValidationLogger.log('INFO', 'Site-packages path', { path: this.sitePackagesPath });
      envValidationLogger.logSummary(true, 'Initialized with venv Python');

      return {
        ready: true,
        pythonPath: this.pythonPath,
        sitePackagesPath: this.sitePackagesPath,
        venvExists: true,
        depsInstalled: true,
        usingBundledPackages: false
      };
    } catch (error) {
      this.isInitializing = false;
      const message = error instanceof Error ? error.message : String(error);
      envValidationLogger.log('ERROR', 'Initialization failed with exception', { error: message });
      envValidationLogger.logSummary(false, `Initialization failed: ${message}`);
      return {
        ready: false,
        pythonPath: null,
        sitePackagesPath: null,
        venvExists: this.venvExists(),
        depsInstalled: false,
        usingBundledPackages: false,
        error: message
      };
    }
  }

  /**
   * Get the Python path (only valid after initialization)
   */
  getPythonPath(): string | null {
    return this.pythonPath;
  }

  /**
   * Get the site-packages path (only valid after initialization)
   */
  getSitePackagesPath(): string | null {
    return this.sitePackagesPath;
  }

  /**
   * Check if using bundled packages (vs venv)
   */
  isUsingBundledPackages(): boolean {
    return this.usingBundledPackages;
  }

  /**
   * Check if the environment is ready
   */
  isEnvReady(): boolean {
    return this.isReady;
  }

  /**
   * Get environment variables that should be set when spawning Python processes.
   * This ensures Python finds the bundled packages or venv packages.
   */
  getPythonEnv(): Record<string, string> {
    const env: Record<string, string> = {
      // Don't write bytecode - not needed and avoids permission issues
      PYTHONDONTWRITEBYTECODE: '1',
      // Use UTF-8 encoding
      PYTHONIOENCODING: 'utf-8',
      // Disable user site-packages to avoid conflicts
      PYTHONNOUSERSITE: '1',
    };

    // Set PYTHONPATH to our site-packages
    if (this.sitePackagesPath) {
      env.PYTHONPATH = this.sitePackagesPath;
    }

    return env;
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<PythonEnvStatus> {
    // If using bundled packages, we're always ready
    if (this.usingBundledPackages && this.pythonPath && this.sitePackagesPath) {
      return {
        ready: true,
        pythonPath: this.pythonPath,
        sitePackagesPath: this.sitePackagesPath,
        venvExists: false,
        depsInstalled: true,
        usingBundledPackages: true
      };
    }

    const venvExists = this.venvExists();
    const depsInstalled = venvExists ? await this.checkDepsInstalled() : false;

    return {
      ready: this.isReady,
      pythonPath: this.pythonPath,
      sitePackagesPath: this.sitePackagesPath,
      venvExists,
      depsInstalled,
      usingBundledPackages: this.usingBundledPackages
    };
  }

  /**
   * Clean up any active processes on app exit.
   * Should be called when the application is about to quit.
   */
  cleanup(): void {
    if (this.activeProcesses.size > 0) {
      console.warn('[PythonEnvManager] Cleaning up', this.activeProcesses.size, 'active process(es)');
      for (const proc of this.activeProcesses) {
        try {
          proc.kill();
        } catch {
          // Process may already be dead
        }
      }
      this.activeProcesses.clear();
    }
  }
}

// Singleton instance
export const pythonEnvManager = new PythonEnvManager();

// Register cleanup on app exit (guard for test environments where app.on may not exist)
if (typeof app?.on === 'function') {
  app.on('will-quit', () => {
    pythonEnvManager.cleanup();
  });
}

/**
 * Get the configured venv Python path if ready, otherwise fall back to system Python.
 * This should be used by ALL services that need to spawn Python processes.
 *
 * Priority:
 * 1. If venv is ready -> return venv Python (has all dependencies installed)
 * 2. Fall back to findPythonCommand() -> bundled or system Python
 *
 * Note: For scripts that require dependencies (dotenv, claude-agent-sdk, etc.),
 * the venv Python MUST be used. Only use this fallback for scripts that
 * don't have external dependencies (like ollama_model_detector.py).
 */
export function getConfiguredPythonPath(): string {
  // If venv is ready, always prefer it (has dependencies installed)
  if (pythonEnvManager.isEnvReady()) {
    const venvPath = pythonEnvManager.getPythonPath();
    if (venvPath) {
      return venvPath;
    }
  }

  // Fall back to system/bundled Python
  return findPythonCommand() || 'python';
}
