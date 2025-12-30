import { ipcMain, shell } from 'electron';
import { readdirSync } from 'fs';
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
  // Open File in Editor
  // ============================================
  
  ipcMain.handle(
    'open-file',
    async (_, params: { filePath: string; lineStart?: number; lineEnd?: number }): Promise<IPCResult<void>> => {
      try {
        const { filePath, lineStart, lineEnd } = params;
        
        // Build VS Code URL with line numbers if provided
        let url = `vscode://file/${filePath}`;
        if (lineStart) {
          url += `:${lineStart}`;
          if (lineEnd && lineEnd !== lineStart) {
            url += `:${lineEnd}`;
          }
        }
        
        // Open the file in VS Code
        await shell.openExternal(url);
        
        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to open file'
        };
      }
    }
  );
}
