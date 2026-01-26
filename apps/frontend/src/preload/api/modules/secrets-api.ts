import type { IPCResult } from '../../../shared/types';
import type {
  Secret,
  SecretMetadata,
  CreateSecretInput,
  UpdateSecretInput
} from '../../../shared/types/secrets';
import { invokeIpc } from './ipc-utils';

/**
 * Secrets API operations for secure credential management
 */
export interface SecretsAPI {
  /** Check if encryption is available on this system */
  isEncryptionAvailable: () => Promise<IPCResult<boolean>>;

  /** List all secrets for a project (metadata only, no sensitive data) */
  listSecrets: (projectPath: string) => Promise<IPCResult<SecretMetadata[]>>;

  /** Get a secret by ID (includes decrypted data) */
  getSecret: (projectPath: string, secretId: string) => Promise<IPCResult<Secret | null>>;

  /** Create a new secret */
  createSecret: (projectPath: string, input: CreateSecretInput) => Promise<IPCResult<SecretMetadata>>;

  /** Update an existing secret */
  updateSecret: (
    projectPath: string,
    secretId: string,
    input: UpdateSecretInput
  ) => Promise<IPCResult<SecretMetadata>>;

  /** Delete a secret */
  deleteSecret: (projectPath: string, secretId: string) => Promise<IPCResult<void>>;

  /** Get secrets as environment variables (for launching MCP servers) */
  getSecretsAsEnv: (
    projectPath: string,
    secretIds: string[]
  ) => Promise<IPCResult<Record<string, string>>>;
}

/**
 * Creates the Secrets API implementation
 */
export const createSecretsAPI = (): SecretsAPI => ({
  isEncryptionAvailable: (): Promise<IPCResult<boolean>> =>
    invokeIpc('secrets:encryption-available'),

  listSecrets: (projectPath: string): Promise<IPCResult<SecretMetadata[]>> =>
    invokeIpc('secrets:list', projectPath),

  getSecret: (projectPath: string, secretId: string): Promise<IPCResult<Secret | null>> =>
    invokeIpc('secrets:get', projectPath, secretId),

  createSecret: (
    projectPath: string,
    input: CreateSecretInput
  ): Promise<IPCResult<SecretMetadata>> =>
    invokeIpc('secrets:create', projectPath, input),

  updateSecret: (
    projectPath: string,
    secretId: string,
    input: UpdateSecretInput
  ): Promise<IPCResult<SecretMetadata>> =>
    invokeIpc('secrets:update', projectPath, secretId, input),

  deleteSecret: (projectPath: string, secretId: string): Promise<IPCResult<void>> =>
    invokeIpc('secrets:delete', projectPath, secretId),

  getSecretsAsEnv: (
    projectPath: string,
    secretIds: string[]
  ): Promise<IPCResult<Record<string, string>>> =>
    invokeIpc('secrets:get-as-env', projectPath, secretIds)
});
