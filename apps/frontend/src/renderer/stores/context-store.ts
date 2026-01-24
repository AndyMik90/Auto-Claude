import { create } from 'zustand';
import type {
  ProjectIndex,
  GraphitiMemoryStatus,
  GraphitiMemoryState,
  MemoryEpisode,
  ContextSearchResult
} from '../../shared/types';
import type {
  VaultContext,
  VaultFile,
  VaultSearchResult
} from '../../shared/types/vault';

interface ContextState {
  // Project Index
  projectIndex: ProjectIndex | null;
  indexLoading: boolean;
  indexError: string | null;

  // Memory Status
  memoryStatus: GraphitiMemoryStatus | null;
  memoryState: GraphitiMemoryState | null;
  memoryLoading: boolean;
  memoryError: string | null;

  // Recent Memories
  recentMemories: MemoryEpisode[];
  memoriesLoading: boolean;

  // Search
  searchResults: ContextSearchResult[];
  searchLoading: boolean;
  searchQuery: string;

  // Actions
  setProjectIndex: (index: ProjectIndex | null) => void;
  setIndexLoading: (loading: boolean) => void;
  setIndexError: (error: string | null) => void;
  setMemoryStatus: (status: GraphitiMemoryStatus | null) => void;
  setMemoryState: (state: GraphitiMemoryState | null) => void;
  setMemoryLoading: (loading: boolean) => void;
  setMemoryError: (error: string | null) => void;
  setRecentMemories: (memories: MemoryEpisode[]) => void;
  setMemoriesLoading: (loading: boolean) => void;
  setSearchResults: (results: ContextSearchResult[]) => void;
  setSearchLoading: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
  clearAll: () => void;
}

/**
 * Vault state interface (separate store for vault operations)
 */
interface VaultState {
  // Vault context
  vaultContext: VaultContext | null;
  vaultLoading: boolean;
  vaultError: string | null;

  // Vault files
  vaultFiles: VaultFile[];

  // Vault search
  vaultSearchResults: VaultSearchResult[];
  vaultSearchLoading: boolean;
  vaultSearchQuery: string;

  // Actions
  setVaultContext: (context: VaultContext | null) => void;
  setVaultLoading: (loading: boolean) => void;
  setVaultError: (error: string | null) => void;
  setVaultFiles: (files: VaultFile[]) => void;
  setVaultSearchResults: (results: VaultSearchResult[]) => void;
  setVaultSearchLoading: (loading: boolean) => void;
  setVaultSearchQuery: (query: string) => void;
  clearVault: () => void;
}

