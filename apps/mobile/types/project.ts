/**
 * Project Types
 * Defines types for project management
 */

/**
 * Project status
 */
export type ProjectStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

/**
 * Project member role
 */
export type ProjectMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Project member
 */
export interface ProjectMember {
  id: string;
  name: string;
  email?: string;
  role: ProjectMemberRole;
  avatarUrl?: string;
}

/**
 * Project statistics
 */
export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  backlogTasks: number;
  aiReviewTasks: number;
  humanReviewTasks: number;
}

/**
 * Roadmap feature for project roadmap
 */
export interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  targetDate?: string;
  completedDate?: string;
  progress: number; // 0-100
  linkedTaskIds?: string[];
}

/**
 * Project idea from ideation
 */
export interface ProjectIdea {
  id: string;
  title: string;
  description: string;
  type: 'feature' | 'improvement' | 'bug_fix' | 'research' | 'other';
  status: 'new' | 'reviewing' | 'accepted' | 'rejected' | 'archived';
  source: 'ai' | 'user';
  createdAt: string;
  votes?: number;
  linkedTaskId?: string;
}

/**
 * Context file in project context browser
 */
export interface ContextFile {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: ContextFile[];
  size?: number;
  lastModified?: string;
  language?: string;
}

/**
 * Memory entry in project context
 */
export interface ContextMemory {
  id: string;
  key: string;
  value: string;
  category: 'pattern' | 'convention' | 'decision' | 'note';
  createdAt: string;
  updatedAt: string;
}

/**
 * Main Project interface
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  path?: string; // Filesystem path to project
  repositoryUrl?: string;

  // Statistics
  stats?: ProjectStats;

  // Members
  members?: ProjectMember[];

  // Roadmap and ideation
  roadmap?: RoadmapFeature[];
  ideas?: ProjectIdea[];

  // Context
  contextFiles?: ContextFile[];
  contextMemories?: ContextMemory[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;

  // Settings
  settings?: ProjectSettings;
}

/**
 * Project-specific settings
 */
export interface ProjectSettings {
  claudeProfileId?: string;
  autoReviewEnabled?: boolean;
  notificationsEnabled?: boolean;
  branchPrefix?: string;
}

/**
 * Project creation input
 */
export interface ProjectCreateInput {
  name: string;
  description: string;
  path?: string;
  repositoryUrl?: string;
}

/**
 * Project update input
 */
export interface ProjectUpdateInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  repositoryUrl?: string;
  settings?: Partial<ProjectSettings>;
}

/**
 * Project filter options
 */
export interface ProjectFilters {
  status?: ProjectStatus[];
  search?: string;
}

/**
 * Recent project entry for project switcher
 */
export interface RecentProject {
  id: string;
  name: string;
  lastOpenedAt: string;
}
