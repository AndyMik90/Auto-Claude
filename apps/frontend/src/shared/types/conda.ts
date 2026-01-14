/**
 * Conda Environment Management Types
 *
 * Shared types for Conda environment detection, creation, and management.
 * Used by both main process (conda services) and renderer process (Settings UI).
 */

// ============================================================================
// Conda Installation Detection
// ============================================================================

/**
 * Type of Conda distribution detected
 */
export type CondaDistributionType = 'miniconda' | 'anaconda' | 'mambaforge' | 'miniforge' | 'unknown';

/**
 * Legacy alias for backward compatibility
 */
export type CondaType = CondaDistributionType;

/**
 * Represents a detected Conda installation on the system
 */
export interface CondaInstallation {
  /** Full path to the Conda installation directory (e.g., C:\Users\Jason\miniconda3) */
  path: string;
  /** Full path to the conda executable (e.g., C:\Users\Jason\miniconda3\Scripts\conda.exe) */
  condaExe: string;
  /** Legacy alias for condaExe - path to the Conda executable */
  executablePath: string;
  /** Conda version string (e.g., "24.1.2") */
  version: string;
  /** Type of Conda distribution */
  type: CondaDistributionType;
}

/**
 * Result of scanning the system for Conda installations
 */
export interface CondaDetectionResult {
  /** Whether any valid Conda installation was found */
  found: boolean;
  /** All detected Conda installations */
  installations: CondaInstallation[];
  /** The preferred/recommended installation (first valid one found) */
  preferred: CondaInstallation | null;
  /** Timestamp when the detection was performed */
  timestamp?: number;
  /** Error message if detection failed */
  error?: string;
}

// ============================================================================
// Python Version Detection
// ============================================================================

/**
 * Source of Python version detection
 */
export type PythonVersionSource =
  | 'comment'           // # python 3.12 in requirements.txt
  | 'marker'            // python_requires marker
  | 'pyproject.toml'    // requires-python in pyproject.toml
  | 'environment.yml'   // conda environment.yml
  | 'runtime.txt'       // Heroku runtime.txt
  | '.python-version'   // pyenv version file
  | 'default';          // Fallback default

/**
 * Type of Python version constraint
 */
export type PythonVersionConstraint = 'exact' | 'minimum' | 'range';

/**
 * Result of parsing Python version requirements from project files
 */
export interface PythonVersionResult {
  /** Normalized Python version (e.g., "3.12") */
  version: string;
  /** Where the version requirement was found */
  source: PythonVersionSource;
  /** Type of version constraint */
  constraint: PythonVersionConstraint;
  /** Original text that was matched/parsed */
  raw: string;
}

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Configuration for creating a new Conda environment
 */
export interface CondaEnvConfig {
  /** Where to create the environment (e.g., project/.envs/myproject/) */
  envPath: string;
  /** Python version to install (e.g., "3.12") */
  pythonVersion: string;
  /** Path to requirements.txt file (optional) */
  requirementsPath?: string;
  /** Display name for the environment */
  envName?: string;
  /** Conda installation to use for creating the environment */
  condaInstallation?: CondaInstallation;
}

/**
 * Result of environment creation
 */
export interface CondaEnvCreateResult {
  /** Whether creation was successful */
  success: boolean;
  /** The created environment configuration */
  config?: CondaEnvConfig;
  /** Path to generated activation scripts */
  scripts?: ActivationScripts;
  /** Error message if creation failed */
  error?: string;
  /** Detailed log output from conda commands */
  log?: string;
}

// ============================================================================
// Setup Progress Tracking
// ============================================================================

/**
 * Steps in the Conda environment setup process
 */
