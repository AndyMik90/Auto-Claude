import { ipcMain } from 'electron';
import { readdirSync, statSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult, FileNode } from '../../shared/types';

// Maximum file size to read (1MB)
const MAX_FILE_SIZE = 1024 * 1024;

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

  ipcMain.handle(
    IPC_CHANNELS.FILE_EXPLORER_READ,
    async (_, filePath: string): Promise<IPCResult<string>> => {
      try {
        // Validate path - must be absolute and normalized
        const normalizedPath = path.normalize(filePath);
        if (!path.isAbsolute(normalizedPath)) {
          return { success: false, error: 'Path must be absolute' };
        }

        // Prevent path traversal by checking for .. after normalization
        if (normalizedPath.includes('..')) {
          return { success: false, error: 'Invalid path' };
        }

        // Check file size before reading
        const stats = statSync(normalizedPath);
        if (stats.size > MAX_FILE_SIZE) {
          return { success: false, error: 'File too large (max 1MB)' };
        }

        // Use async file read to avoid blocking
        const content = await readFile(normalizedPath, 'utf-8');
        return { success: true, data: content };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read file'
        };
      }
    }
  );
}
