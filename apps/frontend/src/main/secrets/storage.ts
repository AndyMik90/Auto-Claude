/**
 * Secrets Storage Module
 * Handles reading/writing encrypted secrets to project-level storage
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  Secret,
  SecretMetadata,
  SecretsStore,
  EncryptedSecret,
  CreateSecretInput,
  UpdateSecretInput
} from '../../shared/types/secrets';
import { encryptObject, decryptObject } from './encryption';

const SECRETS_FILE = 'secrets.json';
const SECRETS_VERSION = 1;

/**
 * Get the secrets file path for a project
 */
function getSecretsPath(projectPath: string): string {
  return path.join(projectPath, '.auto-claude', SECRETS_FILE);
}

/**
 * Read the secrets store from disk
 */
function readSecretsStore(projectPath: string): SecretsStore {
  const secretsPath = getSecretsPath(projectPath);

  if (!existsSync(secretsPath)) {
    return { version: SECRETS_VERSION, secrets: [] };
  }

  try {
    const content = readFileSync(secretsPath, 'utf-8');
    const store = JSON.parse(content) as SecretsStore;
    return store;
  } catch (error) {
    console.error('[SecretsStorage] Failed to read secrets store:', error);
    return { version: SECRETS_VERSION, secrets: [] };
  }
}

/**
 * Write the secrets store to disk
 */
function writeSecretsStore(projectPath: string, store: SecretsStore): void {
  const secretsPath = getSecretsPath(projectPath);
  const secretsDir = path.dirname(secretsPath);

  // Ensure .auto-claude directory exists
  if (!existsSync(secretsDir)) {
    mkdirSync(secretsDir, { recursive: true });
  }

  writeFileSync(secretsPath, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * List all secrets (metadata only, no sensitive data)
 */
export function listSecrets(projectPath: string): SecretMetadata[] {
  const store = readSecretsStore(projectPath);

  return store.secrets.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    description: s.description,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt
  }));
}

/**
 * Get a secret by ID (includes decrypted data)
 */
export function getSecret(projectPath: string, secretId: string): Secret | null {
  const store = readSecretsStore(projectPath);
  const encrypted = store.secrets.find((s) => s.id === secretId);

  if (!encrypted) {
    return null;
  }

  try {
    const data = decryptObject<Secret['data']>(encrypted.encryptedData);
    return {
      id: encrypted.id,
      name: encrypted.name,
      type: encrypted.type,
      description: encrypted.description,
      data,
      createdAt: encrypted.createdAt,
      updatedAt: encrypted.updatedAt
    } as Secret;
  } catch (error) {
    console.error('[SecretsStorage] Failed to decrypt secret:', error);
    throw new Error('Failed to decrypt secret');
  }
}

/**
 * Create a new secret
 */
export function createSecret(projectPath: string, input: CreateSecretInput): SecretMetadata {
  const store = readSecretsStore(projectPath);
  const now = new Date().toISOString();

  // Check for duplicate names
  if (store.secrets.some((s) => s.name === input.name)) {
    throw new Error(`Secret with name "${input.name}" already exists`);
  }

  const encrypted: EncryptedSecret = {
    id: uuidv4(),
    name: input.name,
    type: input.type,
    description: input.description,
    encryptedData: encryptObject(input.data),
    createdAt: now,
    updatedAt: now
  };

  store.secrets.push(encrypted);
  writeSecretsStore(projectPath, store);

  return {
    id: encrypted.id,
    name: encrypted.name,
    type: encrypted.type,
    description: encrypted.description,
    createdAt: encrypted.createdAt,
    updatedAt: encrypted.updatedAt
  };
}

/**
 * Update an existing secret
 */
