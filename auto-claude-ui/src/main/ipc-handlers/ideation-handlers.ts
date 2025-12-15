import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS, AUTO_BUILD_PATHS, getSpecsDir } from '../../shared/constants';
import type { IPCResult, IdeationSession, IdeationConfig, IdeationGenerationStatus, IdeationStatus, Task, ImplementationPlan, TaskMetadata, TaskCategory, TaskImpact } from '../../shared/types';
import path from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { projectStore } from '../project-store';
import { fileWatcher } from '../file-watcher';
import { AgentManager } from '../agent';


/**
 * Register all ideation-related IPC handlers
 */
export function registerIdeationHandlers(
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  // ============================================
  // Ideation Operations
  // ============================================

  /**
   * Transform an idea from snake_case (Python backend) to camelCase (TypeScript frontend)
   */
  const transformIdeaFromSnakeCase = (idea: Record<string, unknown>) => {
    const base = {
      id: idea.id as string,
      type: idea.type as string,
      title: idea.title as string,
      description: idea.description as string,
      rationale: idea.rationale as string,
      status: idea.status as string || 'draft',
      createdAt: idea.created_at ? new Date(idea.created_at as string) : new Date()
    };

    if (idea.type === 'code_improvements') {
      return {
        ...base,
        buildsUpon: idea.builds_upon || idea.buildsUpon || [],
        estimatedEffort: idea.estimated_effort || idea.estimatedEffort || 'small',
        affectedFiles: idea.affected_files || idea.affectedFiles || [],
        existingPatterns: idea.existing_patterns || idea.existingPatterns || [],
        implementationApproach: idea.implementation_approach || idea.implementationApproach || ''
      };
    } else if (idea.type === 'ui_ux_improvements') {
      return {
        ...base,
        category: idea.category || 'usability',
        affectedComponents: idea.affected_components || idea.affectedComponents || [],
        screenshots: idea.screenshots || [],
        currentState: idea.current_state || idea.currentState || '',
        proposedChange: idea.proposed_change || idea.proposedChange || '',
        userBenefit: idea.user_benefit || idea.userBenefit || ''
      };
    } else if (idea.type === 'documentation_gaps') {
      return {
        ...base,
        category: idea.category || 'readme',
        targetAudience: idea.target_audience || idea.targetAudience || 'developers',
        affectedAreas: idea.affected_areas || idea.affectedAreas || [],
        currentDocumentation: idea.current_documentation || idea.currentDocumentation || '',
        proposedContent: idea.proposed_content || idea.proposedContent || '',
        priority: idea.priority || 'medium',
        estimatedEffort: idea.estimated_effort || idea.estimatedEffort || 'small'
      };
    } else if (idea.type === 'security_hardening') {
      return {
        ...base,
        category: idea.category || 'configuration',
        severity: idea.severity || 'medium',
        affectedFiles: idea.affected_files || idea.affectedFiles || [],
        vulnerability: idea.vulnerability || '',
        currentRisk: idea.current_risk || idea.currentRisk || '',
        remediation: idea.remediation || '',
        references: idea.references || [],
        compliance: idea.compliance || []
      };
    } else if (idea.type === 'performance_optimizations') {
      return {
        ...base,
        category: idea.category || 'runtime',
        impact: idea.impact || 'medium',
        affectedAreas: idea.affected_areas || idea.affectedAreas || [],
        currentMetric: idea.current_metric || idea.currentMetric || '',
        expectedImprovement: idea.expected_improvement || idea.expectedImprovement || '',
        implementation: idea.implementation || '',
        tradeoffs: idea.tradeoffs || '',
        estimatedEffort: idea.estimated_effort || idea.estimatedEffort || 'medium'
      };
    } else if (idea.type === 'code_quality') {
      return {
        ...base,
        category: idea.category || 'code_smells',
        severity: idea.severity || 'minor',
        affectedFiles: idea.affected_files || idea.affectedFiles || [],
        currentState: idea.current_state || idea.currentState || '',
        proposedChange: idea.proposed_change || idea.proposedChange || '',
        codeExample: idea.code_example || idea.codeExample || '',
        bestPractice: idea.best_practice || idea.bestPractice || '',
        metrics: idea.metrics || {},
        estimatedEffort: idea.estimated_effort || idea.estimatedEffort || 'medium',
        breakingChange: idea.breaking_change ?? idea.breakingChange ?? false,
        prerequisites: idea.prerequisites || []
      };
    }

    return base;
  };

  ipcMain.handle(
    IPC_CHANNELS.IDEATION_GET,
    async (_, projectId: string): Promise<IPCResult<IdeationSession | null>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const ideationPath = path.join(
        project.path,
        AUTO_BUILD_PATHS.IDEATION_DIR,
        AUTO_BUILD_PATHS.IDEATION_FILE
      );

      if (!existsSync(ideationPath)) {
        return { success: true, data: null };
      }

      try {
        const content = readFileSync(ideationPath, 'utf-8');
        const rawIdeation = JSON.parse(content);

        // Transform snake_case to camelCase for frontend
        const session: IdeationSession = {
          id: rawIdeation.id || `ideation-${Date.now()}`,
          projectId,
          config: {
            enabledTypes: rawIdeation.config?.enabled_types || rawIdeation.config?.enabledTypes || [],
            includeRoadmapContext: rawIdeation.config?.include_roadmap_context ?? rawIdeation.config?.includeRoadmapContext ?? true,
            includeKanbanContext: rawIdeation.config?.include_kanban_context ?? rawIdeation.config?.includeKanbanContext ?? true,
            maxIdeasPerType: rawIdeation.config?.max_ideas_per_type || rawIdeation.config?.maxIdeasPerType || 5
          },
          ideas: (rawIdeation.ideas || []).map((idea: Record<string, unknown>) =>
            transformIdeaFromSnakeCase(idea)
          ),
          projectContext: {
            existingFeatures: rawIdeation.project_context?.existing_features || rawIdeation.projectContext?.existingFeatures || [],
            techStack: rawIdeation.project_context?.tech_stack || rawIdeation.projectContext?.techStack || [],
            targetAudience: rawIdeation.project_context?.target_audience || rawIdeation.projectContext?.targetAudience,
            plannedFeatures: rawIdeation.project_context?.planned_features || rawIdeation.projectContext?.plannedFeatures || []
          },
          generatedAt: rawIdeation.generated_at ? new Date(rawIdeation.generated_at) : new Date(),
          updatedAt: rawIdeation.updated_at ? new Date(rawIdeation.updated_at) : new Date()
        };

        return { success: true, data: session };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read ideation'
        };
      }
    }
  );

  ipcMain.on(
    IPC_CHANNELS.IDEATION_GENERATE,
    (_, projectId: string, config: IdeationConfig) => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return;

      const project = projectStore.getProject(projectId);
      if (!project) {
        mainWindow.webContents.send(
          IPC_CHANNELS.IDEATION_ERROR,
          projectId,
          'Project not found'
        );
        return;
      }

      // Start ideation generation via agent manager
      agentManager.startIdeationGeneration(projectId, project.path, config, false);

      // Send initial progress
      mainWindow.webContents.send(
        IPC_CHANNELS.IDEATION_PROGRESS,
        projectId,
        {
          phase: 'analyzing',
          progress: 10,
          message: 'Analyzing project structure...'
        } as IdeationGenerationStatus
      );
    }
  );

  ipcMain.on(
    IPC_CHANNELS.IDEATION_REFRESH,
    (_, projectId: string, config: IdeationConfig) => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return;

      const project = projectStore.getProject(projectId);
      if (!project) {
        mainWindow.webContents.send(
          IPC_CHANNELS.IDEATION_ERROR,
          projectId,
          'Project not found'
        );
        return;
      }

      // Start ideation regeneration with refresh flag
      agentManager.startIdeationGeneration(projectId, project.path, config, true);

      // Send initial progress
      mainWindow.webContents.send(
        IPC_CHANNELS.IDEATION_PROGRESS,
        projectId,
        {
          phase: 'analyzing',
          progress: 10,
          message: 'Refreshing ideation...'
        } as IdeationGenerationStatus
      );
    }
  );

  // Stop ideation generation
  ipcMain.handle(
    IPC_CHANNELS.IDEATION_STOP,
    async (_, projectId: string): Promise<IPCResult> => {
      const mainWindow = getMainWindow();
      const wasStopped = agentManager.stopIdeation(projectId);

      if (wasStopped && mainWindow) {
        mainWindow.webContents.send(IPC_CHANNELS.IDEATION_STOPPED, projectId);
      }

      return { success: wasStopped };
    }
  );

  // Dismiss all ideas
  ipcMain.handle(
    IPC_CHANNELS.IDEATION_DISMISS_ALL,
    async (_, projectId: string): Promise<IPCResult> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const ideationPath = path.join(
        project.path,
        AUTO_BUILD_PATHS.IDEATION_DIR,
        AUTO_BUILD_PATHS.IDEATION_FILE
      );

      if (!existsSync(ideationPath)) {
        return { success: false, error: 'Ideation not found' };
      }

      try {
        const content = readFileSync(ideationPath, 'utf-8');
        const ideation = JSON.parse(content);

        // Dismiss all ideas that are not already dismissed or converted
        let dismissedCount = 0;
        ideation.ideas?.forEach((idea: { status: string }) => {
          if (idea.status !== 'dismissed' && idea.status !== 'converted') {
            idea.status = 'dismissed';
            dismissedCount++;
          }
        });
        ideation.updated_at = new Date().toISOString();

        writeFileSync(ideationPath, JSON.stringify(ideation, null, 2));

        return { success: true, data: { dismissedCount } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to dismiss all ideas'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.IDEATION_UPDATE_IDEA,
    async (
      _,
      projectId: string,
      ideaId: string,
      status: IdeationStatus
    ): Promise<IPCResult> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const ideationPath = path.join(
        project.path,
        AUTO_BUILD_PATHS.IDEATION_DIR,
        AUTO_BUILD_PATHS.IDEATION_FILE
      );

      if (!existsSync(ideationPath)) {
        return { success: false, error: 'Ideation not found' };
      }

      try {
        const content = readFileSync(ideationPath, 'utf-8');
        const ideation = JSON.parse(content);

        // Find and update the idea
        const idea = ideation.ideas?.find((i: { id: string }) => i.id === ideaId);
        if (!idea) {
          return { success: false, error: 'Idea not found' };
        }

        idea.status = status;
        ideation.updated_at = new Date().toISOString();

        writeFileSync(ideationPath, JSON.stringify(ideation, null, 2));

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update idea'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.IDEATION_DISMISS,
    async (_, projectId: string, ideaId: string): Promise<IPCResult> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const ideationPath = path.join(
        project.path,
        AUTO_BUILD_PATHS.IDEATION_DIR,
        AUTO_BUILD_PATHS.IDEATION_FILE
      );

      if (!existsSync(ideationPath)) {
        return { success: false, error: 'Ideation not found' };
      }

      try {
        const content = readFileSync(ideationPath, 'utf-8');
        const ideation = JSON.parse(content);

        // Find and dismiss the idea
        const idea = ideation.ideas?.find((i: { id: string }) => i.id === ideaId);
        if (!idea) {
          return { success: false, error: 'Idea not found' };
        }

        idea.status = 'dismissed';
        ideation.updated_at = new Date().toISOString();

        writeFileSync(ideationPath, JSON.stringify(ideation, null, 2));

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to dismiss idea'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.IDEATION_CONVERT_TO_TASK,
    async (_, projectId: string, ideaId: string): Promise<IPCResult<Task>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const ideationPath = path.join(
        project.path,
        AUTO_BUILD_PATHS.IDEATION_DIR,
        AUTO_BUILD_PATHS.IDEATION_FILE
      );

      if (!existsSync(ideationPath)) {
        return { success: false, error: 'Ideation not found' };
      }

      try {
        const content = readFileSync(ideationPath, 'utf-8');
        const ideation = JSON.parse(content);

        // Find the idea
        const idea = ideation.ideas?.find((i: { id: string }) => i.id === ideaId);
        if (!idea) {
          return { success: false, error: 'Idea not found' };
        }

        // Generate spec ID by finding next available number
        // Get specs directory path
                const specsBaseDir = getSpecsDir(project.autoBuildPath);
        const specsDir = path.join(project.path, specsBaseDir);

        // Ensure specs directory exists
        if (!existsSync(specsDir)) {
          mkdirSync(specsDir, { recursive: true });
        }

        // Find next spec number
        let nextNum = 1;
        try {
          const existingSpecs = readdirSync(specsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => {
              const match = d.name.match(/^(\d+)-/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => n > 0);
          if (existingSpecs.length > 0) {
            nextNum = Math.max(...existingSpecs) + 1;
          }
        } catch {
          // Use default 1
        }

        // Create spec directory name from idea title
        const slugifiedTitle = idea.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 50);
        const specId = `${String(nextNum).padStart(3, '0')}-${slugifiedTitle}`;
        const specDir = path.join(specsDir, specId);

        // Create the spec directory
        mkdirSync(specDir, { recursive: true });

        // Build task description based on idea type
        let taskDescription = `# ${idea.title}\n\n`;
        taskDescription += `${idea.description}\n\n`;
        taskDescription += `## Rationale\n${idea.rationale}\n\n`;

        // Note: high_value_features removed - strategic features belong to Roadmap
        // low_hanging_fruit renamed to code_improvements
        if (idea.type === 'code_improvements') {
          if (idea.builds_upon?.length) {
            taskDescription += `## Builds Upon\n${idea.builds_upon.map((b: string) => `- ${b}`).join('\n')}\n\n`;
          }
          if (idea.implementation_approach) {
            taskDescription += `## Implementation Approach\n${idea.implementation_approach}\n\n`;
          }
          if (idea.affected_files?.length) {
            taskDescription += `## Affected Files\n${idea.affected_files.map((f: string) => `- ${f}`).join('\n')}\n\n`;
          }
          if (idea.existing_patterns?.length) {
            taskDescription += `## Patterns to Follow\n${idea.existing_patterns.map((p: string) => `- ${p}`).join('\n')}\n\n`;
          }
        } else if (idea.type === 'ui_ux_improvements') {
          taskDescription += `## Category\n${idea.category}\n\n`;
          taskDescription += `## Current State\n${idea.current_state}\n\n`;
          taskDescription += `## Proposed Change\n${idea.proposed_change}\n\n`;
          taskDescription += `## User Benefit\n${idea.user_benefit}\n\n`;
          if (idea.affected_components?.length) {
            taskDescription += `## Affected Components\n${idea.affected_components.map((c: string) => `- ${c}`).join('\n')}\n\n`;
          }
        }

        // Create initial implementation_plan.json so task shows in kanban immediately
        const initialPlan: ImplementationPlan = {
          feature: idea.title,
          description: idea.description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'backlog',
          planStatus: 'pending',
          phases: [],
          workflow_type: 'development',
          services_involved: [],
          final_acceptance: [],
          spec_file: 'spec.md'
        };
        writeFileSync(
          path.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN),
          JSON.stringify(initialPlan, null, 2)
        );

        // Create initial spec.md with the task description
        const specContent = `# ${idea.title}

## Overview

${idea.description}

## Rationale

${idea.rationale}

---
*This spec was created from ideation and is pending detailed specification.*
`;
        writeFileSync(path.join(specDir, AUTO_BUILD_PATHS.SPEC_FILE), specContent);

        // Update idea with converted status
        idea.status = 'converted';
        idea.linked_task_id = specId;
        ideation.updated_at = new Date().toISOString();
        writeFileSync(ideationPath, JSON.stringify(ideation, null, 2));

        // Build metadata from idea type
        const metadata: TaskMetadata = {
          sourceType: 'ideation',
          ideationType: idea.type,
          ideaId: idea.id,
          rationale: idea.rationale
        };

        // Map idea type to task category
        // Note: high_value_features removed, low_hanging_fruit renamed to code_improvements
        const ideaTypeToCategory: Record<string, TaskCategory> = {
          'code_improvements': 'feature',
          'ui_ux_improvements': 'ui_ux',
          'documentation_gaps': 'documentation',
          'security_hardening': 'security',
          'performance_optimizations': 'performance',
          'code_quality': 'refactoring'
        };
        metadata.category = ideaTypeToCategory[idea.type] || 'feature';

        // Extract type-specific metadata
        // Note: high_value_features removed - strategic features belong to Roadmap
        // low_hanging_fruit renamed to code_improvements
        if (idea.type === 'code_improvements') {
          metadata.estimatedEffort = idea.estimated_effort;
          metadata.complexity = idea.estimated_effort; // trivial/small/medium/large/complex
          metadata.affectedFiles = idea.affected_files;
        } else if (idea.type === 'ui_ux_improvements') {
          metadata.uiuxCategory = idea.category;
          metadata.affectedFiles = idea.affected_components;
          metadata.problemSolved = idea.current_state;
        } else if (idea.type === 'documentation_gaps') {
          metadata.estimatedEffort = idea.estimated_effort;
          metadata.priority = idea.priority;
          metadata.targetAudience = idea.target_audience;
          metadata.affectedFiles = idea.affected_areas;
        } else if (idea.type === 'security_hardening') {
          metadata.securitySeverity = idea.severity;
          metadata.impact = idea.severity as TaskImpact; // Map severity to impact
          metadata.priority = idea.severity === 'critical' ? 'urgent' : idea.severity === 'high' ? 'high' : 'medium';
          metadata.affectedFiles = idea.affected_files;
        } else if (idea.type === 'performance_optimizations') {
          metadata.performanceCategory = idea.category;
          metadata.impact = idea.impact as TaskImpact;
          metadata.estimatedEffort = idea.estimated_effort;
          metadata.affectedFiles = idea.affected_areas;
        } else if (idea.type === 'code_quality') {
          metadata.codeQualitySeverity = idea.severity;
          metadata.estimatedEffort = idea.estimated_effort;
          metadata.affectedFiles = idea.affected_files;
          metadata.priority = idea.severity === 'critical' ? 'urgent' : idea.severity === 'major' ? 'high' : 'medium';
        }

        // Save metadata to a separate file for persistence
        const metadataPath = path.join(specDir, 'task_metadata.json');
        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        // Task is created in Planning (backlog) - user must manually start it
        // Previously auto-started spec creation here, but user should control when to start

        // Create task object to return
        const task: Task = {
          id: specId,
          specId: specId,
          projectId,
          title: idea.title,
          description: taskDescription,
          status: 'backlog',
          subtasks: [],
          logs: [],
          metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        return { success: true, data: task };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to convert idea to task'
        };
      }
    }
  );

  // ============================================
}
