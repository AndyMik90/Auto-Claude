/**
 * Ideation Store
 * Zustand store for managing project ideas and suggestions
 * Supports dismiss/archive swipe actions and convert-to-task functionality
 * Uses persist middleware with AsyncStorage for data persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProjectIdea } from '../types';

/**
 * Generates a unique ID for new ideas
 */
const generateId = (): string => {
  return `idea-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Get current timestamp in ISO format
 */
const now = (): string => new Date().toISOString();

/**
 * Mock ideas data - AI-generated and user-submitted ideas
 */
const mockIdeas: ProjectIdea[] = [
  {
    id: 'idea-001',
    title: 'Add voice command support',
    description: 'Allow users to control the app using voice commands for hands-free task management. Could integrate with native speech recognition APIs.',
    type: 'feature',
    status: 'new',
    source: 'ai',
    createdAt: '2025-01-15T10:00:00Z',
    votes: 12,
  },
  {
    id: 'idea-002',
    title: 'Implement task templates',
    description: 'Create reusable task templates for common workflows. Users could save and apply templates to quickly create standardized tasks.',
    type: 'feature',
    status: 'reviewing',
    source: 'ai',
    createdAt: '2025-01-14T14:30:00Z',
    votes: 8,
  },
  {
    id: 'idea-003',
    title: 'Fix slow list rendering',
    description: 'The task list becomes sluggish when there are more than 100 tasks. Consider implementing virtualization or pagination.',
    type: 'bug_fix',
    status: 'accepted',
    source: 'user',
    createdAt: '2025-01-13T09:15:00Z',
    votes: 15,
    linkedTaskId: 'task-005',
  },
  {
    id: 'idea-004',
    title: 'Add task dependencies visualization',
    description: 'Show a visual graph of task dependencies to help understand which tasks block others and identify critical paths.',
    type: 'feature',
    status: 'new',
    source: 'ai',
    createdAt: '2025-01-12T16:45:00Z',
    votes: 6,
  },
  {
    id: 'idea-005',
    title: 'Improve error message clarity',
    description: 'Many error messages are too technical. Rewrite them to be more user-friendly with actionable suggestions.',
    type: 'improvement',
    status: 'reviewing',
    source: 'user',
    createdAt: '2025-01-11T11:20:00Z',
    votes: 9,
  },
  {
    id: 'idea-006',
    title: 'Research AI code review integration',
    description: 'Investigate integrating AI-powered code review suggestions directly into the PR workflow for faster feedback.',
    type: 'research',
    status: 'new',
    source: 'ai',
    createdAt: '2025-01-10T08:00:00Z',
    votes: 7,
  },
  {
    id: 'idea-007',
    title: 'Add keyboard shortcuts overlay',
    description: 'Display an overlay showing available keyboard shortcuts when pressing a modifier key, similar to VS Code.',
    type: 'improvement',
    status: 'new',
    source: 'user',
    createdAt: '2025-01-09T15:30:00Z',
    votes: 4,
  },
  {
    id: 'idea-008',
    title: 'Implement batch task operations',
    description: 'Allow selecting multiple tasks and performing bulk actions like status change, priority update, or deletion.',
    type: 'feature',
    status: 'accepted',
    source: 'ai',
    createdAt: '2025-01-08T12:00:00Z',
    votes: 11,
  },
  {
    id: 'idea-009',
    title: 'Add dark/light theme scheduling',
    description: 'Automatically switch between dark and light themes based on time of day or system settings.',
    type: 'improvement',
    status: 'rejected',
    source: 'user',
    createdAt: '2025-01-07T10:45:00Z',
    votes: 3,
  },
  {
    id: 'idea-010',
    title: 'Explore Linear integration',
    description: 'Research syncing tasks with Linear for teams that use it as their primary project management tool.',
    type: 'research',
    status: 'archived',
    source: 'ai',
    createdAt: '2025-01-06T14:00:00Z',
    votes: 5,
  },
  {
    id: 'idea-011',
    title: 'Add task time tracking',
    description: 'Allow users to track time spent on tasks with start/stop buttons and generate time reports.',
    type: 'feature',
    status: 'new',
    source: 'ai',
    createdAt: '2025-01-05T09:30:00Z',
    votes: 14,
  },
  {
    id: 'idea-012',
    title: 'Fix notification sound not playing',
    description: 'Notifications are silent on some Android devices. Need to investigate notification channel configuration.',
    type: 'bug_fix',
    status: 'new',
    source: 'user',
    createdAt: '2025-01-04T16:00:00Z',
    votes: 2,
  },
];

/**
 * Idea type for grouping
 */
export type IdeaType = ProjectIdea['type'];

/**
 * Idea status for filtering
 */
export type IdeaStatus = ProjectIdea['status'];

/**
 * Idea source for filtering
 */
export type IdeaSource = ProjectIdea['source'];

/**
 * Idea filter options
 */
export interface IdeaFilters {
  type?: IdeaType[];
  status?: IdeaStatus[];
  source?: IdeaSource[];
  search?: string;
}

/**
 * Idea sort options
 */
export interface IdeaSortOptions {
  field: 'createdAt' | 'votes' | 'title';
  direction: 'asc' | 'desc';
}

/**
 * Ideation Store State Interface
 */
interface IdeationState {
  /** All ideas in the store */
  ideas: ProjectIdea[];

  /** Currently selected idea ID */
  selectedIdeaId: string | null;

  /** Active filters */
  filters: IdeaFilters;

  /** Sort options */
  sortOptions: IdeaSortOptions;

  /** Current project ID for filtering */
  projectId: string | null;

  /** Loading state */
  isLoading: boolean;

  /** Error message */
  error: string | null;
}

/**
 * Ideation Store Actions Interface
 */
interface IdeationActions {
  /** Add a new idea */
  addIdea: (idea: Omit<ProjectIdea, 'id' | 'createdAt'>) => ProjectIdea;

  /** Update an existing idea */
  updateIdea: (id: string, updates: Partial<ProjectIdea>) => void;

  /** Delete an idea */
  deleteIdea: (id: string) => void;

  /** Select an idea */
  selectIdea: (id: string | null) => void;

  /** Get an idea by ID */
  getIdeaById: (id: string) => ProjectIdea | undefined;

  /** Dismiss an idea (swipe action) */
  dismissIdea: (id: string) => void;

  /** Archive an idea (swipe action) */
  archiveIdea: (id: string) => void;

  /** Accept an idea for implementation */
  acceptIdea: (id: string) => void;

  /** Reject an idea */
  rejectIdea: (id: string) => void;

  /** Upvote an idea */
  upvoteIdea: (id: string) => void;

  /** Link idea to a task (after convert-to-task) */
  linkToTask: (ideaId: string, taskId: string) => void;

  /** Restore a dismissed/archived idea */
  restoreIdea: (id: string) => void;

  /** Set filters */
  setFilters: (filters: IdeaFilters) => void;

  /** Clear filters */
  clearFilters: () => void;

  /** Set sort options */
  setSortOptions: (options: IdeaSortOptions) => void;

  /** Get filtered and sorted ideas */
  getFilteredIdeas: () => ProjectIdea[];

  /** Get ideas grouped by type */
  getIdeasByType: () => Record<IdeaType, ProjectIdea[]>;

  /** Get ideas by status */
  getIdeasByStatus: () => Record<IdeaStatus, ProjectIdea[]>;

  /** Set project ID */
  setProjectId: (projectId: string | null) => void;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error message */
  setError: (error: string | null) => void;

  /** Reset store to initial state */
  resetStore: () => void;
}

/**
 * Combined Ideation Store Type
 */
type IdeationStore = IdeationState & IdeationActions;

/**
 * Initial state for the store
 */
const initialState: IdeationState = {
  ideas: mockIdeas,
  selectedIdeaId: null,
  filters: {},
  sortOptions: {
    field: 'createdAt',
    direction: 'desc',
  },
  projectId: 'project-001',
  isLoading: false,
  error: null,
};

/**
 * Ideation Store
 * Zustand store with persist middleware for AsyncStorage persistence
 */
export const useIdeationStore = create<IdeationStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      addIdea: (idea: Omit<ProjectIdea, 'id' | 'createdAt'>): ProjectIdea => {
        const newIdea: ProjectIdea = {
          ...idea,
          id: generateId(),
          createdAt: now(),
        };

        set((state) => ({
          ideas: [...state.ideas, newIdea],
        }));

        return newIdea;
      },

      updateIdea: (id: string, updates: Partial<ProjectIdea>): void => {
        set((state) => ({
          ideas: state.ideas.map((idea) =>
            idea.id === id ? { ...idea, ...updates } : idea
          ),
        }));
      },

      deleteIdea: (id: string): void => {
        set((state) => ({
          ideas: state.ideas.filter((idea) => idea.id !== id),
          selectedIdeaId:
            state.selectedIdeaId === id ? null : state.selectedIdeaId,
        }));
      },

      selectIdea: (id: string | null): void => {
        set({ selectedIdeaId: id });
      },

      getIdeaById: (id: string): ProjectIdea | undefined => {
        return get().ideas.find((idea) => idea.id === id);
      },

      dismissIdea: (id: string): void => {
        // Dismiss removes the idea from the list
        get().deleteIdea(id);
      },

      archiveIdea: (id: string): void => {
        set((state) => ({
          ideas: state.ideas.map((idea) =>
            idea.id === id ? { ...idea, status: 'archived' as const } : idea
          ),
        }));
      },

      acceptIdea: (id: string): void => {
        set((state) => ({
          ideas: state.ideas.map((idea) =>
            idea.id === id ? { ...idea, status: 'accepted' as const } : idea
          ),
        }));
      },

      rejectIdea: (id: string): void => {
        set((state) => ({
          ideas: state.ideas.map((idea) =>
            idea.id === id ? { ...idea, status: 'rejected' as const } : idea
          ),
        }));
      },

      upvoteIdea: (id: string): void => {
        set((state) => ({
          ideas: state.ideas.map((idea) =>
            idea.id === id ? { ...idea, votes: (idea.votes || 0) + 1 } : idea
          ),
        }));
      },

      linkToTask: (ideaId: string, taskId: string): void => {
        set((state) => ({
          ideas: state.ideas.map((idea) =>
            idea.id === ideaId
              ? { ...idea, linkedTaskId: taskId, status: 'accepted' as const }
              : idea
          ),
        }));
      },

      restoreIdea: (id: string): void => {
        set((state) => ({
          ideas: state.ideas.map((idea) =>
            idea.id === id ? { ...idea, status: 'new' as const } : idea
          ),
        }));
      },

      setFilters: (filters: IdeaFilters): void => {
        set({ filters });
      },

      clearFilters: (): void => {
        set({ filters: {} });
      },

      setSortOptions: (options: IdeaSortOptions): void => {
        set({ sortOptions: options });
      },

      getFilteredIdeas: (): ProjectIdea[] => {
        const { ideas, filters, sortOptions } = get();

        // Apply filters
        let filteredIdeas = ideas.filter((idea) => {
          // Type filter
          if (filters.type && filters.type.length > 0) {
            if (!filters.type.includes(idea.type)) return false;
          }

          // Status filter
          if (filters.status && filters.status.length > 0) {
            if (!filters.status.includes(idea.status)) return false;
          }

          // Source filter
          if (filters.source && filters.source.length > 0) {
            if (!filters.source.includes(idea.source)) return false;
          }

          // Search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const matchesTitle = idea.title.toLowerCase().includes(searchLower);
            const matchesDescription = idea.description
              .toLowerCase()
              .includes(searchLower);
            if (!matchesTitle && !matchesDescription) {
              return false;
            }
          }

          return true;
        });

        // Apply sorting
        filteredIdeas.sort((a, b) => {
          let comparison = 0;

          switch (sortOptions.field) {
            case 'createdAt':
              comparison =
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              break;
            case 'votes':
              comparison = (a.votes || 0) - (b.votes || 0);
              break;
            case 'title':
              comparison = a.title.localeCompare(b.title);
              break;
          }

          return sortOptions.direction === 'desc' ? -comparison : comparison;
        });

        return filteredIdeas;
      },

      getIdeasByType: (): Record<IdeaType, ProjectIdea[]> => {
        const ideas = get().ideas;
        return {
          feature: ideas.filter((i) => i.type === 'feature'),
          improvement: ideas.filter((i) => i.type === 'improvement'),
          bug_fix: ideas.filter((i) => i.type === 'bug_fix'),
          research: ideas.filter((i) => i.type === 'research'),
          other: ideas.filter((i) => i.type === 'other'),
        };
      },

      getIdeasByStatus: (): Record<IdeaStatus, ProjectIdea[]> => {
        const ideas = get().ideas;
        return {
          new: ideas.filter((i) => i.status === 'new'),
          reviewing: ideas.filter((i) => i.status === 'reviewing'),
          accepted: ideas.filter((i) => i.status === 'accepted'),
          rejected: ideas.filter((i) => i.status === 'rejected'),
          archived: ideas.filter((i) => i.status === 'archived'),
        };
      },

      setProjectId: (projectId: string | null): void => {
        set({ projectId });
      },

      setLoading: (loading: boolean): void => {
        set({ isLoading: loading });
      },

      setError: (error: string | null): void => {
        set({ error });
      },

      resetStore: (): void => {
        set(initialState);
      },
    }),
    {
      name: 'autoclaude-ideation-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        ideas: state.ideas,
        sortOptions: state.sortOptions,
        projectId: state.projectId,
      }),
    }
  )
);

/**
 * Selector hooks for common use cases
 */

/** Get the currently selected idea */
export const useSelectedIdea = (): ProjectIdea | undefined => {
  const { ideas, selectedIdeaId } = useIdeationStore();
  return ideas.find((idea) => idea.id === selectedIdeaId);
};

/** Get idea count by status */
export const useIdeaCounts = (): Record<IdeaStatus, number> => {
  const ideas = useIdeationStore((state) => state.ideas);
  return {
    new: ideas.filter((i) => i.status === 'new').length,
    reviewing: ideas.filter((i) => i.status === 'reviewing').length,
    accepted: ideas.filter((i) => i.status === 'accepted').length,
    rejected: ideas.filter((i) => i.status === 'rejected').length,
    archived: ideas.filter((i) => i.status === 'archived').length,
  };
};

/** Get idea count by type */
export const useIdeaCountsByType = (): Record<IdeaType, number> => {
  const ideas = useIdeationStore((state) => state.ideas);
  return {
    feature: ideas.filter((i) => i.type === 'feature').length,
    improvement: ideas.filter((i) => i.type === 'improvement').length,
    bug_fix: ideas.filter((i) => i.type === 'bug_fix').length,
    research: ideas.filter((i) => i.type === 'research').length,
    other: ideas.filter((i) => i.type === 'other').length,
  };
};

/** Get total idea count (excluding archived) */
export const useActiveIdeaCount = (): number => {
  const ideas = useIdeationStore((state) => state.ideas);
  return ideas.filter((i) => i.status !== 'archived').length;
};

/** Get new ideas (unreviewed) */
export const useNewIdeas = (): ProjectIdea[] => {
  const ideas = useIdeationStore((state) => state.ideas);
  return ideas.filter((i) => i.status === 'new');
};

/** Get AI-generated ideas */
export const useAIIdeas = (): ProjectIdea[] => {
  const ideas = useIdeationStore((state) => state.ideas);
  return ideas.filter((i) => i.source === 'ai');
};
