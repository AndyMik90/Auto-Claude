/**
 * Secrets Encryption Module
 * Handles secret encryption/decryption using Electron's safeStorage API (OS keychain)
 */

import { safeStorage } from 'electron';

const ENCRYPTION_PREFIX = 'enc:';

/**
 * Check if encryption is available on this system
 */
export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Encrypt a string using the OS keychain (safeStorage API).
 * Returns base64-encoded encrypted data with 'enc:' prefix.
 * Falls back to plain text if encryption is unavailable (with warning).
 */
export function encryptString(plainText: string): string {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(plainText);
      return ENCRYPTION_PREFIX + encrypted.toString('base64');
    }
  } catch (error) {
    console.warn('[SecretsEncryption] Encryption not available:', error);
  }
  // Return as-is if encryption unavailable (not recommended for production)
  console.warn('[SecretsEncryption] Storing secret without encryption - this is not secure!');
  return plainText;
}

/**
 * Decrypt a string. Handles both encrypted (enc:...) and legacy plain strings.
 */
export function decryptString(encrypted: string): string {
  try {
    if (encrypted.startsWith(ENCRYPTION_PREFIX) && safeStorage.isEncryptionAvailable()) {
      const encryptedData = Buffer.from(encrypted.slice(ENCRYPTION_PREFIX.length), 'base64');
      return safeStorage.decryptString(encryptedData);
    }
  } catch (error) {
    console.error('[SecretsEncryption] Failed to decrypt:', error);
    throw new Error('Failed to decrypt secret. The encryption key may have changed.');
  }
  // Return as-is for unencrypted data
  return encrypted;
}

/**
 * Check if a string is encrypted
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Encrypt an object (serializes to JSON, then encrypts)
 */
export function encryptObject<T>(obj: T): string {
  const json = JSON.stringify(obj);
  return encryptString(json);
}

/**
 * Decrypt an object (decrypts, then parses JSON)
 */
export function decryptObject<T>(encrypted: string): T {
  const json = decryptString(encrypted);
  return JSON.parse(json) as T;
}
