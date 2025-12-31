import { ipcMain, shell } from 'electron';
import { readdirSync } from 'fs';
import path from 'path';
import { IPC_CHANNELS, DEFAULT_APP_SETTINGS } from '../../shared/constants';
import type { IPCResult, FileNode, SupportedIDE, AppSettings } from '../../shared/types';
import { readSettingsFile } from '../settings-utils';

// Directories to ignore when listing
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '__pycache__', 'dist', 'build',
  '.next', '.nuxt', 'coverage', '.cache', '.venv', 'venv',
  'out', '.turbo', '.worktrees',
  'vendor', 'target', '.gradle', '.maven'
]);

/**
 * Normalize file path for URI usage (convert backslashes to forward slashes)
 */
function normalizePathForUri(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

// IDE URI schemes mapping
const IDE_URI_SCHEMES: Record<SupportedIDE, (filePath: string, line?: number) => string> = {
  vscode: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `vscode://file/${encodeURIComponent(normalized)}${line ? `:${line}` : ''}`;
  },
  vscodium: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `vscodium://file/${encodeURIComponent(normalized)}${line ? `:${line}` : ''}`;
  },
  cursor: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `cursor://file/${encodeURIComponent(normalized)}${line ? `:${line}` : ''}`;
  },
  windsurf: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `windsurf://file/${encodeURIComponent(normalized)}${line ? `:${line}` : ''}`;
  },
  intellij: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `idea://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  pycharm: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `pycharm://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  webstorm: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `webstorm://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  phpstorm: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `phpstorm://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  goland: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `goland://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  rider: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `rider://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  clion: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `clion://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  rubymine: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `rubymine://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  datagrip: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `datagrip://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  androidstudio: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `studio://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  fleet: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `fleet://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  sublime: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `subl://open?url=file://${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  zed: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `zed://file/${encodeURIComponent(normalized)}${line ? `:${line}` : ''}`;
  },
  void: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `void://file/${encodeURIComponent(normalized)}${line ? `:${line}` : ''}`;
  },
  pearai: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `pearai://file/${encodeURIComponent(normalized)}${line ? `:${line}` : ''}`;
  },
  kiro: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `kiro://file/${encodeURIComponent(normalized)}${line ? `:${line}` : ''}`;
  },
  aqua: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `aqua://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  rustrover: (filePath, line) => {
    const normalized = normalizePathForUri(filePath);
    return `rustrover://open?file=${encodeURIComponent(normalized)}${line ? `&line=${line}` : ''}`;
  },
  // Fallback for editors without custom URI schemes - return file:// URL
  visualstudio: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  vim: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  neovim: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  emacs: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  nano: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  micro: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  helix: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  kakoune: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  xcode: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  eclipse: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  netbeans: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  qtcreator: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  codeblocks: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  nova: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  bbedit: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  textmate: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  coteditor: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  notepadpp: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  ultraedit: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  kate: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  gedit: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  geany: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  lapce: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  'lite-xl': (filePath) => `file:///${normalizePathForUri(filePath)}`,
  codespaces: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  gitpod: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  replit: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  codesandbox: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  stackblitz: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  cloud9: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  cloudshell: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  coder: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  glitch: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  codepen: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  jsfiddle: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  colab: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  jupyter: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  dataspell: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  atom: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  brackets: (filePath) => `file:///${normalizePathForUri(filePath)}`,
  custom: (filePath) => `file:///${normalizePathForUri(filePath)}`
};

/**
 * Build editor-specific URI for opening files
 */
function buildEditorUri(ide: SupportedIDE, filePath: string, lineStart?: number): string {
  const uriBuilder = IDE_URI_SCHEMES[ide] || IDE_URI_SCHEMES.vscode;
  return uriBuilder(filePath, lineStart);
}

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
    async (_, params: { filePath: string; lineStart?: number }): Promise<IPCResult<void>> => {
      try {
        const { filePath, lineStart } = params;
        
        // Get preferred IDE from settings (default to VS Code)
        const savedSettings = readSettingsFile();
        const settings = { ...DEFAULT_APP_SETTINGS, ...savedSettings } as AppSettings;
        const preferredIDE = settings.preferredIDE || 'vscode';
        
        // Build editor-specific URL
        const url = buildEditorUri(preferredIDE, filePath, lineStart);
        
        // Open the file in the configured editor
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
