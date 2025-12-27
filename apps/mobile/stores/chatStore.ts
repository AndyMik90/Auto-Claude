/**
 * Chat Store
 * Zustand store for AI chat session management with message streaming support
 * Uses persist middleware with AsyncStorage for data persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ChatSession,
  ChatMessage,
  ChatSessionCreateInput,
  ChatSessionUpdateInput,
  ChatSessionFilters,
  MessageRole,
  MessageStatus,
  ToolCall,
  ToolCallStatus,
} from '../types';

/**
 * Generates a unique ID for new sessions/messages
 */
const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Get current timestamp in ISO format
 */
const now = (): string => new Date().toISOString();

/**
 * Mock chat messages for session 1 - General project discussion
 */
const mockSession1Messages: ChatMessage[] = [
  {
    id: 'msg-001',
    role: 'user',
    content: 'Can you explain the architecture of the AutoClaude mobile app?',
    status: 'complete',
    createdAt: '2025-01-15T10:00:00Z',
    completedAt: '2025-01-15T10:00:01Z',
    tokenCount: 15,
  },
  {
    id: 'msg-002',
    role: 'assistant',
    content: `The AutoClaude mobile app follows a modern React Native architecture with Expo. Here's a breakdown:

**Navigation Layer**
- Uses Expo Router for file-based routing
- Bottom tab navigation for main screens (Home, Projects, Chat, GitHub, Settings)
- Stack navigation for detail views

**State Management**
- Zustand for local state management with persistence
- TanStack Query for server state and caching
- Separate stores for tasks, projects, chat, settings

**UI Components**
- React Native Paper for Material Design components
- Custom themed components matching desktop app
- Dark theme as default

**Data Layer**
- AsyncStorage for persistent local data
- Expo Secure Store for sensitive data (API keys)
- WebSocket client for real-time updates

Would you like me to dive deeper into any specific layer?`,
    status: 'complete',
    createdAt: '2025-01-15T10:00:02Z',
    completedAt: '2025-01-15T10:00:15Z',
    tokenCount: 180,
  },
  {
    id: 'msg-003',
    role: 'user',
    content: 'Yes, tell me more about the Zustand stores pattern.',
    status: 'complete',
    createdAt: '2025-01-15T10:01:00Z',
    completedAt: '2025-01-15T10:01:01Z',
    tokenCount: 12,
  },
  {
    id: 'msg-004',
    role: 'assistant',
    content: `The Zustand stores follow a consistent pattern across the app:

\`\`\`typescript
interface StoreState {
  items: Item[];
  selectedId: string | null;
  filters: Filters;
  isLoading: boolean;
  error: string | null;
}

interface StoreActions {
  addItem: (input: CreateInput) => Item;
  updateItem: (id: string, updates: UpdateInput) => void;
  deleteItem: (id: string) => void;
  selectItem: (id: string | null) => void;
  setFilters: (filters: Filters) => void;
}
\`\`\`

**Key Features:**
1. **Separation of Concerns** - State and actions interfaces are defined separately
2. **Persistence** - Uses \`persist\` middleware with AsyncStorage
3. **Partialize** - Only persists necessary data (not UI state)
4. **Selectors** - Custom hook selectors for common use cases

Each store (task, project, chat, settings) follows this exact pattern for consistency.`,
    status: 'complete',
    createdAt: '2025-01-15T10:01:02Z',
    completedAt: '2025-01-15T10:01:20Z',
    tokenCount: 200,
    toolCalls: [
      {
        id: 'tool-001',
        name: 'read_file',
        arguments: { path: 'stores/taskStore.ts' },
        result: 'File content retrieved successfully',
        status: 'completed',
        startedAt: '2025-01-15T10:01:05Z',
        completedAt: '2025-01-15T10:01:08Z',
      },
    ],
  },
];

/**
 * Mock chat messages for session 2 - Bug investigation
 */
