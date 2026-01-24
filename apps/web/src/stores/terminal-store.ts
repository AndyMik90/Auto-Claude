import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { arrayMove } from '@dnd-kit/sortable';
import type { Terminal, TerminalSession, TerminalWorktreeConfig, TerminalStatus, TerminalLayout } from '../types';
import { ipc } from '../lib/ipc-abstraction';

/**
 * Terminal Buffer Manager
 * Manages terminal output buffers for all terminals
 */
class TerminalBufferManager {
  private buffers = new Map<string, string>();
  private maxBufferSize = 1000000; // 1MB per terminal

  append(terminalId: string, data: string): void {
    const current = this.buffers.get(terminalId) || '';
    const updated = current + data;

    // Trim if exceeds max size
    if (updated.length > this.maxBufferSize) {
      const trimmed = updated.slice(updated.length - this.maxBufferSize);
      this.buffers.set(terminalId, trimmed);
    } else {
      this.buffers.set(terminalId, updated);
    }
  }

  get(terminalId: string): string {
    return this.buffers.get(terminalId) || '';
  }

  clear(terminalId: string): void {
    this.buffers.delete(terminalId);
  }

  clearAll(): void {
    this.buffers.clear();
  }
}

const terminalBufferManager = new TerminalBufferManager();

/**
 * Module-level Map to store terminal ID -> xterm write callback mappings.
 *
 * DESIGN NOTE: This is stored outside of Zustand state because:
 * 1. Callbacks are functions and shouldn't be serialized in state
 * 2. The callbacks need to be accessible from the global terminal listener
 * 3. Registration/unregistration happens on terminal mount/unmount, not state changes
 *
 * When a terminal component mounts, it registers its xterm.write function here.
 * When the global terminal output listener receives data, it calls the callback
 * if registered (terminal is visible), otherwise just buffers the data.
 * This allows output to be written to xterm immediately when visible, while
 * still buffering when the terminal is not rendered (project switched away).
 */
const xtermCallbacks = new Map<string, (data: string) => void>();

/**
 * Register an xterm write callback for a terminal.
 * Called when a terminal component mounts and xterm is ready.
 *
 * @param terminalId - The terminal ID
 * @param callback - Function to write data to xterm instance
 */
export function registerOutputCallback(terminalId: string, callback: (data: string) => void): void {
  xtermCallbacks.set(terminalId, callback);
  console.log(`[TerminalStore] Registered output callback for terminal: ${terminalId}`);
}

/**
 * Unregister an xterm write callback for a terminal.
 * Called when a terminal component unmounts.
 *
 * @param terminalId - The terminal ID
 */
export function unregisterOutputCallback(terminalId: string): void {
  xtermCallbacks.delete(terminalId);
  console.log(`[TerminalStore] Unregistered output callback for terminal: ${terminalId}`);
}

/**
 * Write terminal output to the appropriate destination.
 *
 * If the terminal has a registered callback (component is mounted and visible),
 * writes directly to xterm AND buffers. If no callback is registered (terminal
 * component is unmounted due to project switch), only buffers the data.
 *
 * This function is called by the global terminal output listener in
 * useGlobalTerminalListeners, which ensures output is always captured
 * regardless of which project is currently active.
 *
 * @param terminalId - The terminal ID
 * @param data - The output data to write
 */
export function writeToTerminal(terminalId: string, data: string): void {
  // Always buffer the data to ensure persistence
  terminalBufferManager.append(terminalId, data);

  // If terminal has a registered callback, write to xterm immediately
  const callback = xtermCallbacks.get(terminalId);
  if (callback) {
    try {
      callback(data);
    } catch (error) {
      console.error(`[TerminalStore] Error writing to terminal ${terminalId}:`, error);
    }
  }
}

interface TerminalState {
  terminals: Terminal[];
  layouts: TerminalLayout[];
  activeTerminalId: string | null;
  maxTerminals: number;
  hasRestoredSessions: boolean; // Track if we've restored sessions for this project

  // Actions
  addTerminal: (cwd?: string, projectPath?: string) => Terminal | null;
  addRestoredTerminal: (session: TerminalSession) => Terminal;
  // Add a terminal with a specific ID (for terminals created in main process, like OAuth login terminals)
  addExternalTerminal: (id: string, title: string, cwd?: string, projectPath?: string) => Terminal | null;
  removeTerminal: (id: string) => void;
  updateTerminal: (id: string, updates: Partial<Terminal>) => void;
  setActiveTerminal: (id: string | null) => void;
  setTerminalStatus: (id: string, status: TerminalStatus) => void;
  setClaudeMode: (id: string, isClaudeMode: boolean) => void;
  setClaudeSessionId: (id: string, sessionId: string) => void;
  setAssociatedTask: (id: string, taskId: string | undefined) => void;
  setWorktreeConfig: (id: string, config: TerminalWorktreeConfig | undefined) => void;
  setClaudeBusy: (id: string, isBusy: boolean) => void;
  setPendingClaudeResume: (id: string, pending: boolean) => void;
  setClaudeNamedOnce: (id: string, named: boolean) => void;
  clearAllTerminals: () => void;
  setHasRestoredSessions: (value: boolean) => void;
  reorderTerminals: (activeId: string, overId: string) => void;

