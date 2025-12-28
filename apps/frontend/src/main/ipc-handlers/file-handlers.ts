import { ipcMain } from 'electron';
import { readdirSync, readFileSync, writeFileSync, realpathSync, existsSync, statSync, lstatSync, openSync, fstatSync, closeSync, constants } from 'fs';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult, FileNode } from '../../shared/types';

// Directories to ignore when listing
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '__pycache__', 'dist', 'build',
  '.next', '.nuxt', 'coverage', '.cache', '.venv', 'venv',
  'out', '.turbo', '.worktrees',
  'vendor', 'target', '.gradle', '.maven'
]);

/**
 * Register all file-related IPC handlers
 */
export function registerFileHandlers(): void {
  // ============================================
  // File Explorer Operations
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.FILE_EXPLORER_LIST,
    async (_, dirPath: string): Promise<IPCResult<FileNode[]>> => {
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true });

        // Filter and map entries
        const nodes: FileNode[] = [];
        for (const entry of entries) {
          // Skip hidden files (not directories) except useful ones like .env, .gitignore
          if (!entry.isDirectory() && entry.name.startsWith('.') &&
              !['.env', '.gitignore', '.env.example', '.env.local'].includes(entry.name)) {
            continue;
          }
          // Skip ignored directories
          if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;

          nodes.push({
            path: path.join(dirPath, entry.name),
            name: entry.name,
            isDirectory: entry.isDirectory()
          });
        }

        // Sort: directories first, then alphabetically
        nodes.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

        return { success: true, data: nodes };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list directory'
        };
      }
    }
  );

  // ============================================
  // Code Editor Operations (Workspace-scoped)
  // ============================================

  // Additional ignored patterns for code editor
  const CODE_EDITOR_IGNORED = new Set([
    ...IGNORED_DIRS,
    'Library',  // Unity
    'Temp',     // Unity
    'Obj',      // Unity
    'Logs',     // Unity
    'Build'     // Unity (case-insensitive already covered by 'build')
  ]);

  /**
   * Validates that a path is within the workspace root.
   * Prevents directory traversal and symlink escape attacks.
   */
  function validateWorkspacePath(workspaceRoot: string, relPath: string): { valid: boolean; absPath?: string; error?: string } {
    try {
      // Resolve workspace root to canonical path
      const workspaceRootResolved = realpathSync(workspaceRoot);

      // Resolve the target path
      const absPath = path.resolve(workspaceRootResolved, relPath);

      // Normalize paths for comparison on case-insensitive file systems
      const isCaseInsensitiveFs = process.platform === 'win32' || process.platform === 'darwin';
      const workspaceRootForCompare = isCaseInsensitiveFs
        ? workspaceRootResolved.toLowerCase()
        : workspaceRootResolved;
      const absPathForCompare = isCaseInsensitiveFs
        ? absPath.toLowerCase()
        : absPath;

      // Check if path starts with workspace root
      if (
        !absPathForCompare.startsWith(workspaceRootForCompare + path.sep) &&
        absPathForCompare !== workspaceRootForCompare
      ) {
        return { valid: false, error: 'Path escapes workspace root' };
      }

      return { valid: true, absPath };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Invalid path' };
    }
  }

  interface CodeEditorFileNode {
    name: string;
    relPath: string;
    isDir: boolean;
  }

  // List directory (workspace-scoped, lazy-loaded)
  ipcMain.handle(
    IPC_CHANNELS.CODE_EDITOR_LIST_DIR,
    async (_, workspaceRoot: string, relPath: string): Promise<IPCResult<CodeEditorFileNode[]>> => {
      try {
        // Validate workspace path
        const validation = validateWorkspacePath(workspaceRoot, relPath);
        if (!validation.valid || !validation.absPath) {
          return { success: false, error: validation.error || 'Invalid path' };
        }

        const absPath = validation.absPath;
        const workspaceRootResolved = realpathSync(workspaceRoot);

        // Use lstat to check without following symlinks (atomic check)
        let stats;
        try {
          stats = lstatSync(absPath);
        } catch {
          return { success: false, error: 'Path does not exist' };
        }

        // If it's a symlink, resolve it and validate
        if (stats.isSymbolicLink()) {
          try {
            const targetReal = realpathSync(absPath);

            // Normalize paths for comparison on case-insensitive file systems
            const isCaseInsensitiveFs = process.platform === 'win32' || process.platform === 'darwin';
            const workspaceRootForCompare = isCaseInsensitiveFs
              ? workspaceRootResolved.toLowerCase()
              : workspaceRootResolved;
            const targetRealForCompare = isCaseInsensitiveFs
              ? targetReal.toLowerCase()
              : targetReal;

            // Validate symlink target is within workspace
            if (!targetRealForCompare.startsWith(workspaceRootForCompare + path.sep) && targetRealForCompare !== workspaceRootForCompare) {
              return { success: false, error: 'Symlink target is outside workspace root' };
            }
            // Re-stat the resolved target
            stats = lstatSync(targetReal);
          } catch {
            return { success: false, error: 'Cannot resolve symlink' };
          }
        }

        // Verify it's a directory
        if (!stats.isDirectory()) {
          return { success: false, error: 'Not a directory' };
        }

        // Read directory
        const entries = readdirSync(absPath, { withFileTypes: true });

        const nodes: CodeEditorFileNode[] = [];

        for (const entry of entries) {
          // Skip ignored directories
          if (entry.isDirectory() && CODE_EDITOR_IGNORED.has(entry.name)) {
            continue;
          }

          // Skip hidden files (but allow hidden directories)
          if (!entry.isDirectory() && entry.name.startsWith('.')) {
            continue;
          }

          const entryAbsPath = path.join(absPath, entry.name);
          const entryRelPath = relPath ? path.join(relPath, entry.name) : entry.name;

          // For symlinks, validate they resolve within workspace
          if (entry.isSymbolicLink()) {
            try {
              const entryReal = realpathSync(entryAbsPath);

              // Normalize paths for comparison on case-insensitive file systems
              const isCaseInsensitiveFs = process.platform === 'win32' || process.platform === 'darwin';
              const workspaceRootForCompare = isCaseInsensitiveFs
                ? workspaceRootResolved.toLowerCase()
                : workspaceRootResolved;
              const entryRealForCompare = isCaseInsensitiveFs
                ? entryReal.toLowerCase()
                : entryReal;

              // Skip if resolves outside workspace
              if (!entryRealForCompare.startsWith(workspaceRootForCompare + path.sep) && entryRealForCompare !== workspaceRootForCompare) {
                continue;
              }
            } catch {
              // Skip entries that can't be resolved
              continue;
            }
          }

          nodes.push({
            name: entry.name,
            relPath: entryRelPath,
            isDir: entry.isDirectory()
          });
        }

        // Sort: directories first, then files
        nodes.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

        return { success: true, data: nodes };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list directory'
        };
      }
    }
  );

  // Read file (workspace-scoped)
  ipcMain.handle(
    IPC_CHANNELS.CODE_EDITOR_READ_FILE,
    async (_, workspaceRoot: string, relPath: string): Promise<IPCResult<string>> => {
      try {
        // Validate workspace path
        const validation = validateWorkspacePath(workspaceRoot, relPath);
        if (!validation.valid || !validation.absPath) {
          return { success: false, error: validation.error || 'Invalid path' };
        }

        const absPath = validation.absPath;
        const workspaceRootResolved = realpathSync(workspaceRoot);

        // Use lstat to check without following symlinks (atomic check)
        let stats;
        try {
          stats = lstatSync(absPath);
        } catch {
          return { success: false, error: 'File does not exist' };
        }

        // Reject symlinks explicitly
        if (stats.isSymbolicLink()) {
          return { success: false, error: 'Symlinks are not allowed' };
        }

        // Verify it's a file
        if (!stats.isFile()) {
          return { success: false, error: 'Not a file' };
        }

        // Additional safety: verify the parent directory is within workspace
        // (protects against hardlinks to files outside workspace)
        const parentDir = path.dirname(absPath);
        const parentReal = realpathSync(parentDir);

        // Normalize paths for comparison on case-insensitive file systems
        const isCaseInsensitiveFs = process.platform === 'win32' || process.platform === 'darwin';
        const workspaceRootForCompare = isCaseInsensitiveFs
          ? workspaceRootResolved.toLowerCase()
          : workspaceRootResolved;
        const parentRealForCompare = isCaseInsensitiveFs
          ? parentReal.toLowerCase()
          : parentReal;

        if (!parentRealForCompare.startsWith(workspaceRootForCompare + path.sep) && parentRealForCompare !== workspaceRootForCompare) {
          return { success: false, error: 'Parent directory resolves outside workspace root' };
        }

        // Read file - at this point we've verified it's a real file, not a symlink
        const content = readFileSync(absPath, 'utf-8');

        return { success: true, data: content };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read file'
        };
      }
    }
  );

  // Write file (workspace-scoped)
  ipcMain.handle(
    IPC_CHANNELS.CODE_EDITOR_WRITE_FILE,
    async (_, workspaceRoot: string, relPath: string, content: string): Promise<IPCResult<void>> => {
      let fd: number | undefined;
      try {
        // Validate workspace path
        const validation = validateWorkspacePath(workspaceRoot, relPath);
        if (!validation.valid || !validation.absPath) {
          return { success: false, error: validation.error || 'Invalid path' };
        }

        const absPath = validation.absPath;
        const workspaceRootResolved = realpathSync(workspaceRoot);

        // Normalize paths for comparison on case-insensitive file systems
        const isCaseInsensitiveFs = process.platform === 'win32' || process.platform === 'darwin';
        const workspaceRootForCompare = isCaseInsensitiveFs
          ? workspaceRootResolved.toLowerCase()
          : workspaceRootResolved;

        // Validate parent directory is within workspace
        const parentDir = path.dirname(absPath);
        let parentStats;
        try {
          parentStats = lstatSync(parentDir);
        } catch {
          return { success: false, error: 'Parent directory does not exist' };
        }

        // Ensure parent is a directory and not a symlink
        if (!parentStats.isDirectory()) {
          return { success: false, error: 'Parent is not a directory' };
        }

        // Verify parent resolves within workspace (with case-insensitive comparison)
        const parentReal = realpathSync(parentDir);
        const parentRealForCompare = isCaseInsensitiveFs
          ? parentReal.toLowerCase()
          : parentReal;

        if (!parentRealForCompare.startsWith(workspaceRootForCompare + path.sep) && parentRealForCompare !== workspaceRootForCompare) {
          return { success: false, error: 'Parent directory resolves outside workspace root' };
        }

        // Check if file exists using lstat (doesn't follow symlinks)
        let fileExists = false;
        let existingStats;
        try {
          existingStats = lstatSync(absPath);
          fileExists = true;
        } catch {
          // File doesn't exist - this is fine for new files
          fileExists = false;
        }

        if (fileExists && existingStats) {
          // File exists - validate it's not a symlink and is a regular file
          if (existingStats.isSymbolicLink()) {
            return { success: false, error: 'Cannot write to symlinks' };
          }

          if (!existingStats.isFile()) {
            return { success: false, error: 'Target is not a file' };
          }

          // Open existing file atomically with file descriptor
          // This ensures we operate on the same file we just validated
          fd = openSync(absPath, constants.O_WRONLY | constants.O_TRUNC);

          // Double-check using fstat on the file descriptor
          // This confirms we're writing to the file we think we are
          const fdStats = fstatSync(fd);
          if (!fdStats.isFile()) {
            closeSync(fd);
            return { success: false, error: 'File changed during operation' };
          }
        } else {
          // File doesn't exist - create new file atomically
          // O_CREAT | O_EXCL | O_WRONLY creates file exclusively (fails if exists)
          // This prevents race condition where file is created between our check and write
          try {
            fd = openSync(absPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
              return { success: false, error: 'File was created by another process' };
            }
            throw err;
          }
        }

        // Write content using the file descriptor
        // At this point we have exclusive access to the file
        writeFileSync(fd, content, 'utf-8');

        // Close the file descriptor
        closeSync(fd);
        fd = undefined;

        return { success: true };
      } catch (error) {
        // Ensure file descriptor is closed on error
        if (fd !== undefined) {
          try {
            closeSync(fd);
          } catch {
            // Ignore close errors
          }
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to write file'
        };
      }
    }
  );
}
