import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { IPC_CHANNELS } from '../../shared/constants';
import type {
  IPCResult,
  IFlowConfig,
  IFlowSyncStatus,
  IFlowModel,
  Project,
} from '../../shared/types';
import { projectStore } from '../project-store';
import { parseEnvFile, formatEnvFile } from './utils';

/**
 * Register all iFlow-related IPC handlers
 */
export function registerIFlowHandlers(
  _getMainWindow: () => BrowserWindow | null
): void {
  /**
   * Helper to get iFlow config from project env
   */
  const getIFlowConfig = (project: Project): IFlowConfig | null => {
    if (!project.autoBuildPath) return null;
    const envPath = path.join(project.path, project.autoBuildPath, '.env');
    if (!existsSync(envPath)) return null;

    try {
      const content = readFileSync(envPath, 'utf-8');
      const vars = parseEnvFile(content);

      return {
        enabled: vars['IFLOW_ENABLED'] === 'true',
        apiKey: vars['IFLOW_API_KEY'] || undefined,
        baseUrl: vars['IFLOW_BASE_URL'] || 'https://apis.iflow.cn/v1',
        defaultModel: vars['IFLOW_DEFAULT_MODEL'] || 'deepseek-v3',
        // Parse models from JSON if stored
        models: vars['IFLOW_MODELS'] ? JSON.parse(vars['IFLOW_MODELS']) : undefined,
      };
    } catch {
      return null;
    }
  };

  /**
   * Test iFlow API connection
   */
  ipcMain.handle(
    IPC_CHANNELS.IFLOW_TEST_CONNECTION,
    async (_, projectId: string, passedConfig?: IFlowConfig): Promise<IPCResult<IFlowSyncStatus>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      // Use passed config if provided, otherwise read from disk
      const config = passedConfig || getIFlowConfig(project);
      if (!config || !config.apiKey) {
        return {
          success: true,
          data: {
            connected: false,
            error: 'No iFlow API key configured',
          },
        };
      }

      try {
        // Use dynamic import for OpenAI SDK
        const { OpenAI } = await import('openai');

        const client = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseUrl || 'https://apis.iflow.cn/v1',
          timeout: 10000, // 10 second timeout
        });

        // Test with a simple models list request
        const response = await client.models.list();

        return {
          success: true,
          data: {
            connected: true,
            modelCount: response.data?.length || 0,
            lastChecked: new Date().toISOString(),
          },
        };
      } catch (error) {
        return {
          success: true,
          data: {
            connected: false,
            error: error instanceof Error ? error.message : 'Failed to connect to iFlow',
          },
        };
      }
    }
  );

  /**
   * Discover available iFlow models
   */
  ipcMain.handle(
    IPC_CHANNELS.IFLOW_DISCOVER_MODELS,
    async (_, projectId: string, passedConfig?: IFlowConfig): Promise<IPCResult<IFlowModel[]>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      // Use passed config if provided, otherwise read from disk
      const config = passedConfig || getIFlowConfig(project);
      if (!config || !config.apiKey) {
        return { success: false, error: 'No iFlow API key configured' };
      }

      try {
        const { OpenAI } = await import('openai');

        const client = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseUrl || 'https://apis.iflow.cn/v1',
          timeout: 30000, // 30 second timeout for model discovery
        });

        const response = await client.models.list();

        // Transform to IFlowModel format
        const models: IFlowModel[] = response.data.map((model) => ({
          id: model.id,
          name: formatModelName(model.id),
          capabilities: inferCapabilities(model.id),
          addedAt: new Date().toISOString(),
        }));

        return { success: true, data: models };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to discover models',
        };
      }
    }
  );

  /**
   * Save iFlow configuration
   */
  ipcMain.handle(
    IPC_CHANNELS.IFLOW_SAVE_CONFIG,
    async (_, projectId: string, config: IFlowConfig): Promise<IPCResult<void>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      if (!project.autoBuildPath) {
        return { success: false, error: 'Project not initialized' };
      }

      const envPath = path.join(project.path, project.autoBuildPath, '.env');

      try {
        // Read existing env file
        let vars: Record<string, string> = {};
        if (existsSync(envPath)) {
          const content = readFileSync(envPath, 'utf-8');
          vars = parseEnvFile(content);
        }

        // Update iFlow-related variables
        vars['IFLOW_ENABLED'] = config.enabled ? 'true' : 'false';
        if (config.apiKey) {
          vars['IFLOW_API_KEY'] = config.apiKey;
        }
        if (config.baseUrl) {
          vars['IFLOW_BASE_URL'] = config.baseUrl;
        }
        if (config.defaultModel) {
          vars['IFLOW_DEFAULT_MODEL'] = config.defaultModel;
        }
        if (config.models) {
          vars['IFLOW_MODELS'] = JSON.stringify(config.models);
        }

        // Write back to env file
        const newContent = formatEnvFile(vars);
        writeFileSync(envPath, newContent);

        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save configuration',
        };
      }
    }
  );

  /**
   * Get iFlow connection status
   */
  ipcMain.handle(
    IPC_CHANNELS.IFLOW_GET_STATUS,
    async (_, projectId: string): Promise<IPCResult<IFlowSyncStatus>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = getIFlowConfig(project);
      if (!config) {
        return {
          success: true,
          data: {
            connected: false,
            error: 'iFlow not configured',
          },
        };
      }

      if (!config.enabled) {
        return {
          success: true,
          data: {
            connected: false,
            error: 'iFlow is disabled',
          },
        };
      }

      if (!config.apiKey) {
        return {
          success: true,
          data: {
            connected: false,
            error: 'No API key configured',
          },
        };
      }

      // Return cached status (actual test done via IFLOW_TEST_CONNECTION)
      return {
        success: true,
        data: {
          connected: true,
          modelCount: config.models?.length || 0,
        },
      };
    }
  );
}

/**
 * Format model ID to display name
 */
function formatModelName(modelId: string): string {
  // Known model name mappings
  const knownModels: Record<string, string> = {
    'deepseek-v3': 'DeepSeek V3',
    'deepseek-v3.2': 'DeepSeek V3.2',
    'kimi-k2': 'Kimi K2 (Thinking)',
    'qwen3-coder': 'Qwen3 Coder',
    'glm-4.6': 'GLM-4.6',
    'glm-4.7': 'GLM-4.7',
    'tbstars2-200b': 'TBStars2-200B',
    'tstars2.0': 'TStars 2.0',
  };

  if (knownModels[modelId]) {
    return knownModels[modelId];
  }

  // Convert model-id to Model Id
  return modelId
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Infer capabilities from model ID
 */
function inferCapabilities(modelId: string): string[] {
  const id = modelId.toLowerCase();

  if (id.includes('coder') || id.includes('code')) {
    return ['code', 'implementation', 'debugging'];
  }
  if (id.includes('kimi') || id.includes('thinking')) {
    return ['reasoning', 'planning', 'analysis'];
  }
  if (id.includes('glm')) {
    return ['chinese', 'translation', 'general'];
  }
  if (id.includes('deepseek')) {
    return ['general', 'code', 'reasoning'];
  }
  if (id.includes('star') || id.includes('200b')) {
    return ['generation', 'quality', 'creativity'];
  }

  return ['general'];
}
