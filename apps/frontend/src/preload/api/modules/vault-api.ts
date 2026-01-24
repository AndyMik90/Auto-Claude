/**
 * Vault Integration API operations
 * Provides access to external vault (Obsidian-compatible) for context, learnings, and agents
 */

import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult } from '../../../shared/types';
import type {
  VaultFile,
  VaultContext,
  VaultSearchResult,
  VaultSyncResult,
  VaultConnectionResult,
} from '../../../shared/types/vault';
import { invokeIpc } from './ipc-utils';

/**
 * Vault Integration API interface
 */
export interface VaultAPI {
  /** Test vault connection and validate structure */
  testVaultConnection: (vaultPath: string) => Promise<IPCResult<VaultConnectionResult>>;
  /** List files in vault directory */
  listVaultFiles: (vaultPath: string, subPath?: string) => Promise<IPCResult<VaultFile[]>>;
  /** Read vault file content */
  readVaultFile: (vaultPath: string, filePath: string) => Promise<IPCResult<string>>;
  /** Search vault content */
  searchVault: (vaultPath: string, query: string) => Promise<IPCResult<VaultSearchResult[]>>;
  /** Get vault context (CLAUDE.md, preferences, agents, learnings) */
  getVaultContext: (vaultPath: string) => Promise<IPCResult<VaultContext>>;
  /** Sync learning to vault */
  syncVaultLearning: (vaultPath: string, topic: string, content: string) => Promise<IPCResult<VaultSyncResult>>;
  /** Write file to vault (restricted paths only) */
  writeVaultFile: (vaultPath: string, filePath: string, content: string) => Promise<IPCResult<{ path: string }>>;
}

/**
 * Creates the Vault Integration API implementation
 */
export const createVaultAPI = (): VaultAPI => ({
  testVaultConnection: (vaultPath: string): Promise<IPCResult<VaultConnectionResult>> =>
    invokeIpc(IPC_CHANNELS.VAULT_TEST_CONNECTION, vaultPath),

  listVaultFiles: (vaultPath: string, subPath?: string): Promise<IPCResult<VaultFile[]>> =>
    invokeIpc(IPC_CHANNELS.VAULT_LIST_FILES, vaultPath, subPath),

  readVaultFile: (vaultPath: string, filePath: string): Promise<IPCResult<string>> =>
    invokeIpc(IPC_CHANNELS.VAULT_READ_FILE, vaultPath, filePath),

  searchVault: (vaultPath: string, query: string): Promise<IPCResult<VaultSearchResult[]>> =>
    invokeIpc(IPC_CHANNELS.VAULT_SEARCH, vaultPath, query),

  getVaultContext: (vaultPath: string): Promise<IPCResult<VaultContext>> =>
    invokeIpc(IPC_CHANNELS.VAULT_GET_CONTEXT, vaultPath),

  syncVaultLearning: (vaultPath: string, topic: string, content: string): Promise<IPCResult<VaultSyncResult>> =>
    invokeIpc(IPC_CHANNELS.VAULT_SYNC_LEARNING, vaultPath, topic, content),

  writeVaultFile: (vaultPath: string, filePath: string, content: string): Promise<IPCResult<{ path: string }>> =>
    invokeIpc(IPC_CHANNELS.VAULT_WRITE_FILE, vaultPath, filePath, content),
});
