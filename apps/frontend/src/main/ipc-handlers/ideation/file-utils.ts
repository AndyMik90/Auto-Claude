/**
 * File system utilities for ideation operations
 */

import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { AUTO_BUILD_PATHS } from '../../../shared/constants';
import type { Idea } from '../../../shared/types';
import { projectStore } from '../../project-store';
import type { RawIdeationData } from './types';
import { transformIdeaFromSnakeCase } from './transformers';

/**
 * Read ideation data from file
 */
export function readIdeationFile(ideationPath: string): RawIdeationData | null {
  if (!existsSync(ideationPath)) {
    return null;
  }

  try {
    const content = readFileSync(ideationPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to read ideation file'
    );
  }
}

/**
 * Write ideation data to file
 */
export function writeIdeationFile(ideationPath: string, data: RawIdeationData): void {
  try {
    writeFileSync(ideationPath, JSON.stringify(data, null, 2));
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to write ideation file'
    );
  }
}

/**
 * Update timestamp for ideation data
 */
export function updateIdeationTimestamp(data: RawIdeationData): void {
  data.updated_at = new Date().toISOString();
}

/**
 * Load ideas for a specific ideation type from the ideation.json file.
 * Used for streaming updates when an ideation type completes.
 */
export function loadIdeasForType(projectId: string, ideationType: string): Idea[] {
  const project = projectStore.getProject(projectId);
  if (!project) {
    return [];
  }

  const ideationPath = path.join(
    project.path,
    AUTO_BUILD_PATHS.IDEATION_DIR,
    AUTO_BUILD_PATHS.IDEATION_FILE
  );

  const rawIdeation = readIdeationFile(ideationPath);
  if (!rawIdeation?.ideas) {
    return [];
  }

  return rawIdeation.ideas
    .filter((idea) => idea.type === ideationType)
    .map((idea) => transformIdeaFromSnakeCase(idea));
}
