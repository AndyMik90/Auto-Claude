/**
 * Utility functions for spec creation and management
 */

import path from 'path';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { AUTO_BUILD_PATHS, getSpecsDir } from '../../../shared/constants';
import type { Project, TaskMetadata } from '../../../shared/types';

export interface SpecCreationData {
  specId: string;
  specDir: string;
  taskDescription: string;
  metadata: TaskMetadata;
}

/**
 * Find the next available spec number
 */
function getNextSpecNumber(specsDir: string): number {
  if (!existsSync(specsDir)) {
    return 1;
  }

  const existingDirs = readdirSync(specsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const existingNumbers = existingDirs
    .map(name => {
      const match = name.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);

  if (existingNumbers.length > 0) {
    return Math.max(...existingNumbers) + 1;
  }

  return 1;
}

/**
 * Create a slug from a title
 */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Create a new spec directory and initial files
 */
export function createSpecForIssue(
  project: Project,
  issueNumber: number,
  issueTitle: string,
  taskDescription: string,
  githubUrl: string
): SpecCreationData {
  const specsBaseDir = getSpecsDir(project.autoBuildPath);
  const specsDir = path.join(project.path, specsBaseDir);

  if (!existsSync(specsDir)) {
    mkdirSync(specsDir, { recursive: true });
  }

  // Generate spec ID
  const specNumber = getNextSpecNumber(specsDir);
  const slugifiedTitle = slugifyTitle(issueTitle);
  const specId = `${String(specNumber).padStart(3, '0')}-${slugifiedTitle}`;

  // Create spec directory
  const specDir = path.join(specsDir, specId);
  mkdirSync(specDir, { recursive: true });

  // Create initial files
  const now = new Date().toISOString();

  // implementation_plan.json
  const implementationPlan = {
    feature: issueTitle,
    description: taskDescription,
    created_at: now,
    updated_at: now,
    status: 'pending',
    phases: []
  };
  writeFileSync(
    path.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN),
    JSON.stringify(implementationPlan, null, 2)
  );

  // requirements.json
  const requirements = {
    task_description: taskDescription,
    workflow_type: 'feature'
  };
  writeFileSync(
    path.join(specDir, AUTO_BUILD_PATHS.REQUIREMENTS),
    JSON.stringify(requirements, null, 2)
  );

  // task_metadata.json
  const metadata: TaskMetadata = {
    sourceType: 'github',
    githubIssueNumber: issueNumber,
    githubUrl,
    category: 'feature'
  };
  writeFileSync(
    path.join(specDir, 'task_metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  return {
    specId,
    specDir,
    taskDescription,
    metadata
  };
}

/**
 * Build issue context with comments
 */
export function buildIssueContext(
  issueNumber: number,
  issueTitle: string,
  issueBody: string | undefined,
  labels: string[],
  htmlUrl: string,
  comments: Array<{ body: string; user: { login: string } }>
): string {
  return `
# GitHub Issue #${issueNumber}: ${issueTitle}

${issueBody || 'No description provided.'}

${comments.length > 0 ? `## Comments (${comments.length}):
${comments.map(c => `**${c.user.login}:** ${c.body}`).join('\n\n')}` : ''}

**Labels:** ${labels.join(', ') || 'None'}
**URL:** ${htmlUrl}
`;
}

/**
 * Build investigation task description
 */
export function buildInvestigationTask(
  issueNumber: number,
  issueTitle: string,
  issueContext: string
): string {
  return `Investigate GitHub Issue #${issueNumber}: ${issueTitle}

${issueContext}

Please analyze this issue and provide:
1. A brief summary of what the issue is about
2. A proposed solution approach
3. The files that would likely need to be modified
4. Estimated complexity (simple/standard/complex)
5. Acceptance criteria for resolving this issue`;
}