const mockSession2Messages: ChatMessage[] = [
  {
    id: 'msg-005',
    role: 'user',
    content: 'There\'s a memory leak in the chat component. Can you investigate?',
    status: 'complete',
    createdAt: '2025-01-16T09:00:00Z',
    completedAt: '2025-01-16T09:00:01Z',
    tokenCount: 14,
  },
  {
    id: 'msg-006',
    role: 'assistant',
    content: `I'll investigate the memory leak in the chat component. Let me analyze the code.`,
    status: 'complete',
    isStreaming: false,
    createdAt: '2025-01-16T09:00:02Z',
    completedAt: '2025-01-16T09:00:30Z',
    tokenCount: 250,
    toolCalls: [
      {
        id: 'tool-002',
        name: 'grep',
        arguments: { pattern: 'useEffect.*chat', path: 'components/' },
        result: 'Found 3 matches',
        status: 'completed',
        startedAt: '2025-01-16T09:00:05Z',
        completedAt: '2025-01-16T09:00:10Z',
      },
      {
        id: 'tool-003',
        name: 'read_file',
        arguments: { path: 'components/ChatMessage.tsx' },
        result: 'File content retrieved',
        status: 'completed',
        startedAt: '2025-01-16T09:00:12Z',
        completedAt: '2025-01-16T09:00:18Z',
      },
    ],
  },
  {
    id: 'msg-007',
    role: 'assistant',
    content: `**Found the issue!** 🔍

The memory leak is caused by an event listener not being cleaned up in the ChatMessage component:

\`\`\`typescript
// Problem: Missing cleanup
useEffect(() => {
  socket.on('message', handleMessage);
  // Missing: return () => socket.off('message', handleMessage);
}, []);
\`\`\`

**Fix:**
\`\`\`typescript
useEffect(() => {
  socket.on('message', handleMessage);
  return () => {
    socket.off('message', handleMessage);
  };
}, [handleMessage]);
\`\`\`

Also found that the message state updates trigger unnecessary re-renders. Consider using \`useMemo\` for the message list filtering.

Should I create a PR with these fixes?`,
    status: 'complete',
    createdAt: '2025-01-16T09:00:31Z',
    completedAt: '2025-01-16T09:00:45Z',
    tokenCount: 180,
  },
];

/**
 * Mock chat messages for session 3 - Code review
 */
