import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { getBestAvailableProfileEnv } from '../rate-limit-detector';
import { getAPIProfileEnv } from '../services/profile';
import { getOAuthModeClearVars } from '../agent/env-utils';
import { pythonEnvManager, getConfiguredPythonPath } from '../python-env-manager';
import { getValidatedPythonPath } from '../python-detector';
import { getAugmentedEnv } from '../env-utils';
import { getEffectiveSourcePath } from '../updater/path-resolver';
import { isWindows } from '../platform';
import { getSecretsAsEnv, getSecretsByTypeAsEnv } from '../secrets/storage';

/**
 * Configuration manager for insights service
 * Handles path detection and environment variable loading
 */
export class InsightsConfig {
  // Python path will be configured by pythonEnvManager after venv is ready
  // Use getter to always get current configured path
  private _pythonPath: string | null = null;
  private autoBuildSourcePath: string = '';

  configure(pythonPath?: string, autoBuildSourcePath?: string): void {
    if (pythonPath) {
      this._pythonPath = getValidatedPythonPath(pythonPath, 'InsightsConfig');
    }
    if (autoBuildSourcePath) {
      this.autoBuildSourcePath = autoBuildSourcePath;
    }
  }

  /**
   * Get configured Python path.
   * Returns explicitly configured path, or falls back to getConfiguredPythonPath()
   * which uses the venv Python if ready.
   */
  getPythonPath(): string {
    // If explicitly configured (by pythonEnvManager), use that
    if (this._pythonPath) {
      return this._pythonPath;
    }
    // Otherwise use the global configured path (venv if ready, else bundled/system)
    return getConfiguredPythonPath();
  }

  /**
   * Get the auto-claude source path (detects automatically if not configured)
   * Uses getEffectiveSourcePath() which handles userData override for user-updated backend
   */
  getAutoBuildSourcePath(): string | null {
    if (this.autoBuildSourcePath && existsSync(this.autoBuildSourcePath)) {
      return this.autoBuildSourcePath;
    }

    // Use shared path resolver which handles:
    // 1. User settings (autoBuildPath)
    // 2. userData override (backend-source) for user-updated backend
    // 3. Bundled backend (process.resourcesPath/backend)
    // 4. Development paths
    const effectivePath = getEffectiveSourcePath();
    if (existsSync(effectivePath) && existsSync(path.join(effectivePath, 'runners', 'spec_runner.py'))) {
      return effectivePath;
    }

    return null;
  }

  /**
   * Load environment variables from auto-claude .env file
   */
  loadAutoBuildEnv(): Record<string, string> {
    const autoBuildSource = this.getAutoBuildSourcePath();
    if (!autoBuildSource) return {};

    const envPath = path.join(autoBuildSource, '.env');
    if (!existsSync(envPath)) return {};

    try {
      const envContent = readFileSync(envPath, 'utf-8');
      const envVars: Record<string, string> = {};

      // Handle both Unix (\n) and Windows (\r\n) line endings
      for (const line of envContent.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          let value = trimmed.substring(eqIndex + 1).trim();

          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          envVars[key] = value;
        }
      }

      return envVars;
    } catch {
      return {};
    }
  }

  /**
   * Load secrets environment variables from MCP server configurations
   * Handles both custom MCP servers (via secretIds) and built-in MCP servers (via type)
   */
  loadSecretsEnv(projectPath: string): Record<string, string> {
    if (!projectPath) return {};

    const envPath = path.join(projectPath, '.auto-claude', '.env');
    if (!existsSync(envPath)) return {};

    const env: Record<string, string> = {};
    const vars: Record<string, string> = {};

    try {
      const content = readFileSync(envPath, 'utf-8');
      const lines = content.split(/\r?\n/);

      // First, parse all env vars
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          let value = trimmed.substring(eqIndex + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          vars[key] = value;
        }
      }

      // Handle AWS MCP - auto-inject AWS secrets if enabled
      if (vars['AWS_MCP_ENABLED']?.toLowerCase() === 'true') {
        const awsEnv = getSecretsByTypeAsEnv(projectPath, 'aws');
        if (Object.keys(awsEnv).length > 0) {
          console.log('[Insights] Injecting AWS secrets');
          Object.assign(env, awsEnv);
        }
      }

      // Handle custom MCP servers with secretIds
      if (vars['CUSTOM_MCP_SERVERS']) {
        try {
          const servers = JSON.parse(vars['CUSTOM_MCP_SERVERS']);
          if (Array.isArray(servers)) {
            // Collect all secretIds from MCP servers
            const allSecretIds: string[] = [];
            for (const server of servers) {
              if (server.secretIds && Array.isArray(server.secretIds)) {
                allSecretIds.push(...server.secretIds);
              }
            }

            // Get unique secret IDs and fetch as env vars
            const uniqueSecretIds = [...new Set(allSecretIds)];
            if (uniqueSecretIds.length > 0) {
              console.log('[Insights] Injecting custom MCP secrets:', uniqueSecretIds);
              const secretsEnv = getSecretsAsEnv(projectPath, uniqueSecretIds);
              console.log('[Insights] Secret env vars:', Object.keys(secretsEnv));
              Object.assign(env, secretsEnv);
            }
          }
        } catch {
          // Invalid JSON, ignore
        }
      }
    } catch {
      return {};
    }

    return env;
  }

  /**
   * Get complete environment for process execution
   * Includes system env, auto-claude env, active Claude profile, and project secrets
   * @param projectPath Optional project path for loading project-specific secrets
   */
  async getProcessEnv(projectPath?: string): Promise<Record<string, string>> {
    const autoBuildEnv = this.loadAutoBuildEnv();
    // Get best available Claude profile environment (automatically handles rate limits)
    const profileResult = getBestAvailableProfileEnv();
    const profileEnv = profileResult.env;
    const apiProfileEnv = await getAPIProfileEnv();
    const oauthModeClearVars = getOAuthModeClearVars(apiProfileEnv);
    const pythonEnv = pythonEnvManager.getPythonEnv();
    const autoBuildSource = this.getAutoBuildSourcePath();
    const pythonPathParts = (pythonEnv.PYTHONPATH ?? '')
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => path.resolve(entry));

    if (autoBuildSource) {
      const normalizedAutoBuildSource = path.resolve(autoBuildSource);
      const autoBuildComparator = isWindows()
        ? normalizedAutoBuildSource.toLowerCase()
        : normalizedAutoBuildSource;
      const hasAutoBuildSource = pythonPathParts.some((entry) => {
        const candidate = isWindows() ? entry.toLowerCase() : entry;
        return candidate === autoBuildComparator;
      });

      if (!hasAutoBuildSource) {
        pythonPathParts.push(normalizedAutoBuildSource);
      }
    }

    const combinedPythonPath = pythonPathParts.join(path.delimiter);

    // Use getAugmentedEnv() to ensure common tool paths (claude, dotnet, etc.)
    // are available even when app is launched from Finder/Dock.
    const augmentedEnv = getAugmentedEnv();

    // Load secrets from MCP server configurations
    const secretsEnv = projectPath ? this.loadSecretsEnv(projectPath) : {};

    return {
      ...augmentedEnv,
      ...pythonEnv, // Include PYTHONPATH for bundled site-packages
      ...autoBuildEnv,
      ...oauthModeClearVars,
      ...profileEnv,
      ...apiProfileEnv,
      ...secretsEnv, // Inject decrypted secrets from MCP server configurations
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      ...(combinedPythonPath ? { PYTHONPATH: combinedPythonPath } : {})
    };
  }
}
