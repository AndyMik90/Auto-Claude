import { create } from 'zustand';
import type {
  InsightsSession,
  InsightsSessionSummary,
  InsightsChatMessage,
  InsightsChatStatus,
  InsightsStreamChunk,
  InsightsToolUsage,
  InsightsModelConfig,
  TaskMetadata,
  Task
} from '../../shared/types';

// ============================================
// Session State Types (for cross-session isolation)
// ============================================

interface ToolUsage {
  name: string;
  input?: string;
}

/**
 * Session-scoped state that must be isolated per conversation.
 * This prevents state leakage between different sessions and projects.
 */
export interface SessionState {
  streamingContent: string;
  currentTool: ToolUsage | null;
  status: InsightsChatStatus;
  toolsUsed: InsightsToolUsage[];
  lastUpdated: Date;
}

// ============================================
// Composite Key Utilities
// ============================================

/**
 * Creates a composite key for session-scoped state lookup.
 * Format: "${projectId}:${sessionId}"
 */
export function getSessionKey(projectId: string, sessionId: string): string {
  return `${projectId}:${sessionId}`;
}

/**
 * Default session state for new or non-existent sessions
 */
function getDefaultSessionState(): SessionState {
  return {
    streamingContent: '',
    currentTool: null,
    status: { phase: 'idle', message: '' },
    toolsUsed: [],
    lastUpdated: new Date()
  };
}

/**
 * Returns existing session state or creates a default one.
 * Does NOT mutate the map - caller is responsible for storing if needed.
 */
export function getOrCreateSessionState(
  key: string,
  sessionStates: Map<string, SessionState>
): SessionState {
  return sessionStates.get(key) || getDefaultSessionState();
}

// ============================================
// Main Store Interface
// ============================================

interface InsightsState {
  // Data
  session: InsightsSession | null;
  sessions: InsightsSessionSummary[]; // List of all sessions
  status: InsightsChatStatus;
  pendingMessage: string;
  streamingContent: string; // Accumulates streaming response
  currentTool: ToolUsage | null; // Currently executing tool
  toolsUsed: InsightsToolUsage[]; // Tools used during current response
  isLoadingSessions: boolean;

  // Session-scoped state (for cross-session isolation)
  activeProjectId: string | null;
  activeSessionId: string | null;
  sessionStates: Map<string, SessionState>;

