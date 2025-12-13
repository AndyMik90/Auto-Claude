import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Debug logging - only logs when AUTO_CLAUDE_DEBUG env var is set
 */
const DEBUG = process.env.AUTO_CLAUDE_DEBUG === 'true' || process.env.AUTO_CLAUDE_DEBUG === '1';

function debug(message: string, data?: Record<string, unknown>): void {
  if (DEBUG) {
    if (data) {
      console.log(`[ProjectInitializer] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[ProjectInitializer] ${message}`);
    }
  }
}


/**
 * Directories that contain data (not code) - these are NEVER symlinked
 * They are always real directories to store project-specific data
 */
const DATA_DIRECTORIES = [
  'specs',
  'ideation',
  'insights',
  'roadmap'
];


/**
 * Version metadata stored in .auto-claude/.version.json
 */
export interface VersionMetadata {
  version: string;
  sourceHash: string;
  sourcePath: string;
  initializedAt: string;
  updatedAt: string;
}

/**
 * Result of initialization or update operation
 */
export interface InitializationResult {
  success: boolean;
  error?: string;
  version?: string;
  wasUpdate?: boolean;
}

/**
 * Result of version check
 */
export interface VersionCheckResult {
  isInitialized: boolean;
  currentVersion?: string;
  sourceVersion?: string;
  updateAvailable: boolean;
  sourcePath?: string;
}

/**
 * Check if the project has a local auto-claude source directory
 * This indicates it's the auto-claude development project itself
 */
export function hasLocalSource(projectPath: string): boolean {
  const localSourcePath = path.join(projectPath, 'auto-claude');
  const versionFile = path.join(localSourcePath, 'VERSION');
  return existsSync(localSourcePath) && existsSync(versionFile);
}

/**
 * Get the local source path for a project (if it exists)
 */
export function getLocalSourcePath(projectPath: string): string | null {
  const localSourcePath = path.join(projectPath, 'auto-claude');
  if (hasLocalSource(projectPath)) {
    return localSourcePath;
  }
  return null;
}

/**
 * Items to exclude from hash calculation
 */
const HASH_EXCLUDE = ['__pycache__', '.DS_Store', '.pyc', '.env', 'specs', '.git', 'node_modules'];

/**
 * Calculate hash of directory contents for version comparison
 */
