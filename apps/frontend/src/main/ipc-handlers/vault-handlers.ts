/**
 * Vault IPC handlers
 * Handles external vault operations (Obsidian-compatible vault integration)
 *
 * Security considerations:
 * - Read operations are allowed for all vault files
 * - Write operations are restricted to specific paths (memory/learnings/, memory/auto-claude/, sessions/)
 * - No delete operations are exposed
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult } from '../../shared/types';
import type {
  VaultFile,
  VaultContext,
  VaultAgent,
  VaultLearning,
  VaultSearchResult,
  VaultSearchMatch,
  VaultSyncResult,
  VaultConnectionResult,
} from '../../shared/types/vault';
import { isVaultWriteAllowed } from '../../shared/types/vault';

// Debug logging helper
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    if (data !== undefined) {
      console.debug(`[Vault] ${message}`, data);
    } else {
      console.debug(`[Vault] ${message}`);
    }
  }
}

/**
 * Expand tilde in path to home directory
 */
function expandPath(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    return path.join(os.homedir(), inputPath.slice(1));
  }
  return inputPath;
}

/**
 * List files in a directory recursively
 */
function listFilesRecursive(dirPath: string, relativePath: string = ''): VaultFile[] {
  const files: VaultFile[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files/directories except .claude
      if (entry.name.startsWith('.') && entry.name !== '.claude') {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.join(relativePath, entry.name);
      const stats = fs.statSync(fullPath);

      const file: VaultFile = {
        name: entry.name,
        path: relPath,
        isDirectory: entry.isDirectory(),
        size: entry.isDirectory() ? null : stats.size,
        modifiedAt: stats.mtime.toISOString(),
      };

      if (entry.isDirectory()) {
        file.children = listFilesRecursive(fullPath, relPath);
      }

      files.push(file);
    }
  } catch (error) {
    debugLog('Error listing files:', error);
  }

  return files;
}

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): Record<string, string> {
  const frontmatter: Record<string, string> = {};

  if (content.startsWith('---')) {
    const endIndex = content.indexOf('---', 3);
    if (endIndex > 3) {
      const yamlContent = content.slice(3, endIndex).trim();
      const lines = yamlContent.split('\n');

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();
          frontmatter[key] = value.replace(/^["']|["']$/g, ''); // Remove quotes
        }
      }
    }
  }

  return frontmatter;
}

/**
 * Search for pattern in file content
 */
function searchInFile(filePath: string, relativePath: string, pattern: string): VaultSearchResult | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches: VaultSearchMatch[] = [];
    const lowerPattern = pattern.toLowerCase();

    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase();
      let searchStart = 0;

      while (true) {
        const matchIndex = lowerLine.indexOf(lowerPattern, searchStart);
        if (matchIndex === -1) break;

        matches.push({
          lineNumber: index + 1,
          line: line.trim(),
          matchStart: matchIndex,
          matchEnd: matchIndex + pattern.length,
        });

        searchStart = matchIndex + 1;
      }
    });

    if (matches.length > 0) {
      const stats = fs.statSync(filePath);
      return {
        file: {
          name: path.basename(filePath),
          path: relativePath,
          isDirectory: false,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        },
        matches,
      };
    }
  } catch (error) {
    // Ignore read errors (binary files, etc.)
  }

  return null;
}

/**
 * Search vault recursively
 */
function searchVaultRecursive(
  dirPath: string,
  relativePath: string,
  pattern: string,
  results: VaultSearchResult[]
): void {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files/directories except .claude
      if (entry.name.startsWith('.') && entry.name !== '.claude') {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        searchVaultRecursive(fullPath, relPath, pattern, results);
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
        const result = searchInFile(fullPath, relPath, pattern);
        if (result) {
          results.push(result);
        }
      }
    }
  } catch (error) {
    debugLog('Error searching vault:', error);
  }
}

/**
 * Test vault connection and structure
 */