const mockSession3Messages: ChatMessage[] = [
  {
    id: 'msg-008',
    role: 'user',
    content: 'Review the KanbanBoard component implementation.',
    status: 'complete',
    createdAt: '2025-01-14T14:00:00Z',
    completedAt: '2025-01-14T14:00:01Z',
    tokenCount: 8,
  },
  {
    id: 'msg-009',
    role: 'assistant',
    content: `# Code Review: KanbanBoard Component

## Overall Assessment: ⭐⭐⭐⭐ (4/5)

The implementation is solid with good separation of concerns. Here are my observations:

### Strengths ✅
- Clean component structure with separate KanbanColumn components
- Proper use of react-native-gesture-handler for drag-and-drop
- Good accessibility labels on interactive elements
- Follows the established dark theme pattern

### Areas for Improvement 🔧
1. **Performance**: Consider memoizing the column components to prevent unnecessary re-renders
2. **Type Safety**: Some any types could be more specific
3. **Error Boundaries**: Add error boundary around each column
4. **Empty States**: Column empty states could be more descriptive

### Code Suggestions
\`\`\`typescript
// Before
const renderColumn = (status: TaskStatus) => { ... }

// After - with memoization
const renderColumn = useCallback((status: TaskStatus) => {
  return <MemoizedKanbanColumn status={status} />;
}, [tasks]);
\`\`\`

Want me to create refactoring tasks for these improvements?`,
    status: 'complete',
    createdAt: '2025-01-14T14:00:02Z',
    completedAt: '2025-01-14T14:01:00Z',
    tokenCount: 300,
    toolCalls: [
      {
        id: 'tool-004',
        name: 'read_file',
        arguments: { path: 'components/KanbanBoard.tsx' },
        result: 'File analyzed successfully',
        status: 'completed',
        startedAt: '2025-01-14T14:00:05Z',
        completedAt: '2025-01-14T14:00:15Z',
      },
    ],
  },
  {
    id: 'msg-010',
    role: 'user',
    content: 'Yes, please create tasks for the improvements.',
    status: 'complete',
    createdAt: '2025-01-14T14:02:00Z',
    completedAt: '2025-01-14T14:02:01Z',
    tokenCount: 9,
  },
  {
    id: 'msg-011',
    role: 'assistant',
    content: `I've created the following tasks in the backlog:

1. **Memoize KanbanColumn components** (complexity: 3, impact: 6)
   - Add React.memo wrapper to KanbanColumn
   - Implement useMemo for column task filtering

2. **Add error boundaries to Kanban** (complexity: 4, impact: 7)
   - Create ColumnErrorBoundary component
   - Add graceful error states for each column

3. **Improve Kanban type safety** (complexity: 2, impact: 4)
   - Replace any types with proper TypeScript types
   - Add strict prop validation

4. **Enhance empty state messages** (complexity: 2, impact: 5)
   - Create descriptive empty states for each column
   - Add helpful action suggestions

All tasks have been added to the Backlog column and tagged with 'kanban' and 'refactor' labels.`,
    status: 'complete',
    createdAt: '2025-01-14T14:02:02Z',
    completedAt: '2025-01-14T14:02:30Z',
    tokenCount: 180,
    toolCalls: [
      {
        id: 'tool-005',
        name: 'create_task',
        arguments: { title: 'Memoize KanbanColumn components' },
        result: 'Task created: task-013',
        status: 'completed',
        startedAt: '2025-01-14T14:02:05Z',
        completedAt: '2025-01-14T14:02:10Z',
      },
      {
        id: 'tool-006',
        name: 'create_task',
        arguments: { title: 'Add error boundaries to Kanban' },
        result: 'Task created: task-014',
        status: 'completed',
        startedAt: '2025-01-14T14:02:12Z',
        completedAt: '2025-01-14T14:02:17Z',
      },
    ],
  },
];

/**
 * Mock chat sessions data - 3 sessions with varied conversations
 */
const mockSessions: ChatSession[] = [
  {
    id: 'session-001',
    name: 'Architecture Discussion',
    projectId: 'project-001',
    messages: mockSession1Messages,
    isActive: true,
    claudeProfileId: 'profile-default',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:01:20Z',
    lastMessageAt: '2025-01-15T10:01:20Z',
    messageCount: 4,
    totalTokens: 407,
  },
  {
    id: 'session-002',
    name: 'Memory Leak Investigation',
    projectId: 'project-001',
    messages: mockSession2Messages,
    isActive: false,
    claudeProfileId: 'profile-debug',
    createdAt: '2025-01-16T09:00:00Z',
    updatedAt: '2025-01-16T09:00:45Z',
    lastMessageAt: '2025-01-16T09:00:45Z',
    messageCount: 3,
    totalTokens: 444,
  },
  {
    id: 'session-003',
    name: 'KanbanBoard Code Review',
    projectId: 'project-001',
    messages: mockSession3Messages,
    isActive: false,
    claudeProfileId: 'profile-reviewer',
    createdAt: '2025-01-14T14:00:00Z',
    updatedAt: '2025-01-14T14:02:30Z',
    lastMessageAt: '2025-01-14T14:02:30Z',
    messageCount: 4,
    totalTokens: 497,
  },
];

/**
 * Chat Store State Interface
 */
interface ChatState {
  /** All chat sessions in the store */
  sessions: ChatSession[];

  /** Currently active session ID */
  currentSessionId: string | null;

  /** Active filters applied to the session list */
  filters: ChatSessionFilters;

  /** Whether a message is currently being streamed */
  isStreaming: boolean;

  /** Loading state for async operations */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;
}

/**
 * Chat Store Actions Interface
 */