function calculateDirectoryHash(dirPath: string): string {
  const hash = crypto.createHash('sha256');

  function shouldExcludeFromHash(name: string): boolean {
    if (HASH_EXCLUDE.includes(name)) return true;
    if (name.endsWith('.pyc')) return true;
    return false;
  }

  function processDirectory(currentPath: string): void {
    if (!existsSync(currentPath)) return;

    const entries = readdirSync(currentPath, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      // Skip excluded items for hash calculation
      if (shouldExcludeFromHash(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        hash.update(`dir:${entry.name}`);
        processDirectory(fullPath);
      } else {
        const content = readFileSync(fullPath);
        hash.update(`file:${entry.name}:${content.length}`);
        hash.update(content);
      }
    }
  }

  processDirectory(dirPath);
  return hash.digest('hex').slice(0, 16); // Use first 16 chars for brevity
}

/**
 * Read version from VERSION file in auto-claude source
 */
function readSourceVersion(sourcePath: string): string {
  const versionFile = path.join(sourcePath, 'VERSION');
  if (existsSync(versionFile)) {
    return readFileSync(versionFile, 'utf-8').trim();
  }
  return '0.0.0';
}

/**
 * Read version metadata from initialized project
 */
function readVersionMetadata(autoBuildPath: string): VersionMetadata | null {
  const metadataPath = path.join(autoBuildPath, '.version.json');
  if (existsSync(metadataPath)) {
    try {
      return JSON.parse(readFileSync(metadataPath, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Write version metadata to initialized project
 */
function writeVersionMetadata(
  autoBuildPath: string,
  metadata: VersionMetadata
): void {
  const metadataPath = path.join(autoBuildPath, '.version.json');
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Check if .env file has been modified from example
 */
export function hasCustomEnv(autoBuildPath: string): boolean {
  const envPath = path.join(autoBuildPath, '.env');
  const envExamplePath = path.join(autoBuildPath, '.env.example');

  if (!existsSync(envPath)) {
    return false;
  }

  if (!existsSync(envExamplePath)) {
    return true; // Has .env but no example to compare
  }

  const envContent = readFileSync(envPath, 'utf-8');
  const exampleContent = readFileSync(envExamplePath, 'utf-8');

  // Simple check: if .env differs from .env.example, it's customized
  return envContent !== exampleContent;
}

/**
 * Check version status for a project
 * If an existing auto-claude folder is found without version metadata,
 * create a retroactive .version.json to enable future update tracking.
 */
export function checkVersion(
  projectPath: string,
  sourcePath: string
): VersionCheckResult {
  debug('checkVersion called', { projectPath, sourcePath });

  // Only .auto-claude counts as "installed" - auto-claude/ is source code
  const dotAutoBuildPath = path.join(projectPath, '.auto-claude');

  let installedPath: string | null = null;
  if (existsSync(dotAutoBuildPath)) {
    installedPath = dotAutoBuildPath;
    debug('Found .auto-claude folder (installed)');
  }

  if (!installedPath) {
    debug('No .auto-claude folder found - not initialized');
    return {
      isInitialized: false,
      updateAvailable: false
    };
  }

  let metadata = readVersionMetadata(installedPath);

  if (!metadata && existsSync(sourcePath)) {
    // Has folder but no version metadata - create retroactive metadata
    // This allows existing projects to participate in the update system
    const sourceVersion = readSourceVersion(sourcePath);
    const installedHash = calculateDirectoryHash(installedPath);
    const now = new Date().toISOString();

    metadata = {
      version: sourceVersion,
      sourceHash: installedHash, // Use installed hash as baseline
      sourcePath,
      initializedAt: now,
      updatedAt: now
    };

    // Write the retroactive metadata
    writeVersionMetadata(installedPath, metadata);
  }

  if (!metadata) {
    // Still no metadata (source doesn't exist) - legacy or manual install
    return {
      isInitialized: true,
      updateAvailable: false, // Can't determine without source
      sourcePath: installedPath
    };
  }

  // Check if source exists
  if (!existsSync(sourcePath)) {
    return {
      isInitialized: true,
      currentVersion: metadata.version,
      updateAvailable: false,
      sourcePath: installedPath
    };
  }

  const sourceVersion = readSourceVersion(sourcePath);
  const sourceHash = calculateDirectoryHash(sourcePath);

  // Only show update available if hash differs AND version is actually different
  // This prevents false positives when versions match but hashes differ due to
  // metadata files or other non-functional differences
  const hashDiffers = metadata.sourceHash !== sourceHash;
  const versionDiffers = metadata.version !== sourceVersion;
  const updateAvailable = hashDiffers && versionDiffers;

  return {
    isInitialized: true,
    currentVersion: metadata.version,
    sourceVersion,
    updateAvailable,
    sourcePath: installedPath
  };
}

/**
 * Initialize auto-claude in a project
 */
export function initializeProject(
  projectPath: string,
  sourcePath: string
): InitializationResult {
  debug('initializeProject called', { projectPath, sourcePath });

  // Validate source exists
  if (!existsSync(sourcePath)) {
    debug('Source path does not exist', { sourcePath });
    return {
      success: false,
      error: `Auto-build source not found at: ${sourcePath}`
    };
  }

  // Validate project path exists
  if (!existsSync(projectPath)) {
    debug('Project path does not exist', { projectPath });
    return {
      success: false,
      error: `Project directory not found: ${projectPath}`
    };
  }

  // Check if already initialized
  const dotAutoBuildPath = path.join(projectPath, '.auto-claude');
  const autoBuildPath = path.join(projectPath, 'auto-claude');

  const dotExists = existsSync(dotAutoBuildPath);
  const sourceExists = existsSync(autoBuildPath);
  debug('Checking existing paths', {
    dotAutoBuildPath,
    dotExists,
    autoBuildPath,
    sourceExists
  });

  // Only .auto-claude counts as "initialized" - auto-claude/ is the source folder
  // This allows initializing the Auto Claude project itself (which has auto-claude/ source)
  if (dotExists) {
    debug('Already initialized - .auto-claude exists');
    return {
      success: false,
      error: 'Project already has auto-claude initialized (.auto-claude exists)'
    };
  }

  try {
    debug('Creating .auto-claude data directory', { dotAutoBuildPath });

    // Create the .auto-claude directory (data only - no code)
    // The framework code runs from the source repo, not from here
    mkdirSync(dotAutoBuildPath, { recursive: true });

    // Create data directories for specs, roadmap, ideation, insights
    for (const dataDir of DATA_DIRECTORIES) {
      const dirPath = path.join(dotAutoBuildPath, dataDir);
      if (!existsSync(dirPath)) {
        debug('Creating data directory', { dataDir, dirPath });
        mkdirSync(dirPath, { recursive: true });
      }
      writeFileSync(path.join(dirPath, '.gitkeep'), '');
    }

    // Write version metadata (tracks which source version this was created with)
    const version = readSourceVersion(sourcePath);
    const sourceHash = calculateDirectoryHash(sourcePath);
    const now = new Date().toISOString();

    debug('Writing version metadata', { version, sourceHash });
    writeVersionMetadata(dotAutoBuildPath, {
      version,
      sourceHash,
      sourcePath,
      initializedAt: now,
      updatedAt: now
    });

    debug('Initialization complete', { version });
    return {
      success: true,
      version,
      wasUpdate: false
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during initialization';
    debug('Initialization failed', { error: errorMessage });
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Update auto-claude version metadata in a project.
 *
 * Since .auto-claude only contains data directories (specs, roadmap, etc.)
 * and the framework runs from the source repo, "update" just refreshes
 * the version metadata to track which source version the project is using.
 */
export function updateProject(
  projectPath: string,
  sourcePath: string
): InitializationResult {
  debug('updateProject called', { projectPath, sourcePath });

  // Validate source exists
  if (!existsSync(sourcePath)) {
    debug('Source path does not exist');
    return {
      success: false,
      error: `Auto-build source not found at: ${sourcePath}`
    };
  }

  // Only .auto-claude is considered an installed instance
  const dotAutoBuildPath = path.join(projectPath, '.auto-claude');

  if (!existsSync(dotAutoBuildPath)) {
    debug('No .auto-claude folder found to update');
    return {
      success: false,
      error: 'No .auto-claude folder found to update. Initialize the project first.'
    };
  }

  debug('Updating .auto-claude version metadata', { dotAutoBuildPath });

  try {
    // Ensure all data directories exist (in case new ones were added)
    for (const dataDir of DATA_DIRECTORIES) {
      const dirPath = path.join(dotAutoBuildPath, dataDir);
      if (!existsSync(dirPath)) {
        debug('Creating missing data directory', { dataDir, dirPath });
        mkdirSync(dirPath, { recursive: true });
        writeFileSync(path.join(dirPath, '.gitkeep'), '');
      }
    }

    // Update version metadata
    const version = readSourceVersion(sourcePath);
    const sourceHash = calculateDirectoryHash(sourcePath);
    const existingMetadata = readVersionMetadata(dotAutoBuildPath);
    const now = new Date().toISOString();

    writeVersionMetadata(dotAutoBuildPath, {
      version,
      sourceHash,
      sourcePath,
      initializedAt: existingMetadata?.initializedAt || now,
      updatedAt: now
    });

    debug('Version metadata updated', { version });
    return {
      success: true,
      version,
      wasUpdate: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during update';
    debug('Update failed', { error: errorMessage });
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Get the auto-claude folder path for a project.
 *
 * IMPORTANT: Only .auto-claude/ is considered a valid "installed" auto-claude.
 * The auto-claude/ folder (if it exists) is the SOURCE CODE being developed,
 * not an installation. This allows Auto Claude to be used to develop itself.
 */
export function getAutoBuildPath(projectPath: string): string | null {
  const dotAutoBuildPath = path.join(projectPath, '.auto-claude');
  const autoBuildPath = path.join(projectPath, 'auto-claude');

  const dotExists = existsSync(dotAutoBuildPath);
  const sourceExists = existsSync(autoBuildPath);

  debug('getAutoBuildPath called', {
    projectPath,
    dotAutoBuildPath,
    dotExists,
    autoBuildPath,
    sourceExists
  });

  // Only .auto-claude counts as an "installed" auto-claude
  // auto-claude/ is the source code folder, not an installation
  if (dotExists) {
    debug('Returning .auto-claude (installed version)');
    return '.auto-claude';
  }

  // Don't return auto-claude/ - that's source code, not an installation
  // The project needs to be initialized to create .auto-claude/
  debug('No .auto-claude folder found - project not initialized');
  return null;
}