  // Selectors
  getTerminal: (id: string) => Terminal | undefined;
  getActiveTerminal: () => Terminal | undefined;
  canAddTerminal: (projectPath?: string) => boolean;
  getTerminalsForProject: (projectPath: string) => Terminal[];
  getWorktreeCount: () => number;
  getBufferContent: (terminalId: string) => string;
}

/**
 * Helper function to count active (non-exited) terminals for a specific project.
 * Extracted to avoid duplicating the counting logic across multiple methods.
 *
 * @param terminals - The array of all terminals
 * @param projectPath - The project path to filter by
 * @returns The count of active terminals for the given project
 */
function getActiveProjectTerminalCount(terminals: Terminal[], projectPath?: string): number {
  return terminals.filter((t) => t.status !== 'exited' && t.projectPath === projectPath).length;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],
  layouts: [],
  activeTerminalId: null,
  // Maximum terminals per project - limited to 12 to prevent excessive memory usage
  // from terminal buffers (~1MB each) and PTY process resource exhaustion.
  // Each terminal maintains a scrollback buffer and associated xterm.js state.
  maxTerminals: 12,
  hasRestoredSessions: false,

  addTerminal: (cwd?: string, projectPath?: string) => {
    const state = get();
    const activeCount = getActiveProjectTerminalCount(state.terminals, projectPath);
    if (activeCount >= state.maxTerminals) {
      console.log(
        `[TerminalStore] Cannot add terminal: limit of ${state.maxTerminals} reached for project ${projectPath}`
      );
      return null;
    }

    const newTerminal: Terminal = {
      id: uuid(),
      title: `Terminal ${state.terminals.length + 1}`,
      status: 'idle',
      cwd: cwd || process.env.HOME || '~',
      createdAt: new Date(),
      isClaudeMode: false,
      projectPath,
      displayOrder: state.terminals.length // New terminals appear at the end
    };

    set((state) => ({
      terminals: [...state.terminals, newTerminal],
      activeTerminalId: newTerminal.id
    }));

    return newTerminal;
  },

  addRestoredTerminal: (session: TerminalSession) => {
    const state = get();

    // Check if terminal already exists
    const existingTerminal = state.terminals.find((t) => t.id === session.id);
    if (existingTerminal) {
      return existingTerminal;
    }

    // Check terminal limit
    const activeCount = getActiveProjectTerminalCount(state.terminals, session.projectPath);
    if (activeCount >= state.maxTerminals) {
      console.warn(
        `[TerminalStore] Cannot restore terminal: limit of ${state.maxTerminals} reached for project ${session.projectPath}`
      );
      // Create a dummy terminal to satisfy return type (won't be added)
      return {
        id: session.id,
        title: session.title,
        status: 'idle' as TerminalStatus,
        cwd: session.cwd,
        createdAt: session.createdAt,
        isClaudeMode: session.isClaudeMode,
        projectPath: session.projectPath
      };
    }

    const restoredTerminal: Terminal = {
      id: session.id,
      title: session.title,
      status: 'idle',
      cwd: session.cwd,
      createdAt: session.createdAt,
      isClaudeMode: session.isClaudeMode,
      claudeSessionId: session.claudeSessionId,
      isRestored: true,
      projectPath: session.projectPath,
      worktreeConfig: session.worktreeConfig,
      associatedTaskId: session.associatedTaskId,
      displayOrder: session.displayOrder ?? state.terminals.length,
      claudeNamedOnce: session.claudeNamedOnce
    };

    // Restore buffer
    if (session.buffer) {
      terminalBufferManager.append(session.id, session.buffer);
    }

    set((state) => ({
      terminals: [...state.terminals, restoredTerminal],
      activeTerminalId: state.activeTerminalId || restoredTerminal.id
    }));

    return restoredTerminal;
  },

  addExternalTerminal: (id: string, title: string, cwd?: string, projectPath?: string) => {
    const state = get();

    // Check if terminal already exists
    const existingTerminal = state.terminals.find((t) => t.id === id);
    if (existingTerminal) {
      return existingTerminal;
    }

    const activeCount = getActiveProjectTerminalCount(state.terminals, projectPath);
    if (activeCount >= state.maxTerminals) {
      console.log(
        `[TerminalStore] Cannot add external terminal: limit of ${state.maxTerminals} reached for project ${projectPath}`
      );
      return null;
    }

    const newTerminal: Terminal = {
      id,
      title,
      status: 'idle',
      cwd: cwd || process.env.HOME || '~',
      createdAt: new Date(),
      isClaudeMode: false,
      projectPath,
      displayOrder: state.terminals.length
    };

    set((state) => ({
      terminals: [...state.terminals, newTerminal],
      activeTerminalId: newTerminal.id
    }));

    return newTerminal;
  },

  removeTerminal: (id: string) => {
    // Clear buffer
    terminalBufferManager.clear(id);

    set((state) => {
      const newTerminals = state.terminals.filter((t) => t.id !== id);
      const newActiveTerminalId = state.activeTerminalId === id ? newTerminals[0]?.id || null : state.activeTerminalId;

      return {
        terminals: newTerminals,
        activeTerminalId: newActiveTerminalId
      };
    });

    // Notify backend to clean up terminal
    ipc.send('terminal-removed', { terminalId: id });
  },

  updateTerminal: (id: string, updates: Partial<Terminal>) =>
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, ...updates } : t))
    })),

  setActiveTerminal: (id: string | null) => set({ activeTerminalId: id }),

  setTerminalStatus: (id: string, status: TerminalStatus) =>
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, status } : t))
    })),

  setClaudeMode: (id: string, isClaudeMode: boolean) =>
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, isClaudeMode } : t))
    })),

  setClaudeSessionId: (id: string, sessionId: string) =>
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, claudeSessionId: sessionId } : t))
    })),

  setAssociatedTask: (id: string, taskId: string | undefined) =>
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, associatedTaskId: taskId } : t))
    })),

  setWorktreeConfig: (id: string, config: TerminalWorktreeConfig | undefined) =>
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, worktreeConfig: config } : t))
    })),

  setClaudeBusy: (id: string, isBusy: boolean) =>
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, isClaudeBusy: isBusy } : t))
    })),

  setPendingClaudeResume: (id: string, pending: boolean) =>
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, pendingClaudeResume: pending } : t))
    })),

  setClaudeNamedOnce: (id: string, named: boolean) =>
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, claudeNamedOnce: named } : t))
    })),

  clearAllTerminals: () => {
    // Clear all buffers
    terminalBufferManager.clearAll();

    set({
      terminals: [],
      activeTerminalId: null
    });

    // Notify backend
    ipc.send('all-terminals-cleared');
  },

  setHasRestoredSessions: (value: boolean) => set({ hasRestoredSessions: value }),

  reorderTerminals: (activeId: string, overId: string) =>
    set((state) => {
      const oldIndex = state.terminals.findIndex((t) => t.id === activeId);
      const newIndex = state.terminals.findIndex((t) => t.id === overId);

      if (oldIndex === -1 || newIndex === -1) {
        return state;
      }

      const reorderedTerminals = arrayMove(state.terminals, oldIndex, newIndex);

      // Update display order
      const withUpdatedOrder = reorderedTerminals.map((t, index) => ({
        ...t,
        displayOrder: index
      }));

      return {
        terminals: withUpdatedOrder
      };
    }),

  // Selectors
  getTerminal: (id: string) => {
    return get().terminals.find((t) => t.id === id);
  },

  getActiveTerminal: () => {
    const state = get();
    return state.terminals.find((t) => t.id === state.activeTerminalId);
  },

  canAddTerminal: (projectPath?: string) => {
    const state = get();
    const activeCount = getActiveProjectTerminalCount(state.terminals, projectPath);
    return activeCount < state.maxTerminals;
  },

  getTerminalsForProject: (projectPath: string) => {
    return get().terminals.filter((t) => t.projectPath === projectPath);
  },

  getWorktreeCount: () => {
    return get().terminals.filter((t) => t.worktreeConfig !== undefined).length;
  },

  getBufferContent: (terminalId: string) => {
    return terminalBufferManager.get(terminalId);
  }
}));