interface ChatActions {
  /** Create a new chat session */
  createSession: (input?: ChatSessionCreateInput) => ChatSession;

  /** Switch to a different session */
  switchSession: (sessionId: string) => void;

  /** Rename a session */
  renameSession: (sessionId: string, newName: string) => void;

  /** Update session settings */
  updateSession: (sessionId: string, updates: ChatSessionUpdateInput) => void;

  /** Delete a session */
  deleteSession: (sessionId: string) => void;

  /** Get a session by ID */
  getSessionById: (id: string) => ChatSession | undefined;

  /** Get the current active session */
  getCurrentSession: () => ChatSession | undefined;

  /** Add a user message to the current session */
  addMessage: (content: string, role?: MessageRole) => ChatMessage | undefined;

  /** Update a message (for streaming) */
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;

  /** Add a tool call to a message */
  addToolCall: (messageId: string, toolCall: ToolCall) => void;

  /** Update tool call status */
  updateToolCall: (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => void;

  /** Start streaming response (creates placeholder assistant message) */
  startStreamingResponse: () => ChatMessage | undefined;

  /** Update streaming content */
  updateStreamingContent: (content: string) => void;

  /** Complete streaming response */
  completeStreamingResponse: (finalContent: string, tokenCount?: number) => void;

  /** Set streaming state */
  setStreaming: (isStreaming: boolean) => void;

  /** Set filters */
  setFilters: (filters: ChatSessionFilters) => void;

  /** Clear all filters */
  clearFilters: () => void;

  /** Get filtered sessions */
  getFilteredSessions: () => ChatSession[];

  /** Get sessions by project */
  getSessionsByProject: (projectId: string) => ChatSession[];

  /** Clear all messages in current session */
  clearSessionMessages: (sessionId: string) => void;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error message */
  setError: (error: string | null) => void;

  /** Reset store to initial state (with mock data) */
  resetStore: () => void;
}

/**
 * Combined Chat Store Type
 */
type ChatStore = ChatState & ChatActions;

/**
 * Initial state for the store
 */
const initialState: ChatState = {
  sessions: mockSessions,
  currentSessionId: 'session-001', // Default to first session
  filters: {},
  isStreaming: false,
  isLoading: false,
  error: null,
};

/**
 * Chat Store
 * Zustand store with persist middleware for AsyncStorage persistence
 */
export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      createSession: (input?: ChatSessionCreateInput): ChatSession => {
        const newSession: ChatSession = {
          id: generateId('session'),
          name: input?.name || `New Session ${get().sessions.length + 1}`,
          projectId: input?.projectId,
          messages: [],
          isActive: true,
          claudeProfileId: input?.claudeProfileId || 'profile-default',
          systemPrompt: input?.systemPrompt,
          createdAt: now(),
          updatedAt: now(),
          messageCount: 0,
          totalTokens: 0,
        };

        set((state) => ({
          sessions: [
            ...state.sessions.map((s) => ({ ...s, isActive: false })),
            newSession,
          ],
          currentSessionId: newSession.id,
        }));

        return newSession;
      },

      switchSession: (sessionId: string): void => {
        const session = get().getSessionById(sessionId);
        if (!session) return;

        set((state) => ({
          currentSessionId: sessionId,
          sessions: state.sessions.map((s) => ({
            ...s,
            isActive: s.id === sessionId,
          })),
          isStreaming: false, // Stop any ongoing streaming
        }));
      },

