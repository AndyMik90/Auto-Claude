/**
 * IPC Handlers for Secrets Management
 */

import { ipcMain } from 'electron';
import type { IPCResult } from '../../shared/types';
import type {
  Secret,
  SecretMetadata,
  CreateSecretInput,
  UpdateSecretInput
} from '../../shared/types/secrets';
import {
  listSecrets,
  getSecret,
  createSecret,
  updateSecret,
  deleteSecret,
  getSecretsAsEnv
} from '../secrets/storage';
import { isEncryptionAvailable } from '../secrets/encryption';

/**
 * Register all secrets-related IPC handlers
 */
export function registerSecretsHandlers(): void {
  /**
   * Check if encryption is available on this system
   */
  ipcMain.handle(
    'secrets:encryption-available',
    async (): Promise<IPCResult<boolean>> => {
      try {
        return {
          success: true,
          data: isEncryptionAvailable()
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check encryption availability'
        };
      }
    }
  );

  /**
   * List all secrets for a project (metadata only)
   */
  ipcMain.handle(
    'secrets:list',
    async (_event, projectPath: string): Promise<IPCResult<SecretMetadata[]>> => {
      try {
        const secrets = listSecrets(projectPath);
        return {
          success: true,
          data: secrets
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list secrets'
        };
      }
    }
  );

  /**
   * Get a secret by ID (includes decrypted data)
   */
  ipcMain.handle(
    'secrets:get',
    async (_event, projectPath: string, secretId: string): Promise<IPCResult<Secret | null>> => {
      try {
        const secret = getSecret(projectPath, secretId);
        return {
          success: true,
          data: secret
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get secret'
        };
      }
    }
  );

  /**
   * Create a new secret
   */
  ipcMain.handle(
    'secrets:create',
    async (
      _event,
      projectPath: string,
      input: CreateSecretInput
    ): Promise<IPCResult<SecretMetadata>> => {
      try {
        const metadata = createSecret(projectPath, input);
        return {
          success: true,
          data: metadata
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create secret'
        };
      }
    }
  );

  /**
   * Update an existing secret
   */
  ipcMain.handle(
    'secrets:update',
    async (
      _event,
      projectPath: string,
      secretId: string,
      input: UpdateSecretInput
    ): Promise<IPCResult<SecretMetadata>> => {
      try {
        const metadata = updateSecret(projectPath, secretId, input);
        return {
          success: true,
          data: metadata
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update secret'
        };
      }
    }
  );

  /**
   * Delete a secret
   */
  ipcMain.handle(
    'secrets:delete',
    async (_event, projectPath: string, secretId: string): Promise<IPCResult<void>> => {
      try {
        deleteSecret(projectPath, secretId);
        return {
          success: true
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete secret'
        };
      }
    }
  );

  /**
   * Get secrets as environment variables
   * Used internally when launching MCP servers
   */
  ipcMain.handle(
    'secrets:get-as-env',
    async (
      _event,
      projectPath: string,
      secretIds: string[]
    ): Promise<IPCResult<Record<string, string>>> => {
      try {
        const env = getSecretsAsEnv(projectPath, secretIds);
        return {
          success: true,
          data: env
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get secrets as env'
        };
      }
    }
  );
}
