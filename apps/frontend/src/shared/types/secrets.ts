/**
 * Secrets management types for secure credential storage.
 *
 * Secrets are encrypted using Electron's safeStorage API (OS keychain)
 * and stored in a JSON file per project.
 */

/**
 * Types of secrets that can be stored
 */
export type SecretType = 'aws' | 'database' | 'api_key' | 'ssh' | 'custom';

/**
 * Base secret interface
 */
export interface SecretBase {
  /** Unique identifier */
  id: string;
  /** Display name for the secret */
  name: string;
  /** Type of secret */
  type: SecretType;
  /** Optional description */
  description?: string;
  /** When the secret was created */
  createdAt: string;
  /** When the secret was last updated */
  updatedAt: string;
}

/**
 * AWS credentials secret
 */
export interface AWSSecret extends SecretBase {
  type: 'aws';
  data: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    /** Optional session token for temporary credentials */
    sessionToken?: string;
  };
}

/**
 * Database connection secret
 */
export interface DatabaseSecret extends SecretBase {
  type: 'database';
  data: {
    /** Database type: postgres, mysql, redshift, etc. */
    engine: 'postgres' | 'mysql' | 'redshift' | 'sqlite' | 'mongodb';
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    /** SSL mode */
    ssl?: boolean | 'require' | 'prefer' | 'disable';
    /** Additional connection options */
    options?: Record<string, string>;
  };
}

/**
 * API key secret (for services like Redash, Slack, etc.)
 */
export interface APIKeySecret extends SecretBase {
  type: 'api_key';
  data: {
    /** Base URL of the API (optional) */
    url?: string;
    /** The API key */
    key: string;
    /** Optional header name (defaults to Authorization) */
    headerName?: string;
    /** Optional header prefix (e.g., "Bearer ", "Api-Key ") */
    headerPrefix?: string;
  };
}

/**
 * SSH key secret
 */
export interface SSHSecret extends SecretBase {
  type: 'ssh';
  data: {
    host: string;
    port?: number;
    username: string;
    /** Private key content */
    privateKey: string;
    /** Optional passphrase for the private key */
    passphrase?: string;
  };
}

/**
 * Custom secret (key-value pairs)
 */
export interface CustomSecret extends SecretBase {
  type: 'custom';
  data: {
    fields: Record<string, string>;
  };
}

/**
 * Extracted data types for each secret type
 */
export type AWSSecretData = AWSSecret['data'];
export type DatabaseSecretData = DatabaseSecret['data'];
export type APIKeySecretData = APIKeySecret['data'];
export type SSHSecretData = SSHSecret['data'];
export type CustomSecretData = CustomSecret['data'];

/**
 * Union type for all secret types
 */
export type Secret = AWSSecret | DatabaseSecret | APIKeySecret | SSHSecret | CustomSecret;

/**
 * Secret metadata (without sensitive data) for listing
 */
export interface SecretMetadata {
  id: string;
  name: string;
  type: SecretType;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Encrypted secret storage format
 */
export interface EncryptedSecret {
  id: string;
  name: string;
  type: SecretType;
  description?: string;
  /** Encrypted data (base64 encoded) */
  encryptedData: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Secrets store schema (stored in .auto-claude/secrets.json)
 */
export interface SecretsStore {
  /** Schema version for migrations */
  version: number;
  /** Encrypted secrets */
  secrets: EncryptedSecret[];
}

/**
 * Input for creating a new secret
 */
export type CreateSecretInput = Omit<Secret, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Input for updating a secret
 */
export type UpdateSecretInput = Partial<Omit<Secret, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Server type/source (npm package, local path, or GitHub repo) */
  source: string;
  /** Command to run the server */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables (secret references use $SECRET:secret_id format) */
  env?: Record<string, string>;
  /** Secret IDs that this server needs */
  secretIds?: string[];
  /** Whether the server is enabled */
  enabled: boolean;
  /** Optional description */
  description?: string;
}

/**
 * MCP Servers store schema (stored in .auto-claude/mcp-servers.json)
 */
export interface MCPServersStore {
  /** Schema version for migrations */
  version: number;
  /** MCP server configurations */
  servers: MCPServerConfig[];
}

/**
 * Preset MCP server templates
 */
export interface MCPServerPreset {
  /** Preset identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Source package/repo */
  source: string;
  /** Default command */
  command: string;
  /** Default args */
  args?: string[];
  /** Required secret type */
  requiredSecretType?: SecretType;
  /** Required environment variables */
  requiredEnv?: string[];
}