// Set up IPC listeners for terminal updates from backend
if (typeof window !== 'undefined') {
  ipc.on('terminal-created', (data: { terminal: Terminal }) => {
    const state = useTerminalStore.getState();
    const existing = state.terminals.find((t) => t.id === data.terminal.id);
    if (!existing) {
      state.addExternalTerminal(
        data.terminal.id,
        data.terminal.title,
        data.terminal.cwd,
        data.terminal.projectPath
      );
    }
  });

  ipc.on('terminal-output', (data: { terminalId: string; output: string }) => {
    writeToTerminal(data.terminalId, data.output);
  });

  ipc.on('terminal-status-changed', (data: { terminalId: string; status: TerminalStatus }) => {
    useTerminalStore.getState().setTerminalStatus(data.terminalId, data.status);
  });

  ipc.on('terminal-title-changed', (data: { terminalId: string; title: string }) => {
    useTerminalStore.getState().updateTerminal(data.terminalId, { title: data.title });
  });

  ipc.on('terminal-sessions-restored', (data: { sessions: TerminalSession[] }) => {
    const state = useTerminalStore.getState();
    for (const session of data.sessions) {
      state.addRestoredTerminal(session);
    }
    state.setHasRestoredSessions(true);
  });

  ipc.on('claude-mode-changed', (data: { terminalId: string; isClaudeMode: boolean }) => {
    useTerminalStore.getState().setClaudeMode(data.terminalId, data.isClaudeMode);
  });

  ipc.on('claude-session-started', (data: { terminalId: string; sessionId: string }) => {
    useTerminalStore.getState().setClaudeSessionId(data.terminalId, data.sessionId);
  });

  ipc.on('claude-busy-changed', (data: { terminalId: string; isBusy: boolean }) => {
    useTerminalStore.getState().setClaudeBusy(data.terminalId, data.isBusy);
  });
}

// Export buffer manager for use in terminal components
export { terminalBufferManager };
