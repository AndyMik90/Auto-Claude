import { ipcMain, app } from 'electron';
import { readFile, access } from 'fs/promises';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult } from '../../shared/types';

/**
 * Prompt information returned by the list handler
 */
export interface PromptInfo {
  name: string;
  filename: string;
  description: string;
}

/**
 * Context-specific prompt configurations
 * Maps context types to their available prompts
 */
const PROMPT_CONFIGS: Record<string, PromptInfo[]> = {
  roadmap: [
    { name: 'Discovery Agent', filename: 'roadmap_discovery.md', description: 'Discovers project context and existing features' },
    { name: 'Features Agent', filename: 'roadmap_features.md', description: 'Generates and prioritizes feature suggestions' }
  ],
  kanban: [
    { name: 'Planning Agent', filename: 'planner.md', description: 'Creates implementation plans with subtasks' },
    { name: 'Dev Agent', filename: 'coder.md', description: 'Implements individual subtasks' },
    { name: 'Recovery Agent', filename: 'coder_recovery.md', description: 'Recovers from stuck or failed subtasks' },
    { name: 'QA Reviewer', filename: 'qa_reviewer.md', description: 'Validates acceptance criteria' },
    { name: 'QA Fixer', filename: 'qa_fixer.md', description: 'Fixes QA-reported issues' }
  ]
};

/**
 * Valid prompt filenames to prevent directory traversal attacks
 */
const VALID_PROMPT_FILES = new Set(
  Object.values(PROMPT_CONFIGS)
    .flat()
    .map(p => p.filename)
);

/**
 * Gets the path to the prompts directory
 * In development: relative to app root
 * In production: within the packaged app resources
 */
function getPromptsDir(): string {
  // Get the app path (where the electron app is running)
  const appPath = app.getAppPath();

  // Navigate to backend prompts directory
  // In development: apps/frontend -> ../../apps/backend/prompts
  // In production: resources/app -> ../../apps/backend/prompts
  const promptsDir = path.resolve(appPath, '..', 'backend', 'prompts');

  return promptsDir;
}

/**
 * Validates a prompt filename to prevent directory traversal
 */
function validatePromptFilename(filename: string): { valid: true; filename: string } | { valid: false; error: string } {
  // Check against allowlist of valid filenames
  if (!VALID_PROMPT_FILES.has(filename)) {
    return { valid: false, error: `Invalid prompt filename: ${filename}` };
  }

  // Additional safety: ensure no path separators or parent directory references
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return { valid: false, error: 'Invalid prompt filename: contains path separators' };
  }

  return { valid: true, filename };
}

/**
 * Register all prompt-related IPC handlers
 */
export function registerPromptHandlers(): void {
  // ============================================
  // Prompt List Operations
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.PROMPT_GET_LIST,
    async (_, context: string): Promise<IPCResult<PromptInfo[]>> => {
      try {
        // Validate context type
        const validContexts = Object.keys(PROMPT_CONFIGS);
        if (!validContexts.includes(context)) {
          return {
            success: false,
            error: `Invalid context: ${context}. Valid contexts are: ${validContexts.join(', ')}`
          };
        }

        const prompts = PROMPT_CONFIGS[context];
        return { success: true, data: prompts };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get prompt list'
        };
      }
    }
  );

  // ============================================
  // Prompt Read Operations
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.PROMPT_READ,
    async (_, filename: string): Promise<IPCResult<string>> => {
      try {
        // Validate filename against allowlist
        const validation = validatePromptFilename(filename);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }

        const promptsDir = getPromptsDir();
        const promptPath = path.join(promptsDir, validation.filename);

        // Check if file exists before reading
        try {
          await access(promptPath);
        } catch {
          return { success: false, error: `Prompt file not found: ${filename}` };
        }

        // Read the prompt file
        const content = await readFile(promptPath, 'utf-8');
        return { success: true, data: content };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read prompt file'
        };
      }
    }
  );
}
