import { safeStorage } from 'electron';
import type { BedrockConfig } from '../shared/types';

const BEDROCK_SECRET_FIELDS = [
  'awsSecretAccessKey',
  'awsSessionToken',
  'awsBearerTokenBedrock'
] as const;

type BedrockSecretField = typeof BEDROCK_SECRET_FIELDS[number];

const MASKED_VALUE = '••••••••';

/**
 * Encrypt a secret value using Electron's safeStorage.
 * @throws Error if encryption is not available or fails
 */
function encryptValue(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system');
  }
  const encrypted = safeStorage.encryptString(value);
  return 'enc:' + encrypted.toString('base64');
}

/**
 * Decrypt a previously encrypted value.
 * @throws Error if decryption fails
 */
function decryptValue(storedValue: string): string {
  if (!storedValue.startsWith('enc:')) {
    return storedValue;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system');
  }
  const encryptedData = Buffer.from(storedValue.slice(4), 'base64');
  return safeStorage.decryptString(encryptedData);
}

function isEncrypted(value: string): boolean {
  return value.startsWith('enc:');
}

/**
 * Encrypt all secret fields in a BedrockConfig.
 * @throws Error with field context if encryption fails for any field
 */
export function encryptBedrockSecrets(config: BedrockConfig): BedrockConfig {
  const encrypted = { ...config };
  
  for (const field of BEDROCK_SECRET_FIELDS) {
    const value = encrypted[field];
    if (value && !isEncrypted(value)) {
      try {
        encrypted[field] = encryptValue(value);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to encrypt field '${field}': ${message}`);
      }
    }
  }
  
  return encrypted;
}

/**
 * Decrypt all secret fields in a BedrockConfig.
 * @throws Error with field context if decryption fails for any field
 */
export function decryptBedrockSecrets(config: BedrockConfig): BedrockConfig {
  const decrypted = { ...config };
  
  for (const field of BEDROCK_SECRET_FIELDS) {
    const value = decrypted[field];
    if (value && isEncrypted(value)) {
      try {
        decrypted[field] = decryptValue(value);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to decrypt field '${field}': ${message}`);
      }
    }
  }
  
  return decrypted;
}

export function hasEncryptedBedrockSecrets(config: BedrockConfig): boolean {
  for (const field of BEDROCK_SECRET_FIELDS) {
    const value = config[field];
    if (value && isEncrypted(value)) {
      return true;
    }
  }
  return false;
}

export function hasPlaintextBedrockSecrets(config: BedrockConfig): boolean {
  for (const field of BEDROCK_SECRET_FIELDS) {
    const value = config[field];
    if (value && !isEncrypted(value)) {
      return true;
    }
  }
  return false;
}

export function createMaskedBedrockConfig(config: BedrockConfig): BedrockConfig {
  const masked = { ...config };
  
  for (const field of BEDROCK_SECRET_FIELDS) {
    const value = masked[field];
    if (value) {
      masked[field] = MASKED_VALUE;
    }
  }
  
  return masked;
}

export function isBedrockSecretMasked(value: string | undefined): boolean {
  return value === MASKED_VALUE;
}

export { BEDROCK_SECRET_FIELDS, MASKED_VALUE };
