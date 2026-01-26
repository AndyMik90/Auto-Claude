/**
 * Browser mock for secrets operations
 */

import type {
  Secret,
  SecretMetadata,
  CreateSecretInput,
  UpdateSecretInput
} from '../../../shared/types/secrets';

const mockSecrets: SecretMetadata[] = [];

export const secretsMock = {
  isEncryptionAvailable: () => Promise.resolve({ success: true as const, data: false }),

  listSecrets: (_projectPath: string) =>
    Promise.resolve({ success: true as const, data: mockSecrets }),

  getSecret: (_projectPath: string, _secretId: string) =>
    Promise.resolve({ success: true as const, data: null as Secret | null }),

  createSecret: (_projectPath: string, input: CreateSecretInput) =>
    Promise.resolve({
      success: true as const,
      data: {
        id: `mock-${Date.now()}`,
        name: input.name,
        type: input.type,
        description: input.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as SecretMetadata
    }),

  updateSecret: (_projectPath: string, secretId: string, input: UpdateSecretInput) =>
    Promise.resolve({
      success: true as const,
      data: {
        id: secretId,
        name: input.name || 'Updated Secret',
        type: input.type || 'custom',
        description: input.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as SecretMetadata
    }),

  deleteSecret: (_projectPath: string, _secretId: string) =>
    Promise.resolve({ success: true as const, data: undefined }),

  getSecretsAsEnv: (_projectPath: string, _secretIds: string[]) =>
    Promise.resolve({ success: true as const, data: {} as Record<string, string> })
};
