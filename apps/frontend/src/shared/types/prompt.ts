/**
 * Shared prompt types used across main, preload, and renderer processes
 */

/**
 * Context type for prompt inspection - determines which prompts are shown
 */
export type PromptContext = 'roadmap' | 'kanban';

/**
 * Prompt information returned by the list handler
 */
export interface PromptInfo {
  name: string;
  filename: string;
  description: string;
}