export type CondaSetupStep =
  | 'detecting'           // Detecting Conda installations
  | 'analyzing'           // Analyzing project requirements and Python version
  | 'creating'            // Creating conda environment
  | 'installing-python'   // Installing Python version
  | 'verifying-python'    // Verifying Python installation
  | 'installing-deps'     // Installing dependencies from requirements.txt
  | 'generating-scripts'  // Generating activation scripts
  | 'finalizing'          // Finalizing environment (Windows indexing delay)
  | 'complete'            // Setup completed successfully
  | 'error';              // Setup failed

/**
 * Progress update during environment setup
 */
export interface SetupProgress {
  /** Current step in the setup process */
  step: CondaSetupStep;
  /** Human-readable message describing current action */
  message: string;
  /** Detailed output (e.g., conda command output) */
  detail?: string;
  /** Progress percentage (0-100), if determinable */
  progress?: number;
  /** Timestamp of this progress update */
  timestamp?: string;
}

/**
 * Complete setup result after all steps
 */
export interface CondaSetupResult {
  /** Whether setup completed successfully */
  success: boolean;
  /** Final environment configuration */
  config?: CondaEnvConfig;
  /** Generated activation scripts */
  scripts?: ActivationScripts;
  /** VS Code workspace file path (if generated) */
  vsCodeWorkspace?: string;
  /** Error message if setup failed */
  error?: string;
  /** Step where failure occurred */
  failedStep?: CondaSetupStep;
  /** All progress updates from the setup process */
  progressHistory?: SetupProgress[];
}

// ============================================================================
// Environment Status & Validation
// ============================================================================

/**
 * Status of a Conda environment
 */
export type CondaEnvStatus = 'none' | 'creating' | 'ready' | 'error' | 'broken' | 'outdated';

/**
 * Types of environment validation errors
 */
export type CondaEnvError =
  | 'env_not_found'       // Environment directory doesn't exist
  | 'env_broken'          // Environment exists but is corrupted
  | 'conda_not_found'     // No Conda installation available
  | 'python_missing'      // Python not found in environment
  | 'python_wrong_version'// Python version doesn't match requirements
  | 'deps_missing';       // Dependencies not installed

/**
 * Detailed validation result for an existing environment
 */
export interface CondaEnvValidation {
  /** Whether the environment is valid and usable */
  valid: boolean;
  /** Python version installed in the environment */
  pythonVersion?: string;
  /** Number of packages installed */
  packageCount?: number;
  /** Specific error type if invalid */
  error?: CondaEnvError;
  /** Human-readable error/status message */
  message?: string;
  /** Path to the environment */
  envPath?: string;
  /** Whether pip dependencies are installed */
  depsInstalled?: boolean;
}

// ============================================================================
// Project Structure Detection
// ============================================================================

/**
 * Type of project based on language composition
 */
export type ProjectType = 'pure-python' | 'mixed' | 'monorepo';

/**
 * Detected project structure for determining Python root
 */
export interface ProjectStructure {
  /** Project type based on detected languages */
  type: ProjectType;
  /** Root directory for Python environment setup (.envs, workspace, etc.) */
  pythonRoot: string;
  /** Whether .NET projects were detected */
  hasDotnet: boolean;
  /** Other languages detected in the project */
  hasOtherLanguages: string[];
  /** Detected requirements files */
  requirementsFiles?: string[];
  /** Detected pyproject.toml path */
  pyprojectPath?: string;
}

// ============================================================================
// Activation Scripts
// ============================================================================

/**
 * Generated activation scripts for different shells
 */
export interface ActivationScripts {
  /** Windows CMD batch script path */
  bat: string;
  /** PowerShell script path */
  ps1: string;
  /** Bash/sh script path */
  sh: string;
  /** Path to the Conda installation used */
  condaBase: string;
  /** Path to the environment */
  envPath: string;
}

/**
 * Content of activation scripts (before writing to files)
 */
export interface ActivationScriptContent {
  /** Windows CMD batch script content */
  bat: string;
  /** PowerShell script content */
  ps1: string;
  /** Bash/sh script content */
  sh: string;
}

// ============================================================================
// VS Code Workspace Configuration
// ============================================================================