      renameSession: (sessionId: string, newName: string): void => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, name: newName, updatedAt: now() }
              : session
          ),
        }));
      },

      updateSession: (sessionId: string, updates: ChatSessionUpdateInput): void => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, ...updates, updatedAt: now() }
              : session
          ),
        }));
      },

      deleteSession: (sessionId: string): void => {
        const { sessions, currentSessionId } = get();

        // Don't delete the last session
        if (sessions.length <= 1) {
          get().setError('Cannot delete the last session');
          return;
        }

        // Find next session to switch to if current is being deleted
        let nextSessionId = currentSessionId;
        if (currentSessionId === sessionId) {
          const otherSessions = sessions.filter((s) => s.id !== sessionId);
          nextSessionId = otherSessions[0]?.id || null;
        }

        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== sessionId),
          currentSessionId: nextSessionId,
          isStreaming: false,
        }));

        // Make sure a session is active
        if (nextSessionId) {
          get().switchSession(nextSessionId);
        }
      },

      getSessionById: (id: string): ChatSession | undefined => {
        return get().sessions.find((session) => session.id === id);
      },

      getCurrentSession: (): ChatSession | undefined => {
        const { sessions, currentSessionId } = get();
        if (!currentSessionId) return undefined;
        return sessions.find((session) => session.id === currentSessionId);
      },

      addMessage: (content: string, role: MessageRole = 'user'): ChatMessage | undefined => {
        const { currentSessionId } = get();
        if (!currentSessionId) return undefined;

        const newMessage: ChatMessage = {
          id: generateId('msg'),
          role,
          content,
          status: 'complete',
          createdAt: now(),
          completedAt: now(),
          tokenCount: Math.ceil(content.length / 4), // Rough token estimate
        };

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === currentSessionId
              ? {
                  ...session,
                  messages: [...session.messages, newMessage],
                  messageCount: session.messageCount + 1,
                  totalTokens: (session.totalTokens || 0) + (newMessage.tokenCount || 0),
                  updatedAt: now(),
                  lastMessageAt: now(),
                }
              : session
          ),
        }));

        return newMessage;
      },

      updateMessage: (messageId: string, updates: Partial<ChatMessage>): void => {
        const { currentSessionId } = get();
        if (!currentSessionId) return;

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === currentSessionId
              ? {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, ...updates } : msg
                  ),
                  updatedAt: now(),
                }
              : session
          ),
        }));
      },

      addToolCall: (messageId: string, toolCall: ToolCall): void => {
        const { currentSessionId } = get();
        if (!currentSessionId) return;

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === currentSessionId
              ? {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === messageId
                      ? {
                          ...msg,
                          toolCalls: [...(msg.toolCalls || []), toolCall],
                        }
                      : msg
                  ),
                  updatedAt: now(),
                }
              : session
          ),
        }));
      },

      updateToolCall: (
        messageId: string,
        toolCallId: string,
        updates: Partial<ToolCall>
      ): void => {
        const { currentSessionId } = get();
        if (!currentSessionId) return;

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === currentSessionId
              ? {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === messageId
                      ? {
                          ...msg,
                          toolCalls: msg.toolCalls?.map((tc) =>
                            tc.id === toolCallId ? { ...tc, ...updates } : tc
                          ),
                        }
                      : msg
                  ),
                  updatedAt: now(),
                }
              : session
          ),
        }));
      },

      startStreamingResponse: (): ChatMessage | undefined => {
        const { currentSessionId } = get();
        if (!currentSessionId) return undefined;

        const streamingMessage: ChatMessage = {
          id: generateId('msg'),
          role: 'assistant',
          content: '',
          status: 'streaming',
          isStreaming: true,
          streamedContent: '',
          createdAt: now(),
        };

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === currentSessionId
              ? {
                  ...session,
                  messages: [...session.messages, streamingMessage],
                  messageCount: session.messageCount + 1,
                  updatedAt: now(),
                }
              : session
          ),
          isStreaming: true,
        }));

        return streamingMessage;
      },

      updateStreamingContent: (content: string): void => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return;

        const currentSession = sessions.find((s) => s.id === currentSessionId);
        if (!currentSession) return;

        // Find the last streaming message
        const streamingMsgIndex = currentSession.messages.findIndex(
          (msg) => msg.status === 'streaming' && msg.isStreaming
        );
        if (streamingMsgIndex === -1) return;

        const streamingMsgId = currentSession.messages[streamingMsgIndex].id;

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === currentSessionId
              ? {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === streamingMsgId
                      ? {
                          ...msg,
                          content,
                          streamedContent: content,
                        }
                      : msg
                  ),
                  updatedAt: now(),
                }
              : session
          ),
        }));
      },

      completeStreamingResponse: (finalContent: string, tokenCount?: number): void => {
        const { currentSessionId, sessions } = get();
        if (!currentSessionId) return;

        const currentSession = sessions.find((s) => s.id === currentSessionId);
        if (!currentSession) return;

        // Find the streaming message
        const streamingMsg = currentSession.messages.find(
          (msg) => msg.status === 'streaming' && msg.isStreaming
        );
        if (!streamingMsg) return;

        const estimatedTokens = tokenCount || Math.ceil(finalContent.length / 4);

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === currentSessionId
              ? {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === streamingMsg.id
                      ? {
                          ...msg,
                          content: finalContent,
                          streamedContent: undefined,
                          status: 'complete' as MessageStatus,
                          isStreaming: false,
                          completedAt: now(),
                          tokenCount: estimatedTokens,
                        }
                      : msg
                  ),
                  totalTokens: (session.totalTokens || 0) + estimatedTokens,
                  updatedAt: now(),
                  lastMessageAt: now(),
                }
              : session
          ),
          isStreaming: false,
        }));
      },

      setStreaming: (isStreaming: boolean): void => {
        set({ isStreaming });
      },

      setFilters: (filters: ChatSessionFilters): void => {
        set({ filters });
      },

      clearFilters: (): void => {
        set({ filters: {} });
      },

      getFilteredSessions: (): ChatSession[] => {
        const { sessions, filters } = get();

        return sessions.filter((session) => {
          // Project filter
          if (filters.projectId) {
            if (session.projectId !== filters.projectId) return false;
          }

          // Active filter
          if (filters.isActive !== undefined) {
            if (session.isActive !== filters.isActive) return false;
          }

          // Search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const matchesName = session.name.toLowerCase().includes(searchLower);
            const matchesMessages = session.messages.some((msg) =>
              msg.content.toLowerCase().includes(searchLower)
            );
            if (!matchesName && !matchesMessages) {
              return false;
            }
          }

          return true;
        });
      },

      getSessionsByProject: (projectId: string): ChatSession[] => {
        return get().sessions.filter((session) => session.projectId === projectId);
      },

      clearSessionMessages: (sessionId: string): void => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: [],
                  messageCount: 0,
                  totalTokens: 0,
                  updatedAt: now(),
                  lastMessageAt: undefined,
                }
              : session
          ),
        }));
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
      name: 'autoclaude-chat-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist sessions, not UI state
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);

