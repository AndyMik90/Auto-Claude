/**
 * Vault types for Obsidian/External vault integration
 *
 * Provides type definitions for vault file operations, memory sync,
 * and vault configuration.
 */

/**
 * Represents a file or directory in the vault
 */
export interface VaultFile {
  /** File/directory name */
  name: string;
  /** Relative path from vault root */
  path: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** File size in bytes (null for directories) */
  size: number | null;
  /** Last modified timestamp */
  modifiedAt: string;
  /** Children (for directories) */
  children?: VaultFile[];
}

/**
 * Vault context loaded on session start
 */
export interface VaultContext {
  /** Contents of .claude/CLAUDE.md if exists */
  claudeMd: string | null;
  /** Contents of memory/context/preferences.md if exists */
  preferences: string | null;
  /** List of available agent definitions */
  agents: VaultAgent[];
  /** Recent learnings from memory/learnings/ */
  recentLearnings: VaultLearning[];
}

/**
 * Agent definition from vault
 */
export interface VaultAgent {
  /** Agent filename (without .md) */
  id: string;
  /** Agent name from frontmatter or filename */
  name: string;
  /** Agent description from frontmatter */
  description: string | null;
  /** Full path to agent file */
  path: string;
}

/**
 * Learning entry from vault memory
 */
export interface VaultLearning {
  /** Learning ID (derived from filename) */
  id: string;
  /** Topic/title (from filename or first heading) */
  topic: string;
  /** File content */
  content: string;
  /** Last modified timestamp */
  modifiedAt: string;
  /** Full path to learning file */
  path: string;
}

/**
 * Search result from vault
 */
export interface VaultSearchResult {
  /** File info */
  file: VaultFile;
  /** Matching line content */
  matches: VaultSearchMatch[];
}

/**
 * Individual search match
 */
export interface VaultSearchMatch {
  /** Line number (1-indexed) */
  lineNumber: number;
  /** Line content */
  line: string;
  /** Match start position in line */
  matchStart: number;
  /** Match end position in line */
  matchEnd: number;
}

/**
 * Result of syncing a learning to vault
 */
export interface VaultSyncResult {
  success: boolean;
  /** Path where learning was saved */
  path?: string;
  /** Error message if failed */
  error?: string;
  /** Whether file was appended to (vs created new) */
  appended?: boolean;
}

/**
 * Vault connection test result
 */
export interface VaultConnectionResult {
  success: boolean;
  /** Vault root path */
  vaultPath?: string;
  /** Whether CLAUDE.md exists */
  hasClaudeMd?: boolean;
  /** Whether memory directory exists */
  hasMemoryDir?: boolean;
  /** Whether agents directory exists */
  hasAgentsDir?: boolean;
  /** Error message if connection failed */
  error?: string;
}

/**
 * Paths that are allowed for write operations (safety)
 */
export const VAULT_WRITE_ALLOWED_PATHS = [
  'memory/learnings/',
  'memory/auto-claude/',
  'sessions/',
] as const;

/**
 * Check if a path is allowed for write operations
 */
export function isVaultWriteAllowed(relativePath: string): boolean {
  return VAULT_WRITE_ALLOWED_PATHS.some(allowed => relativePath.startsWith(allowed));
}
