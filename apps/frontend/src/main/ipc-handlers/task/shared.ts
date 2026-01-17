import * as path from 'path';
import type { Task, Project } from '../../../shared/types';
import { projectStore } from '../../project-store';

/**
 * Helper function to find task and project by taskId
 */
export const findTaskAndProject = (taskId: string): { task: Task | undefined; project: Project | undefined } => {
  const projects = projectStore.getProjects();
  let task: Task | undefined;
  let project: Project | undefined;

  for (const p of projects) {
    const tasks = projectStore.getTasks(p.id);
    task = tasks.find((t) => t.id === taskId || t.specId === taskId);
    if (task) {
      project = p;
      break;
    }
  }

  return { task, project };
};

/**
 * Get the spec directory path for a task
 * Uses specsPath if available, otherwise uses project path
 */
export const getSpecDir = (task: Task, project: Project): string => {
  // If task has specsPath set (full path to specs dir), use it directly
  if (task.specsPath) {
    return task.specsPath;
  }
  // Otherwise, construct from project path
  return path.join(project.path, '.auto-claude', 'specs', task.specId);
};
