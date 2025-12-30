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

// IDE URI schemes mapping
const IDE_URI_SCHEMES: Record<SupportedIDE, (filePath: string, line?: number) => string> = {
  vscode: (filePath, line) => `vscode://file/${filePath}${line ? `:${line}` : ''}`,
  vscodium: (filePath, line) => `vscodium://file/${filePath}${line ? `:${line}` : ''}`,
  cursor: (filePath, line) => `cursor://file/${filePath}${line ? `:${line}` : ''}`,
  windsurf: (filePath, line) => `windsurf://file/${filePath}${line ? `:${line}` : ''}`,
  intellij: (filePath, line) => `idea://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  pycharm: (filePath, line) => `pycharm://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  webstorm: (filePath, line) => `webstorm://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  phpstorm: (filePath, line) => `phpstorm://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  goland: (filePath, line) => `goland://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  rider: (filePath, line) => `rider://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  clion: (filePath, line) => `clion://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  rubymine: (filePath, line) => `rubymine://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  datagrip: (filePath, line) => `datagrip://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  androidstudio: (filePath, line) => `studio://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  fleet: (filePath, line) => `fleet://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  sublime: (filePath, line) => `subl://open?url=file://${filePath}${line ? `&line=${line}` : ''}`,
  zed: (filePath, line) => `zed://file/${filePath}${line ? `:${line}` : ''}`,
  // Fallback for editors without URI scheme support
  visualstudio: (filePath) => filePath,
  vim: (filePath) => filePath,
  neovim: (filePath) => filePath,
  emacs: (filePath) => filePath,
  nano: (filePath) => filePath,
  micro: (filePath) => filePath,
  helix: (filePath) => filePath,
  kakoune: (filePath) => filePath,
  xcode: (filePath) => filePath,
  eclipse: (filePath) => filePath,
  netbeans: (filePath) => filePath,
  qtcreator: (filePath) => filePath,
  codeblocks: (filePath) => filePath,
  nova: (filePath) => filePath,
  bbedit: (filePath) => filePath,
  textmate: (filePath) => filePath,
  coteditor: (filePath) => filePath,
  notepadpp: (filePath) => filePath,
  ultraedit: (filePath) => filePath,
  kate: (filePath) => filePath,
  gedit: (filePath) => filePath,
  geany: (filePath) => filePath,
  lapce: (filePath) => filePath,
  'lite-xl': (filePath) => filePath,
  codespaces: (filePath) => filePath,
  gitpod: (filePath) => filePath,
  replit: (filePath) => filePath,
  codesandbox: (filePath) => filePath,
  stackblitz: (filePath) => filePath,
  cloud9: (filePath) => filePath,
  cloudshell: (filePath) => filePath,
  coder: (filePath) => filePath,
  glitch: (filePath) => filePath,
  codepen: (filePath) => filePath,
  jsfiddle: (filePath) => filePath,
  colab: (filePath) => filePath,
  jupyter: (filePath) => filePath,
  dataspell: (filePath) => filePath,
  atom: (filePath) => filePath,
  brackets: (filePath) => filePath,
  void: (filePath, line) => `void://file/${filePath}${line ? `:${line}` : ''}`,
  pearai: (filePath, line) => `pearai://file/${filePath}${line ? `:${line}` : ''}`,
  kiro: (filePath, line) => `kiro://file/${filePath}${line ? `:${line}` : ''}`,
  aqua: (filePath, line) => `aqua://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  rustrover: (filePath, line) => `rustrover://open?file=${encodeURIComponent(filePath)}${line ? `&line=${line}` : ''}`,
  custom: (filePath) => filePath
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
    async (_, params: { filePath: string; lineStart?: number; lineEnd?: number }): Promise<IPCResult<void>> => {
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
