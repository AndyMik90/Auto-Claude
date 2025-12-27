/**
 * Context Store
 * Zustand store for managing project context including file tree and memories
 * Uses persist middleware with AsyncStorage for data persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ContextFile, ContextMemory } from '../types';

/**
 * Generates a unique ID
 */
const generateId = (): string => {
  return `ctx-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Get current timestamp in ISO format
 */
const now = (): string => new Date().toISOString();

/**
 * Mock file tree data
 */
const mockFileTree: ContextFile[] = [
  {
    id: 'file-001',
    name: 'apps',
    path: '/apps',
    type: 'directory',
    children: [
      {
        id: 'file-002',
        name: 'mobile',
        path: '/apps/mobile',
        type: 'directory',
        children: [
          {
            id: 'file-003',
            name: 'app',
            path: '/apps/mobile/app',
            type: 'directory',
            children: [
              {
                id: 'file-004',
                name: '_layout.tsx',
                path: '/apps/mobile/app/_layout.tsx',
                type: 'file',
                size: 2048,
                lastModified: '2025-01-16T10:00:00Z',
                language: 'typescript',
              },
              {
                id: 'file-005',
                name: '(tabs)',
                path: '/apps/mobile/app/(tabs)',
                type: 'directory',
                children: [
                  {
                    id: 'file-006',
                    name: 'index.tsx',
                    path: '/apps/mobile/app/(tabs)/index.tsx',
                    type: 'file',
                    size: 3584,
                    lastModified: '2025-01-16T14:30:00Z',
                    language: 'typescript',
                  },
                  {
                    id: 'file-007',
                    name: 'projects.tsx',
                    path: '/apps/mobile/app/(tabs)/projects.tsx',
                    type: 'file',
                    size: 2816,
                    lastModified: '2025-01-15T16:00:00Z',
                    language: 'typescript',
                  },
                  {
                    id: 'file-008',
                    name: 'chat.tsx',
                    path: '/apps/mobile/app/(tabs)/chat.tsx',
                    type: 'file',
                    size: 4096,
                    lastModified: '2025-01-16T11:00:00Z',
                    language: 'typescript',
                  },
                ],
              },
            ],
          },
          {
            id: 'file-009',
            name: 'components',
            path: '/apps/mobile/components',
            type: 'directory',
            children: [
              {
                id: 'file-010',
                name: 'TaskCard.tsx',
                path: '/apps/mobile/components/TaskCard.tsx',
                type: 'file',
                size: 3200,
                lastModified: '2025-01-14T09:00:00Z',
                language: 'typescript',
              },
              {
                id: 'file-011',
                name: 'KanbanBoard.tsx',
                path: '/apps/mobile/components/KanbanBoard.tsx',
                type: 'file',
                size: 5632,
                lastModified: '2025-01-15T12:00:00Z',
                language: 'typescript',
              },
              {
                id: 'file-012',
                name: 'ChatMessage.tsx',
                path: '/apps/mobile/components/ChatMessage.tsx',
                type: 'file',
                size: 2560,
                lastModified: '2025-01-13T15:00:00Z',
                language: 'typescript',
              },
            ],
          },
          {
            id: 'file-013',
            name: 'stores',
            path: '/apps/mobile/stores',
            type: 'directory',
            children: [
              {
                id: 'file-014',
                name: 'taskStore.ts',
                path: '/apps/mobile/stores/taskStore.ts',
                type: 'file',
                size: 4480,
                lastModified: '2025-01-16T08:00:00Z',
                language: 'typescript',
              },
              {
                id: 'file-015',
                name: 'chatStore.ts',
                path: '/apps/mobile/stores/chatStore.ts',
                type: 'file',
                size: 3840,
                lastModified: '2025-01-15T14:00:00Z',
                language: 'typescript',
              },
            ],
          },
          {
            id: 'file-016',
            name: 'package.json',
            path: '/apps/mobile/package.json',
            type: 'file',
            size: 1536,
            lastModified: '2025-01-12T10:00:00Z',
            language: 'json',
          },
        ],
      },
      {
        id: 'file-017',
        name: 'frontend',
        path: '/apps/frontend',
        type: 'directory',
        children: [
          {
            id: 'file-018',
            name: 'src',
            path: '/apps/frontend/src',
            type: 'directory',
            children: [
              {
                id: 'file-019',
                name: 'main.tsx',
                path: '/apps/frontend/src/main.tsx',
                type: 'file',
                size: 512,
                lastModified: '2025-01-10T09:00:00Z',
                language: 'typescript',
              },
              {
                id: 'file-020',
                name: 'App.tsx',
                path: '/apps/frontend/src/App.tsx',
                type: 'file',
                size: 2048,
                lastModified: '2025-01-14T11:00:00Z',
                language: 'typescript',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'file-021',
    name: 'packages',
    path: '/packages',
    type: 'directory',
    children: [
      {
        id: 'file-022',
        name: 'shared',
        path: '/packages/shared',
        type: 'directory',
        children: [
          {
            id: 'file-023',
            name: 'types',
            path: '/packages/shared/types',
            type: 'directory',
            children: [
              {
                id: 'file-024',
                name: 'index.ts',
                path: '/packages/shared/types/index.ts',
                type: 'file',
                size: 768,
                lastModified: '2025-01-08T14:00:00Z',
                language: 'typescript',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'file-025',
    name: 'README.md',
    path: '/README.md',
    type: 'file',
    size: 4096,
    lastModified: '2025-01-11T16:00:00Z',
    language: 'markdown',
  },
  {
    id: 'file-026',
    name: 'package.json',
    path: '/package.json',
    type: 'file',
    size: 2048,
    lastModified: '2025-01-12T10:00:00Z',
    language: 'json',
  },
];

/**
 * Mock memory entries
 */
const mockMemories: ContextMemory[] = [
  {
    id: 'mem-001',
    key: 'architecture-pattern',
    value: 'The mobile app uses Expo Router for file-based navigation with a bottom tab layout containing 5 main screens: Home, Projects, Chat, GitHub, and Settings.',
    category: 'pattern',
    createdAt: '2025-01-10T10:00:00Z',
    updatedAt: '2025-01-15T14:00:00Z',
  },
  {
    id: 'mem-002',
    key: 'state-management',
    value: 'Zustand v5 is used for state management with persist middleware for AsyncStorage persistence. Each domain has its own store (taskStore, projectStore, chatStore, etc.).',
    category: 'pattern',
    createdAt: '2025-01-09T09:00:00Z',
    updatedAt: '2025-01-14T11:00:00Z',
  },
  {
    id: 'mem-003',
    key: 'theme-colors',
    value: 'The app uses a dark theme with primary background #0B0B0F, surface #1a1a2e, and pale yellow accent #E6E7A3. These match the desktop application.',
    category: 'convention',
    createdAt: '2025-01-08T14:00:00Z',
    updatedAt: '2025-01-12T10:00:00Z',
  },
  {
    id: 'mem-004',
    key: 'api-key-storage',
    value: 'API keys must be stored using expo-secure-store, never AsyncStorage. The settingsStore provides saveApiKey/getApiKey methods for secure handling.',
    category: 'decision',
    createdAt: '2025-01-07T11:00:00Z',
    updatedAt: '2025-01-07T11:00:00Z',
  },
  {
    id: 'mem-005',
    key: 'kanban-columns',
    value: 'The Kanban board has 5 columns: Backlog (gray), In Progress (blue), AI Review (purple), Human Review (amber), Done (green). Tasks flow left to right.',
    category: 'convention',
    createdAt: '2025-01-06T16:00:00Z',
    updatedAt: '2025-01-13T09:00:00Z',
  },
  {
    id: 'mem-006',
    key: 'mock-data-phase',
    value: 'Phases 1-5 use mock data hardcoded in stores. API integration is deferred to Phase 6. WebSocket client will connect to backend for real-time updates.',
    category: 'decision',
    createdAt: '2025-01-05T10:00:00Z',
    updatedAt: '2025-01-10T14:00:00Z',
  },
  {
    id: 'mem-007',
    key: 'accessibility',
    value: 'All interactive elements must have accessibilityLabel and accessibilityRole props. Test with VoiceOver (iOS) and TalkBack (Android).',
    category: 'convention',
    createdAt: '2025-01-04T09:00:00Z',
    updatedAt: '2025-01-11T15:00:00Z',
  },
  {
    id: 'mem-008',
    key: 'expo-sdk-version',
    value: 'The app uses Expo SDK 54 with React Native 0.81.5. When installing packages, use npx expo install to get compatible versions.',
    category: 'note',
    createdAt: '2025-01-03T12:00:00Z',
    updatedAt: '2025-01-08T10:00:00Z',
  },
  {
    id: 'mem-009',
    key: 'react-native-paper',
    value: 'React Native Paper v5 is the UI library. Add react-native-paper/babel to babel.config.js for tree-shaking. Icons use react-native-vector-icons.',
    category: 'pattern',
    createdAt: '2025-01-02T14:00:00Z',
    updatedAt: '2025-01-09T11:00:00Z',
  },
  {
    id: 'mem-010',
    key: 'terminal-readonly',
    value: 'Terminal viewer is read-only in v1. No command execution - only output streaming. Full terminal command execution is out of scope.',
    category: 'decision',
    createdAt: '2025-01-01T10:00:00Z',
    updatedAt: '2025-01-01T10:00:00Z',
  },
];

/**
 * Memory category type
 */
export type MemoryCategory = ContextMemory['category'];

/**
 * Context filter options
 */
export interface ContextFilters {
  search?: string;
  memoryCategory?: MemoryCategory[];
  fileType?: ('file' | 'directory')[];
  language?: string[];
}

/**
 * Context Store State Interface
 */
interface ContextState {
  /** File tree */
  fileTree: ContextFile[];

  /** Memory entries */
  memories: ContextMemory[];

  /** Expanded directory IDs */
  expandedDirs: Set<string>;

  /** Currently selected file/memory ID */
  selectedId: string | null;

  /** Selected type ('file' or 'memory') */
  selectedType: 'file' | 'memory' | null;

  /** Active filters */
  filters: ContextFilters;

  /** Current project ID */
  projectId: string | null;

  /** Active tab ('files' or 'memories') */
  activeTab: 'files' | 'memories';

  /** Loading state */
  isLoading: boolean;

  /** Error message */
  error: string | null;
}

/**
 * Context Store Actions Interface
 */
interface ContextActions {
  /** Toggle directory expansion */
  toggleDir: (id: string) => void;

  /** Expand a directory */
  expandDir: (id: string) => void;

  /** Collapse a directory */
  collapseDir: (id: string) => void;

  /** Expand all directories */
  expandAll: () => void;

  /** Collapse all directories */
  collapseAll: () => void;

  /** Select a file or memory */
  select: (id: string, type: 'file' | 'memory') => void;

  /** Clear selection */
  clearSelection: () => void;

  /** Get a file by ID */
  getFileById: (id: string) => ContextFile | undefined;

  /** Get a memory by ID */
  getMemoryById: (id: string) => ContextMemory | undefined;

  /** Add a new memory */
  addMemory: (memory: Omit<ContextMemory, 'id' | 'createdAt' | 'updatedAt'>) => ContextMemory;

  /** Update a memory */
  updateMemory: (id: string, updates: Partial<ContextMemory>) => void;

  /** Delete a memory */
  deleteMemory: (id: string) => void;

  /** Set filters */
  setFilters: (filters: ContextFilters) => void;

  /** Clear filters */
  clearFilters: () => void;

  /** Get filtered memories */
  getFilteredMemories: () => ContextMemory[];

  /** Search files by name/path */
  searchFiles: (query: string) => ContextFile[];

  /** Set active tab */
  setActiveTab: (tab: 'files' | 'memories') => void;

  /** Set project ID */
  setProjectId: (projectId: string | null) => void;

  /** Get all file paths (flattened) */
  getAllFilePaths: () => string[];

  /** Get memories by category */
  getMemoriesByCategory: () => Record<MemoryCategory, ContextMemory[]>;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error message */
  setError: (error: string | null) => void;

  /** Reset store to initial state */
  resetStore: () => void;
}

/**
 * Combined Context Store Type
 */
type ContextStore = ContextState & ContextActions;

/**
 * Initial state for the store
 */
const initialState: ContextState = {
  fileTree: mockFileTree,
  memories: mockMemories,
  expandedDirs: new Set(['file-001', 'file-002', 'file-003']), // Start with some dirs expanded
  selectedId: null,
  selectedType: null,
  filters: {},
  projectId: 'project-001',
  activeTab: 'files',
  isLoading: false,
  error: null,
};

/**
 * Helper: Recursively find a file by ID
 */
const findFileById = (files: ContextFile[], id: string): ContextFile | undefined => {
  for (const file of files) {
    if (file.id === id) return file;
    if (file.children) {
      const found = findFileById(file.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

/**
 * Helper: Get all directory IDs
 */
const getAllDirIds = (files: ContextFile[]): string[] => {
  const ids: string[] = [];
  const traverse = (fileList: ContextFile[]) => {
    for (const file of fileList) {
      if (file.type === 'directory') {
        ids.push(file.id);
        if (file.children) traverse(file.children);
      }
    }
  };
  traverse(files);
  return ids;
};

/**
 * Helper: Search files recursively
 */
const searchFilesRecursive = (
  files: ContextFile[],
  query: string
): ContextFile[] => {
  const results: ContextFile[] = [];
  const queryLower = query.toLowerCase();

  const traverse = (fileList: ContextFile[]) => {
    for (const file of fileList) {
      if (
        file.name.toLowerCase().includes(queryLower) ||
        file.path.toLowerCase().includes(queryLower)
      ) {
        results.push(file);
      }
      if (file.children) traverse(file.children);
    }
  };

  traverse(files);
  return results;
};

/**
 * Helper: Get all file paths
 */
const getAllFilePathsRecursive = (files: ContextFile[]): string[] => {
  const paths: string[] = [];

  const traverse = (fileList: ContextFile[]) => {
    for (const file of fileList) {
      paths.push(file.path);
      if (file.children) traverse(file.children);
    }
  };

  traverse(files);
  return paths;
};

/**
 * Context Store
 * Zustand store with persist middleware for AsyncStorage persistence
 */
export const useContextStore = create<ContextStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      toggleDir: (id: string): void => {
        set((state) => {
          const newExpanded = new Set(state.expandedDirs);
          if (newExpanded.has(id)) {
            newExpanded.delete(id);
          } else {
            newExpanded.add(id);
          }
          return { expandedDirs: newExpanded };
        });
      },

      expandDir: (id: string): void => {
        set((state) => {
          const newExpanded = new Set(state.expandedDirs);
          newExpanded.add(id);
          return { expandedDirs: newExpanded };
        });
      },

      collapseDir: (id: string): void => {
        set((state) => {
          const newExpanded = new Set(state.expandedDirs);
          newExpanded.delete(id);
          return { expandedDirs: newExpanded };
        });
      },

      expandAll: (): void => {
        const allIds = getAllDirIds(get().fileTree);
        set({ expandedDirs: new Set(allIds) });
      },

      collapseAll: (): void => {
        set({ expandedDirs: new Set() });
      },

      select: (id: string, type: 'file' | 'memory'): void => {
        set({ selectedId: id, selectedType: type });
      },

      clearSelection: (): void => {
        set({ selectedId: null, selectedType: null });
      },

      getFileById: (id: string): ContextFile | undefined => {
        return findFileById(get().fileTree, id);
      },

      getMemoryById: (id: string): ContextMemory | undefined => {
        return get().memories.find((m) => m.id === id);
      },

      addMemory: (
        memory: Omit<ContextMemory, 'id' | 'createdAt' | 'updatedAt'>
      ): ContextMemory => {
        const newMemory: ContextMemory = {
          ...memory,
          id: generateId(),
          createdAt: now(),
          updatedAt: now(),
        };

        set((state) => ({
          memories: [...state.memories, newMemory],
        }));

        return newMemory;
      },

      updateMemory: (id: string, updates: Partial<ContextMemory>): void => {
        set((state) => ({
          memories: state.memories.map((memory) =>
            memory.id === id
              ? { ...memory, ...updates, updatedAt: now() }
              : memory
          ),
        }));
      },

      deleteMemory: (id: string): void => {
        set((state) => ({
          memories: state.memories.filter((memory) => memory.id !== id),
          selectedId: state.selectedId === id ? null : state.selectedId,
          selectedType: state.selectedId === id ? null : state.selectedType,
        }));
      },

      setFilters: (filters: ContextFilters): void => {
        set({ filters });
      },

      clearFilters: (): void => {
        set({ filters: {} });
      },

      getFilteredMemories: (): ContextMemory[] => {
        const { memories, filters } = get();

        return memories.filter((memory) => {
          // Category filter
          if (filters.memoryCategory && filters.memoryCategory.length > 0) {
            if (!filters.memoryCategory.includes(memory.category)) return false;
          }

          // Search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const matchesKey = memory.key.toLowerCase().includes(searchLower);
            const matchesValue = memory.value.toLowerCase().includes(searchLower);
            if (!matchesKey && !matchesValue) {
              return false;
            }
          }

          return true;
        });
      },

      searchFiles: (query: string): ContextFile[] => {
        if (!query.trim()) return [];
        return searchFilesRecursive(get().fileTree, query);
      },

      setActiveTab: (tab: 'files' | 'memories'): void => {
        set({ activeTab: tab });
      },

      setProjectId: (projectId: string | null): void => {
        set({ projectId });
      },

      getAllFilePaths: (): string[] => {
        return getAllFilePathsRecursive(get().fileTree);
      },

      getMemoriesByCategory: (): Record<MemoryCategory, ContextMemory[]> => {
        const memories = get().memories;
        return {
          pattern: memories.filter((m) => m.category === 'pattern'),
          convention: memories.filter((m) => m.category === 'convention'),
          decision: memories.filter((m) => m.category === 'decision'),
          note: memories.filter((m) => m.category === 'note'),
        };
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
      name: 'autoclaude-context-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        memories: state.memories,
        expandedDirs: Array.from(state.expandedDirs),
        projectId: state.projectId,
        activeTab: state.activeTab,
      }),
      // Convert expandedDirs array back to Set on rehydration
      merge: (persistedState: unknown, currentState: ContextStore) => {
        const persisted = persistedState as Partial<ContextState> & { expandedDirs?: string[] };
        return {
          ...currentState,
          ...persisted,
          expandedDirs: new Set(persisted?.expandedDirs || []),
        };
      },
    }
  )
);

/**
 * Selector hooks for common use cases
 */

/** Get the currently selected file */
export const useSelectedFile = (): ContextFile | undefined => {
  const { selectedId, selectedType } = useContextStore();
  const getFileById = useContextStore((state) => state.getFileById);
  if (selectedType !== 'file' || !selectedId) return undefined;
  return getFileById(selectedId);
};

/** Get the currently selected memory */
export const useSelectedMemory = (): ContextMemory | undefined => {
  const { memories, selectedId, selectedType } = useContextStore();
  if (selectedType !== 'memory' || !selectedId) return undefined;
  return memories.find((m) => m.id === selectedId);
};

/** Get memory count by category */
export const useMemoryCounts = (): Record<MemoryCategory, number> => {
  const memories = useContextStore((state) => state.memories);
  return {
    pattern: memories.filter((m) => m.category === 'pattern').length,
    convention: memories.filter((m) => m.category === 'convention').length,
    decision: memories.filter((m) => m.category === 'decision').length,
    note: memories.filter((m) => m.category === 'note').length,
  };
};

/** Get total memory count */
export const useTotalMemoryCount = (): number => {
  return useContextStore((state) => state.memories.length);
};

/** Get expanded directory IDs */
export const useExpandedDirs = (): Set<string> => {
  return useContextStore((state) => state.expandedDirs);
};

/** Get active tab */
export const useActiveTab = (): 'files' | 'memories' => {
  return useContextStore((state) => state.activeTab);
};

/** Check if a directory is expanded */
export const useIsDirExpanded = (id: string): boolean => {
  return useContextStore((state) => state.expandedDirs.has(id));
};