/**
 * Configuration for generating VS Code workspace file
 */
export interface VsCodeWorkspaceConfig {
  /** Project display name */
  projectName: string;
  /** Python root directory */
  pythonRoot: string;
  /** Path to the Conda environment */
  envPath: string;
  /** Path to Conda installation */
  condaBase: string;
  /** Additional workspace folders to include */
  additionalFolders?: string[];
}

/**
 * Generated VS Code workspace file data
 */
export interface VsCodeWorkspaceFile {
  /** Path where the workspace file was written */
  path: string;
  /** Workspace file content (JSON) */
  content: string;
}

// ============================================================================
// Terminal Activation
// ============================================================================

/**
 * Types of activation errors
 */
export type CondaActivationError =
  | 'env_not_found'
  | 'env_broken'
  | 'conda_not_found'
  | 'activation_failed'
  | 'script_not_found';

/**
 * Result of activating a Conda environment in a terminal
 */
export interface CondaActivationResult {
  /** Whether activation was successful */
  success: boolean;
  /** Error type if activation failed */
  error?: CondaActivationError;
  /** Human-readable message */
  message?: string;
  /** The activation command that was executed */
  command?: string;
}

// ============================================================================
// IPC Request/Response Types
// ============================================================================

/**
 * Request to detect Conda installations
 */
export interface CondaDetectRequest {
  /** Force re-detection even if cached */
  forceRefresh?: boolean;
}

/**
 * Request to create a Conda environment
 */
export interface CondaCreateEnvRequest {
  /** Project path to create environment for */
  projectPath: string;
  /** Optional specific Python version (auto-detected if not provided) */
  pythonVersion?: string;
  /** Optional specific Conda installation to use */
  condaInstallation?: CondaInstallation;
  /** Whether to install dependencies from requirements.txt */
  installDeps?: boolean;
  /** Whether to generate VS Code workspace file */
  generateVsCodeWorkspace?: boolean;
}

/**
 * Request to validate an existing environment
 */
export interface CondaValidateEnvRequest {
  /** Path to the environment to validate */
  envPath: string;
  /** Project path (for version requirement checking) */
  projectPath?: string;
}

/**
 * Request to activate environment in a terminal
 */
export interface CondaActivateRequest {
  /** Terminal ID to activate in */
  terminalId: string;
  /** Path to the environment */
  envPath: string;
  /** Type of shell (auto-detected if not provided) */
  shellType?: 'cmd' | 'powershell' | 'bash' | 'zsh';
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event emitted during environment setup progress
 */
export interface CondaSetupProgressEvent {
  /** Project path being set up */
  projectPath: string;
  /** Current progress state */
  progress: SetupProgress;
}

/**
 * Event emitted when environment status changes
 */
export interface CondaEnvStatusChangeEvent {
  /** Project path */
  projectPath: string;
  /** Environment path */
  envPath: string;
  /** Previous status */
  previousStatus: CondaEnvStatus;
  /** New status */
  newStatus: CondaEnvStatus;
  /** Validation result if available */
  validation?: CondaEnvValidation;
}

/**
 * Computed paths for a project's Conda environment setup
 * Used by UI to display accurate paths based on project structure
 */
export interface CondaProjectPaths {
  /** Project structure type (pure-python, mixed, monorepo) */
  projectType: ProjectType;
  /** The Python root directory (where .envs and workspace file go) */
  pythonRoot: string;
  /** Relative path from project root to Python root (empty for pure-python) */
  pythonRootRelative: string;
  /** Full path to the .envs/projectName directory */
  envPath: string;
  /** Relative path for display (from pythonRoot) */
  envPathRelative: string;
  /** Full path to the workspace file */
  workspacePath: string;
  /** Workspace filename for display */
  workspaceFile: string;
  /** Full path to the scripts directory */
  scriptsPath: string;
  /** Relative path to scripts for display */
  scriptsPathRelative: string;
}