export const useContextStore = create<ContextState>((set) => ({
  // Project Index
  projectIndex: null,
  indexLoading: false,
  indexError: null,

  // Memory Status
  memoryStatus: null,
  memoryState: null,
  memoryLoading: false,
  memoryError: null,

  // Recent Memories
  recentMemories: [],
  memoriesLoading: false,

  // Search
  searchResults: [],
  searchLoading: false,
  searchQuery: '',

  // Actions
  setProjectIndex: (index) => set({ projectIndex: index }),
  setIndexLoading: (loading) => set({ indexLoading: loading }),
  setIndexError: (error) => set({ indexError: error }),
  setMemoryStatus: (status) => set({ memoryStatus: status }),
  setMemoryState: (state) => set({ memoryState: state }),
  setMemoryLoading: (loading) => set({ memoryLoading: loading }),
  setMemoryError: (error) => set({ memoryError: error }),
  setRecentMemories: (memories) => set({ recentMemories: memories }),
  setMemoriesLoading: (loading) => set({ memoriesLoading: loading }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchLoading: (loading) => set({ searchLoading: loading }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearAll: () =>
    set({
      projectIndex: null,
      indexLoading: false,
      indexError: null,
      memoryStatus: null,
      memoryState: null,
      memoryLoading: false,
      memoryError: null,
      recentMemories: [],
      memoriesLoading: false,
      searchResults: [],
      searchLoading: false,
      searchQuery: ''
    })
}));

/**
 * Load project context (project index + memory status)
 */
export async function loadProjectContext(projectId: string): Promise<void> {
  const store = useContextStore.getState();
  store.setIndexLoading(true);
  store.setMemoryLoading(true);
  store.setIndexError(null);
  store.setMemoryError(null);

  try {
    const result = await window.electronAPI.getProjectContext(projectId);
    if (result.success && result.data) {
      store.setProjectIndex(result.data.projectIndex);
      store.setMemoryStatus(result.data.memoryStatus);
      store.setMemoryState(result.data.memoryState);
      store.setRecentMemories(result.data.recentMemories || []);
    } else {
      store.setIndexError(result.error || 'Failed to load project context');
    }
  } catch (error) {
    store.setIndexError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    store.setIndexLoading(false);
    store.setMemoryLoading(false);
  }
}

/**
 * Refresh project index by re-running analyzer
 */
export async function refreshProjectIndex(projectId: string): Promise<void> {
  const store = useContextStore.getState();
  store.setIndexLoading(true);
  store.setIndexError(null);

  try {
    const result = await window.electronAPI.refreshProjectIndex(projectId);
    if (result.success && result.data) {
      store.setProjectIndex(result.data);
    } else {
      store.setIndexError(result.error || 'Failed to refresh project index');
    }
  } catch (error) {
    store.setIndexError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    store.setIndexLoading(false);
  }
}

/**
 * Search memories using semantic search
 */
export async function searchMemories(
  projectId: string,
  query: string
): Promise<void> {
  const store = useContextStore.getState();
  store.setSearchQuery(query);

  if (!query.trim()) {
    store.setSearchResults([]);
    return;
  }

  store.setSearchLoading(true);

  try {
    const result = await window.electronAPI.searchMemories(projectId, query);
    if (result.success && result.data) {
      store.setSearchResults(result.data);
    } else {
      store.setSearchResults([]);
    }
  } catch (_error) {
    store.setSearchResults([]);
  } finally {
    store.setSearchLoading(false);
  }
}

/**
 * Load recent memories
 */
export async function loadRecentMemories(
  projectId: string,
  limit: number = 20
): Promise<void> {
  const store = useContextStore.getState();
  store.setMemoriesLoading(true);

  try {
    const result = await window.electronAPI.getRecentMemories(projectId, limit);
    if (result.success && result.data) {
      store.setRecentMemories(result.data);
    }
  } catch (_error) {
    // Silently fail - memories are optional
  } finally {
    store.setMemoriesLoading(false);
  }
}

/**
 * Vault store for external vault operations
 */
export const useVaultStore = create<VaultState>((set) => ({
  // Vault context
  vaultContext: null,
  vaultLoading: false,
  vaultError: null,

  // Vault files
  vaultFiles: [],

  // Vault search
  vaultSearchResults: [],
  vaultSearchLoading: false,
  vaultSearchQuery: '',

  // Actions
  setVaultContext: (context) => set({ vaultContext: context }),
  setVaultLoading: (loading) => set({ vaultLoading: loading }),
  setVaultError: (error) => set({ vaultError: error }),
  setVaultFiles: (files) => set({ vaultFiles: files }),
  setVaultSearchResults: (results) => set({ vaultSearchResults: results }),
  setVaultSearchLoading: (loading) => set({ vaultSearchLoading: loading }),
  setVaultSearchQuery: (query) => set({ vaultSearchQuery: query }),
  clearVault: () =>
    set({
      vaultContext: null,
      vaultLoading: false,
      vaultError: null,
      vaultFiles: [],
      vaultSearchResults: [],
      vaultSearchLoading: false,
      vaultSearchQuery: '',
    }),
}));

/**
 * Load vault context (CLAUDE.md, preferences, agents, learnings)
 */
export async function loadVaultContext(vaultPath: string): Promise<void> {
  const store = useVaultStore.getState();
  store.setVaultLoading(true);
  store.setVaultError(null);

  try {
    // Load context
    const contextResult = await window.electronAPI.getVaultContext(vaultPath);
    if (contextResult.success && contextResult.data) {
      store.setVaultContext(contextResult.data);
    } else {
      store.setVaultError(contextResult.error || 'Failed to load vault context');
    }

    // Load file tree
    const filesResult = await window.electronAPI.listVaultFiles(vaultPath);
    if (filesResult.success && filesResult.data) {
      store.setVaultFiles(filesResult.data);
    }
  } catch (error) {
    store.setVaultError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    store.setVaultLoading(false);
  }
}

/**
 * Search vault content
 */
export async function searchVault(
  vaultPath: string,
  query: string
): Promise<void> {
  const store = useVaultStore.getState();
  store.setVaultSearchQuery(query);

  if (!query.trim()) {
    store.setVaultSearchResults([]);
    return;
  }

  store.setVaultSearchLoading(true);

  try {
    const result = await window.electronAPI.searchVault(vaultPath, query);
    if (result.success && result.data) {
      store.setVaultSearchResults(result.data);
    } else {
      store.setVaultSearchResults([]);
    }
  } catch (_error) {
    store.setVaultSearchResults([]);
  } finally {
    store.setVaultSearchLoading(false);
  }
}