/**
 * Selector hooks for common use cases
 */

/** Get the current active session */
export const useCurrentSession = (): ChatSession | undefined => {
  const { sessions, currentSessionId } = useChatStore();
  return sessions.find((session) => session.id === currentSessionId);
};

/** Get messages from the current session */
export const useCurrentMessages = (): ChatMessage[] => {
  const currentSession = useCurrentSession();
  return currentSession?.messages || [];
};

/** Get total session count */
export const useSessionCount = (): number => {
  return useChatStore((state) => state.sessions.length);
};

/** Get sessions sorted by last message time */
export const useRecentSessions = (): ChatSession[] => {
  const sessions = useChatStore((state) => state.sessions);
  return [...sessions].sort((a, b) => {
    const aTime = a.lastMessageAt || a.updatedAt;
    const bTime = b.lastMessageAt || b.updatedAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
};

/** Check if currently streaming a response */
export const useIsStreaming = (): boolean => {
  return useChatStore((state) => state.isStreaming);
};

/** Get the last streaming message if any */
export const useStreamingMessage = (): ChatMessage | undefined => {
  const currentSession = useCurrentSession();
  if (!currentSession) return undefined;
  return currentSession.messages.find(
    (msg) => msg.status === 'streaming' && msg.isStreaming
  );
};