  // Actions
  setSession: (session: InsightsSession | null) => void;
  setSessions: (sessions: InsightsSessionSummary[]) => void;
  setStatus: (status: InsightsChatStatus) => void;
  setPendingMessage: (message: string) => void;
  addMessage: (message: InsightsChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
  setCurrentTool: (tool: ToolUsage | null) => void;
  addToolUsage: (tool: ToolUsage) => void;
  clearToolsUsed: () => void;
  finalizeStreamingMessage: (suggestedTask?: InsightsChatMessage['suggestedTask']) => void;
  clearSession: () => void;
  setLoadingSessions: (loading: boolean) => void;

  // Session-scoped state actions
  setActiveContext: (projectId: string, sessionId: string) => void;
  getSessionState: (projectId: string, sessionId: string) => SessionState;
}

const initialStatus: InsightsChatStatus = {
  phase: 'idle',
  message: ''
};

export const useInsightsStore = create<InsightsState>((set, get) => ({
  // Initial state
  session: null,
  sessions: [],
  status: initialStatus,
  pendingMessage: '',
  streamingContent: '',
  currentTool: null,
  toolsUsed: [],
  isLoadingSessions: false,

  // Session-scoped state (for cross-session isolation)
  activeProjectId: null,
  activeSessionId: null,
  sessionStates: new Map<string, SessionState>(),

  // Actions
  setSession: (session) => set({ session }),

  setSessions: (sessions) => set({ sessions }),

  setStatus: (status) => set({ status }),

  setLoadingSessions: (loading) => set({ isLoadingSessions: loading }),

  setPendingMessage: (message) => set({ pendingMessage: message }),

  addMessage: (message) =>
    set((state) => {
      if (!state.session) {
        // Create new session if none exists
        return {
          session: {
            id: `session-${Date.now()}`,
            projectId: '',
            messages: [message],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };
      }

      return {
        session: {
          ...state.session,
          messages: [...state.session.messages, message],
          updatedAt: new Date()
        }
      };
    }),

  updateLastAssistantMessage: (content) =>
    set((state) => {
      if (!state.session || state.session.messages.length === 0) return state;

      const messages = [...state.session.messages];
      const lastIndex = messages.length - 1;
      const lastMessage = messages[lastIndex];

      if (lastMessage.role === 'assistant') {
        messages[lastIndex] = { ...lastMessage, content };
      }

      return {
        session: {
          ...state.session,
          messages,
          updatedAt: new Date()
        }
      };
    }),

  appendStreamingContent: (content) =>
    set((state) => ({
      streamingContent: state.streamingContent + content
    })),

  clearStreamingContent: () => set({ streamingContent: '' }),

  setCurrentTool: (tool) => set({ currentTool: tool }),

  addToolUsage: (tool) =>
    set((state) => ({
      toolsUsed: [
        ...state.toolsUsed,
        {
          name: tool.name,
          input: tool.input,
          timestamp: new Date()
        }
      ]
    })),

  clearToolsUsed: () => set({ toolsUsed: [] }),

  finalizeStreamingMessage: (suggestedTask) =>
    set((state) => {
      const content = state.streamingContent;
      const toolsUsed = state.toolsUsed.length > 0 ? [...state.toolsUsed] : undefined;

      if (!content && !suggestedTask && !toolsUsed) {
        return { streamingContent: '', toolsUsed: [] };
      }

      const newMessage: InsightsChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date(),
        suggestedTask,
        toolsUsed
      };

      if (!state.session) {
        return {
          streamingContent: '',
          toolsUsed: [],
          session: {
            id: `session-${Date.now()}`,
            projectId: '',
            messages: [newMessage],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };
      }

      return {
        streamingContent: '',
        toolsUsed: [],
        session: {
          ...state.session,
          messages: [...state.session.messages, newMessage],
          updatedAt: new Date()
        }
      };
    }),

  clearSession: () =>
    set({
      session: null,
      status: initialStatus,
      pendingMessage: '',
      streamingContent: '',
      currentTool: null,
      toolsUsed: []
    }),

  // Session-scoped state actions
  setActiveContext: (projectId, sessionId) =>
    set({
      activeProjectId: projectId,
      activeSessionId: sessionId
    }),

  getSessionState: (projectId, sessionId) => {
    const key = getSessionKey(projectId, sessionId);
    return getOrCreateSessionState(key, get().sessionStates);
  }
}));

// Helper functions

export async function loadInsightsSessions(projectId: string): Promise<void> {
  const store = useInsightsStore.getState();
  store.setLoadingSessions(true);

  try {
    const result = await window.electronAPI.listInsightsSessions(projectId);
    if (result.success && result.data) {
      store.setSessions(result.data);
    } else {
      store.setSessions([]);
    }
  } finally {
    store.setLoadingSessions(false);
  }
}

export async function loadInsightsSession(projectId: string): Promise<void> {
  const result = await window.electronAPI.getInsightsSession(projectId);
  if (result.success && result.data) {
    useInsightsStore.getState().setSession(result.data);
  } else {
    useInsightsStore.getState().setSession(null);
  }
  // Also load the sessions list
  await loadInsightsSessions(projectId);
}

export function sendMessage(projectId: string, message: string, modelConfig?: InsightsModelConfig): void {
  const store = useInsightsStore.getState();
  const session = store.session;

  // Add user message to session
  const userMessage: InsightsChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: message,
    timestamp: new Date()
  };
  store.addMessage(userMessage);

  // Clear pending and set status
  store.setPendingMessage('');
  store.clearStreamingContent();
  store.clearToolsUsed(); // Clear tools from previous response
  store.setStatus({
    phase: 'thinking',
    message: 'Processing your message...'
  });

  // Use provided modelConfig, or fall back to session's config
  const configToUse = modelConfig || session?.modelConfig;

  // Send to main process
  window.electronAPI.sendInsightsMessage(projectId, message, configToUse);
}

export async function clearSession(projectId: string): Promise<void> {
  const result = await window.electronAPI.clearInsightsSession(projectId);
  if (result.success) {
    useInsightsStore.getState().clearSession();
    // Reload sessions list and current session
    await loadInsightsSession(projectId);
  }
}

export async function newSession(projectId: string): Promise<void> {
  const result = await window.electronAPI.newInsightsSession(projectId);
  if (result.success && result.data) {
    useInsightsStore.getState().setSession(result.data);
    // Reload sessions list
    await loadInsightsSessions(projectId);
  }
}

export async function switchSession(projectId: string, sessionId: string): Promise<void> {
  const result = await window.electronAPI.switchInsightsSession(projectId, sessionId);
  if (result.success && result.data) {
    useInsightsStore.getState().setSession(result.data);
    // Reset streaming state when switching sessions
    useInsightsStore.getState().clearStreamingContent();
    useInsightsStore.getState().clearToolsUsed();
    useInsightsStore.getState().setCurrentTool(null);
    useInsightsStore.getState().setStatus({ phase: 'idle', message: '' });
  }
}

export async function deleteSession(projectId: string, sessionId: string): Promise<boolean> {
  const result = await window.electronAPI.deleteInsightsSession(projectId, sessionId);
  if (result.success) {
    // Reload sessions list and current session
    await loadInsightsSession(projectId);
    return true;
  }
  return false;
}

export async function renameSession(projectId: string, sessionId: string, newTitle: string): Promise<boolean> {
  const result = await window.electronAPI.renameInsightsSession(projectId, sessionId, newTitle);
  if (result.success) {
    // Reload sessions list to reflect the change
    await loadInsightsSessions(projectId);
    return true;
  }
  return false;
}

export async function updateModelConfig(projectId: string, sessionId: string, modelConfig: InsightsModelConfig): Promise<boolean> {
  const result = await window.electronAPI.updateInsightsModelConfig(projectId, sessionId, modelConfig);
  if (result.success) {
    // Update local session state
    const store = useInsightsStore.getState();
    if (store.session?.id === sessionId) {
      store.setSession({
        ...store.session,
        modelConfig,
        updatedAt: new Date()
      });
    }
    // Reload sessions list to reflect the change
    await loadInsightsSessions(projectId);
    return true;
  }
  return false;
}

export async function createTaskFromSuggestion(
  projectId: string,
  title: string,
  description: string,
  metadata?: TaskMetadata
): Promise<Task | null> {
  const result = await window.electronAPI.createTaskFromInsights(
    projectId,
    title,
    description,
    metadata
  );

  if (result.success && result.data) {
    return result.data;
  }
  return null;
}

// IPC listener setup - call this once when the app initializes
export function setupInsightsListeners(): () => void {
  const store = useInsightsStore.getState;

  // Listen for streaming chunks
  const unsubStreamChunk = window.electronAPI.onInsightsStreamChunk(
    (_projectId, chunk: InsightsStreamChunk) => {
      switch (chunk.type) {
        case 'text':
          if (chunk.content) {
            store().appendStreamingContent(chunk.content);
            store().setCurrentTool(null); // Clear tool when receiving text
            store().setStatus({
              phase: 'streaming',
              message: 'Receiving response...'
            });
          }
          break;
        case 'tool_start':
          if (chunk.tool) {
            store().setCurrentTool({
              name: chunk.tool.name,
              input: chunk.tool.input
            });
            // Record this tool usage for history
            store().addToolUsage({
              name: chunk.tool.name,
              input: chunk.tool.input
            });
            store().setStatus({
              phase: 'streaming',
              message: `Using ${chunk.tool.name}...`
            });
          }
          break;
        case 'tool_end':
          store().setCurrentTool(null);
          break;
        case 'task_suggestion':
          // Finalize the message with task suggestion
          store().setCurrentTool(null);
          store().finalizeStreamingMessage(chunk.suggestedTask);
          break;
        case 'done':
          // Finalize any remaining content
          store().setCurrentTool(null);
          store().finalizeStreamingMessage();
          store().setStatus({
            phase: 'complete',
            message: ''
          });
          break;
        case 'error':
          store().setCurrentTool(null);
          store().setStatus({
            phase: 'error',
            error: chunk.error
          });
          break;
      }
    }
  );

  // Listen for status updates
  const unsubStatus = window.electronAPI.onInsightsStatus((_projectId, status) => {
    store().setStatus(status);
  });

  // Listen for errors
  const unsubError = window.electronAPI.onInsightsError((_projectId, error) => {
    store().setStatus({
      phase: 'error',
      error
    });
  });

  // Return cleanup function
  return () => {
    unsubStreamChunk();
    unsubStatus();
    unsubError();
  };
}