export function registerVaultTestConnection(): void {
  ipcMain.handle(
    IPC_CHANNELS.VAULT_TEST_CONNECTION,
    async (_event, vaultPath: string): Promise<IPCResult<VaultConnectionResult>> => {
      debugLog('testVaultConnection handler called', { vaultPath });

      if (!vaultPath) {
        return { success: false, error: 'Vault path is required' };
      }

      try {
        const expandedPath = expandPath(vaultPath);

        // Check if path exists
        if (!fs.existsSync(expandedPath)) {
          return {
            success: false,
            error: `Vault path does not exist: ${expandedPath}`,
          };
        }

        // Check if it's a directory
        const stats = fs.statSync(expandedPath);
        if (!stats.isDirectory()) {
          return {
            success: false,
            error: 'Vault path is not a directory',
          };
        }

        // Check for vault structure
        const hasClaudeMd = fs.existsSync(path.join(expandedPath, '.claude', 'CLAUDE.md'));
        const hasMemoryDir = fs.existsSync(path.join(expandedPath, 'memory'));
        const hasAgentsDir = fs.existsSync(path.join(expandedPath, 'agents'));

        return {
          success: true,
          data: {
            success: true,
            vaultPath: expandedPath,
            hasClaudeMd,
            hasMemoryDir,
            hasAgentsDir,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to test vault connection';
        debugLog('Vault connection test failed:', errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );
}

/**
 * List files in vault directory
 */
export function registerVaultListFiles(): void {
  ipcMain.handle(
    IPC_CHANNELS.VAULT_LIST_FILES,
    async (_event, vaultPath: string, subPath?: string): Promise<IPCResult<VaultFile[]>> => {
      debugLog('listVaultFiles handler called', { vaultPath, subPath });

      if (!vaultPath) {
        return { success: false, error: 'Vault path is required' };
      }

      try {
        const expandedPath = expandPath(vaultPath);
        const targetPath = subPath ? path.join(expandedPath, subPath) : expandedPath;

        if (!fs.existsSync(targetPath)) {
          return { success: false, error: 'Path does not exist' };
        }

        const files = listFilesRecursive(targetPath, subPath || '');
        return { success: true, data: files };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to list vault files';
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Read vault file content
 */
export function registerVaultReadFile(): void {
  ipcMain.handle(
    IPC_CHANNELS.VAULT_READ_FILE,
    async (_event, vaultPath: string, filePath: string): Promise<IPCResult<string>> => {
      debugLog('readVaultFile handler called', { vaultPath, filePath });

      if (!vaultPath || !filePath) {
        return { success: false, error: 'Vault path and file path are required' };
      }

      try {
        const expandedPath = expandPath(vaultPath);
        const fullPath = path.join(expandedPath, filePath);

        // Security: Ensure path is within vault
        const realPath = fs.realpathSync(fullPath);
        const realVaultPath = fs.realpathSync(expandedPath);
        if (!realPath.startsWith(realVaultPath)) {
          return { success: false, error: 'Access denied: path outside vault' };
        }

        if (!fs.existsSync(fullPath)) {
          return { success: false, error: 'File does not exist' };
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        return { success: true, data: content };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to read vault file';
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Search vault content
 */
export function registerVaultSearch(): void {
  ipcMain.handle(
    IPC_CHANNELS.VAULT_SEARCH,
    async (_event, vaultPath: string, query: string): Promise<IPCResult<VaultSearchResult[]>> => {
      debugLog('searchVault handler called', { vaultPath, query });

      if (!vaultPath || !query) {
        return { success: false, error: 'Vault path and query are required' };
      }

      try {
        const expandedPath = expandPath(vaultPath);

        if (!fs.existsSync(expandedPath)) {
          return { success: false, error: 'Vault path does not exist' };
        }

        const results: VaultSearchResult[] = [];
        searchVaultRecursive(expandedPath, '', query, results);

        // Sort by relevance (number of matches)
        results.sort((a, b) => b.matches.length - a.matches.length);

        // Limit results
        return { success: true, data: results.slice(0, 50) };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to search vault';
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Get vault context (CLAUDE.md, preferences, agents, learnings)
 */
export function registerVaultGetContext(): void {
  ipcMain.handle(
    IPC_CHANNELS.VAULT_GET_CONTEXT,
    async (_event, vaultPath: string): Promise<IPCResult<VaultContext>> => {
      debugLog('getVaultContext handler called', { vaultPath });

      if (!vaultPath) {
        return { success: false, error: 'Vault path is required' };
      }

      try {
        const expandedPath = expandPath(vaultPath);

        if (!fs.existsSync(expandedPath)) {
          return { success: false, error: 'Vault path does not exist' };
        }

        // Read CLAUDE.md
        let claudeMd: string | null = null;
        const claudeMdPath = path.join(expandedPath, '.claude', 'CLAUDE.md');
        if (fs.existsSync(claudeMdPath)) {
          claudeMd = fs.readFileSync(claudeMdPath, 'utf-8');
        }

        // Read preferences
        let preferences: string | null = null;
        const prefsPath = path.join(expandedPath, 'memory', 'context', 'preferences.md');
        if (fs.existsSync(prefsPath)) {
          preferences = fs.readFileSync(prefsPath, 'utf-8');
        }

        // Read agents
        const agents: VaultAgent[] = [];
        const agentsDir = path.join(expandedPath, 'agents');
        if (fs.existsSync(agentsDir)) {
          const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
          for (const file of agentFiles) {
            try {
              const agentPath = path.join(agentsDir, file);
              const content = fs.readFileSync(agentPath, 'utf-8');
              const frontmatter = parseFrontmatter(content);
              agents.push({
                id: file.replace('.md', ''),
                name: frontmatter.name || file.replace('.md', ''),
                description: frontmatter.description || null,
                path: path.join('agents', file),
              });
            } catch (e) {
              debugLog('Error reading agent file:', e);
            }
          }
        }

        // Read recent learnings (using try/catch to avoid TOCTOU race condition)
        const recentLearnings: VaultLearning[] = [];
        const learningsDir = path.join(expandedPath, 'memory', 'learnings');
        try {
          const learningFiles = fs.readdirSync(learningsDir)
            .filter(f => f.endsWith('.md'))
            .slice(0, 10); // Limit to 10 most recent

          for (const file of learningFiles) {
            try {
              const learningPath = path.join(learningsDir, file);
              const stats = fs.statSync(learningPath);
              const content = fs.readFileSync(learningPath, 'utf-8');

              // Extract topic from first heading or filename
              let topic = file.replace('.md', '').replace(/-/g, ' ');
              const headingMatch = content.match(/^#\s+(.+)$/m);
              if (headingMatch) {
                topic = headingMatch[1];
              }

              recentLearnings.push({
                id: file.replace('.md', ''),
                topic,
                content,
                modifiedAt: stats.mtime.toISOString(),
                path: path.join('memory', 'learnings', file),
              });
            } catch (e) {
              debugLog('Error reading learning file:', e);
            }
          }

          // Sort by modified date
          recentLearnings.sort((a, b) =>
            new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
          );
        } catch {
          // Directory doesn't exist or can't be read - that's fine, learnings are optional
        }

        return {
          success: true,
          data: {
            claudeMd,
            preferences,
            agents,
            recentLearnings,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to get vault context';
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Sync learning to vault
 */
export function registerVaultSyncLearning(): void {
  ipcMain.handle(
    IPC_CHANNELS.VAULT_SYNC_LEARNING,
    async (
      _event,
      vaultPath: string,
      topic: string,
      content: string
    ): Promise<IPCResult<VaultSyncResult>> => {
      debugLog('syncVaultLearning handler called', { vaultPath, topic });

      if (!vaultPath || !topic || !content) {
        return { success: false, error: 'Vault path, topic, and content are required' };
      }

      try {
        const expandedPath = expandPath(vaultPath);

        if (!fs.existsSync(expandedPath)) {
          return { success: false, error: 'Vault path does not exist' };
        }

        // Create learnings directory if needed
        const learningsDir = path.join(expandedPath, 'memory', 'learnings');
        if (!fs.existsSync(learningsDir)) {
          fs.mkdirSync(learningsDir, { recursive: true });
        }

        // Sanitize topic for filename
        const filename = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md';
        const filePath = path.join(learningsDir, filename);
        const relativePath = path.join('memory', 'learnings', filename);

        // Try to read existing file (avoids TOCTOU race condition)
        let appended = false;
        const timestamp = new Date().toISOString();
        try {
          // Try to read existing content
          const existingContent = fs.readFileSync(filePath, 'utf-8');
          // File exists - append with separator
          const separator = '\n\n---\n\n';
          const newContent = `${existingContent}${separator}## Update (${timestamp})\n\n${content}`;
          fs.writeFileSync(filePath, newContent, 'utf-8');
          appended = true;
        } catch (readError) {
          // File doesn't exist or can't be read - create new file
          const newContent = `# ${topic}\n\n*Created: ${timestamp}*\n\n${content}`;
          fs.writeFileSync(filePath, newContent, 'utf-8');
        }

        return {
          success: true,
          data: {
            success: true,
            path: relativePath,
            appended,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to sync learning';
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Write file to vault (restricted to allowed paths)
 */
export function registerVaultWriteFile(): void {
  ipcMain.handle(
    IPC_CHANNELS.VAULT_WRITE_FILE,
    async (
      _event,
      vaultPath: string,
      filePath: string,
      content: string
    ): Promise<IPCResult<{ path: string }>> => {
      debugLog('writeVaultFile handler called', { vaultPath, filePath });

      if (!vaultPath || !filePath || content === undefined) {
        return { success: false, error: 'Vault path, file path, and content are required' };
      }

      // Security: Check if path is allowed for writes
      if (!isVaultWriteAllowed(filePath)) {
        return {
          success: false,
          error: `Write not allowed to path: ${filePath}. Allowed paths: memory/learnings/, memory/auto-claude/, sessions/`,
        };
      }

      try {
        const expandedPath = expandPath(vaultPath);

        if (!fs.existsSync(expandedPath)) {
          return { success: false, error: 'Vault path does not exist' };
        }

        const fullPath = path.join(expandedPath, filePath);

        // Create parent directory if needed
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        // Write file
        fs.writeFileSync(fullPath, content, 'utf-8');

        return {
          success: true,
          data: { path: filePath },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to write vault file';
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Register all vault handlers
 */
export function registerVaultHandlers(): void {
  debugLog('Registering vault handlers');
  registerVaultTestConnection();
  registerVaultListFiles();
  registerVaultReadFile();
  registerVaultSearch();
  registerVaultGetContext();
  registerVaultSyncLearning();
  registerVaultWriteFile();
  debugLog('Vault handlers registered');
}