export function updateSecret(
  projectPath: string,
  secretId: string,
  input: UpdateSecretInput
): SecretMetadata {
  const store = readSecretsStore(projectPath);
  const index = store.secrets.findIndex((s) => s.id === secretId);

  if (index === -1) {
    throw new Error('Secret not found');
  }

  const existing = store.secrets[index];
  const now = new Date().toISOString();

  // Check for duplicate names (excluding current secret)
  if (input.name && input.name !== existing.name) {
    if (store.secrets.some((s) => s.name === input.name && s.id !== secretId)) {
      throw new Error(`Secret with name "${input.name}" already exists`);
    }
  }

  // Update fields
  const updated: EncryptedSecret = {
    ...existing,
    name: input.name ?? existing.name,
    type: input.type ?? existing.type,
    description: input.description !== undefined ? input.description : existing.description,
    updatedAt: now
  };

  // If data is provided, re-encrypt it
  if (input.data) {
    updated.encryptedData = encryptObject(input.data);
  }

  store.secrets[index] = updated;
  writeSecretsStore(projectPath, store);

  return {
    id: updated.id,
    name: updated.name,
    type: updated.type,
    description: updated.description,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt
  };
}

/**
 * Delete a secret
 */
export function deleteSecret(projectPath: string, secretId: string): void {
  const store = readSecretsStore(projectPath);
  const index = store.secrets.findIndex((s) => s.id === secretId);

  if (index === -1) {
    throw new Error('Secret not found');
  }

  store.secrets.splice(index, 1);
  writeSecretsStore(projectPath, store);
}

/**
 * Get secrets as environment variables for a list of secret IDs
 * Used when launching MCP servers
 */
export function getSecretsAsEnv(
  projectPath: string,
  secretIds: string[]
): Record<string, string> {
  const env: Record<string, string> = {};

  for (const secretId of secretIds) {
    const secret = getSecret(projectPath, secretId);
    if (!secret) continue;

    // Convert secret data to environment variables based on type
    switch (secret.type) {
      case 'aws':
        env['AWS_ACCESS_KEY_ID'] = secret.data.accessKeyId;
        env['AWS_SECRET_ACCESS_KEY'] = secret.data.secretAccessKey;
        env['AWS_REGION'] = secret.data.region;
        if (secret.data.sessionToken) {
          env['AWS_SESSION_TOKEN'] = secret.data.sessionToken;
        }
        break;

      case 'database':
        // Use common database environment variable names
        env['DB_HOST'] = secret.data.host;
        env['DB_PORT'] = String(secret.data.port);
        env['DB_NAME'] = secret.data.database;
        env['DB_USER'] = secret.data.username;
        env['DB_PASSWORD'] = secret.data.password;
        // Also set specific variable names used by various tools
        env['DATABASE_URL'] = buildDatabaseUrl(secret.data);
        env['PGHOST'] = secret.data.host;
        env['PGPORT'] = String(secret.data.port);
        env['PGDATABASE'] = secret.data.database;
        env['PGUSER'] = secret.data.username;
        env['PGPASSWORD'] = secret.data.password;
        break;

      case 'api_key':
        // Use the secret name (sanitized) as the env var prefix
        const prefix = sanitizeEnvVarName(secret.name);
        if (secret.data.url) {
          env[`${prefix}_URL`] = secret.data.url;
        }
        env[`${prefix}_API_KEY`] = secret.data.key;
        // Also set common names for specific services
        if (secret.name.toLowerCase().includes('redash') && secret.data.url) {
          env['REDASH_URL'] = secret.data.url;
          env['REDASH_API_KEY'] = secret.data.key;
        }
        break;

      case 'ssh':
        // SSH secrets are handled differently - typically written to temp files
        // For now, we just set basic env vars
        env['SSH_HOST'] = secret.data.host;
        env['SSH_USER'] = secret.data.username;
        if (secret.data.port) {
          env['SSH_PORT'] = String(secret.data.port);
        }
        break;

      case 'custom':
        // Custom secrets are directly added as env vars
        for (const [key, value] of Object.entries(secret.data.fields)) {
          env[sanitizeEnvVarName(key)] = value;
        }
        break;
    }
  }

  return env;
}

/**
 * Build a database connection URL
 */
function buildDatabaseUrl(data: {
  engine: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | string;
}): string {
  const protocol = data.engine === 'mongodb' ? 'mongodb' : data.engine;
  const encodedPassword = encodeURIComponent(data.password);
  let url = `${protocol}://${data.username}:${encodedPassword}@${data.host}:${data.port}/${data.database}`;

  if (data.ssl && data.ssl !== 'disable') {
    url += '?sslmode=' + (typeof data.ssl === 'string' ? data.ssl : 'require');
  }

  return url;
}

/**
 * Sanitize a string for use as an environment variable name
 */
function sanitizeEnvVarName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
