/**
 * Terminal Store
 * Zustand store for terminal sessions (read-only viewer)
 * Uses persist middleware with AsyncStorage for display preferences
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  TerminalSession,
  TerminalOutputLine,
  TerminalStatus,
  TerminalFilters,
  TerminalScrollState,
  TerminalDisplaySettings,
  OutputLineType,
} from '../types';
import { defaultTerminalDisplaySettings } from '../types';

/**
 * Generate unique ID
 */
const generateId = (): string => {
  return `line-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Mock terminal output lines for session 1 (Task execution)
 */
const mockSession1Output: TerminalOutputLine[] = [
  {
    id: 'line-001',
    type: 'system',
    content: '=== AutoClaude Task Execution Started ===',
    timestamp: '2025-01-16T14:00:00Z',
  },
  {
    id: 'line-002',
    type: 'info',
    content: 'Task: Build notification service',
    timestamp: '2025-01-16T14:00:01Z',
  },
  {
    id: 'line-003',
    type: 'command',
    content: '$ npm install @react-native-firebase/messaging',
    timestamp: '2025-01-16T14:00:05Z',
  },
  {
    id: 'line-004',
    type: 'stdout',
    content: 'npm WARN deprecated uuid@3.4.0: Please upgrade to version 7 or higher',
    timestamp: '2025-01-16T14:00:08Z',
  },
  {
    id: 'line-005',
    type: 'stdout',
    content: '',
    timestamp: '2025-01-16T14:00:09Z',
  },
  {
    id: 'line-006',
    type: 'stdout',
    content: 'added 15 packages, and audited 1247 packages in 12s',
    timestamp: '2025-01-16T14:00:15Z',
  },
  {
    id: 'line-007',
    type: 'stdout',
    content: '',
    timestamp: '2025-01-16T14:00:15Z',
  },
  {
    id: 'line-008',
    type: 'stdout',
    content: '45 packages are looking for funding',
    timestamp: '2025-01-16T14:00:16Z',
  },
  {
    id: 'line-009',
    type: 'stdout',
    content: '  run `npm fund` for details',
    timestamp: '2025-01-16T14:00:16Z',
  },
  {
    id: 'line-010',
    type: 'info',
    content: '[Claude] Creating notification service module...',
    timestamp: '2025-01-16T14:00:20Z',
  },
  {
    id: 'line-011',
    type: 'stdout',
    content: 'Writing: utils/notifications.ts',
    timestamp: '2025-01-16T14:00:25Z',
  },
  {
    id: 'line-012',
    type: 'stdout',
    content: 'Writing: types/notification.ts',
    timestamp: '2025-01-16T14:00:27Z',
  },
  {
    id: 'line-013',
    type: 'info',
    content: '[Claude] Running TypeScript type check...',
    timestamp: '2025-01-16T14:00:30Z',
  },
  {
    id: 'line-014',
    type: 'command',
    content: '$ npx tsc --noEmit',
    timestamp: '2025-01-16T14:00:31Z',
  },
  {
    id: 'line-015',
    type: 'stdout',
    content: 'Checking TypeScript files...',
    timestamp: '2025-01-16T14:00:35Z',
  },
  {
    id: 'line-016',
    type: 'stdout',
    content: 'No errors found.',
    timestamp: '2025-01-16T14:00:42Z',
  },
  {
    id: 'line-017',
    type: 'info',
    content: '[Claude] Running tests...',
    timestamp: '2025-01-16T14:00:45Z',
  },
  {
    id: 'line-018',
    type: 'command',
    content: '$ npm test -- --coverage',
    timestamp: '2025-01-16T14:00:46Z',
  },
  {
    id: 'line-019',
    type: 'stdout',
    content: 'PASS  utils/__tests__/notifications.test.ts',
    timestamp: '2025-01-16T14:01:00Z',
  },
  {
    id: 'line-020',
    type: 'stdout',
    content: '  NotificationService',
    timestamp: '2025-01-16T14:01:01Z',
  },
  {
    id: 'line-021',
    type: 'stdout',
    content: '    \u2713 should request permission (45 ms)',
    timestamp: '2025-01-16T14:01:01Z',
  },
  {
    id: 'line-022',
    type: 'stdout',
    content: '    \u2713 should send push notification (23 ms)',
    timestamp: '2025-01-16T14:01:01Z',
  },
  {
    id: 'line-023',
    type: 'stdout',
    content: '    \u2713 should handle notification tap (12 ms)',
    timestamp: '2025-01-16T14:01:02Z',
  },
];

/**
 * Mock terminal output lines for session 2 (Memory leak investigation)
 */
const mockSession2Output: TerminalOutputLine[] = [
  {
    id: 'line-101',
    type: 'system',
    content: '=== AutoClaude Investigation Started ===',
    timestamp: '2025-01-16T10:00:00Z',
  },
  {
    id: 'line-102',
    type: 'info',
    content: 'Issue: Memory leak when switching between chat sessions rapidly',
    timestamp: '2025-01-16T10:00:01Z',
  },
  {
    id: 'line-103',
    type: 'info',
    content: '[Claude] Analyzing chat component lifecycle...',
    timestamp: '2025-01-16T10:00:05Z',
  },
  {
    id: 'line-104',
    type: 'command',
    content: '$ grep -r "useEffect" components/Chat*',
    timestamp: '2025-01-16T10:00:10Z',
  },
  {
    id: 'line-105',
    type: 'stdout',
    content: 'components/ChatMessage.tsx:  useEffect(() => {',
    timestamp: '2025-01-16T10:00:11Z',
  },
  {
    id: 'line-106',
    type: 'stdout',
    content: 'components/ChatSession.tsx:  useEffect(() => {',
    timestamp: '2025-01-16T10:00:11Z',
  },
  {
    id: 'line-107',
    type: 'stdout',
    content: 'components/ChatInput.tsx:  useEffect(() => {',
    timestamp: '2025-01-16T10:00:11Z',
  },
  {
    id: 'line-108',
    type: 'warning',
    content: '[Claude] Found potential issue: Missing cleanup in ChatSession.tsx useEffect',
    timestamp: '2025-01-16T10:00:20Z',
  },
  {
    id: 'line-109',
    type: 'info',
    content: '[Claude] Checking WebSocket subscriptions...',
    timestamp: '2025-01-16T10:00:25Z',
  },
  {
    id: 'line-110',
    type: 'command',
    content: '$ grep -rn "subscribe" stores/chatStore.ts',
    timestamp: '2025-01-16T10:00:26Z',
  },
  {
    id: 'line-111',
    type: 'stdout',
    content: '45:    wsClient.subscribe(sessionId, (message) => {',
    timestamp: '2025-01-16T10:00:27Z',
  },
  {
    id: 'line-112',
    type: 'error',
    content: '[Claude] FOUND: WebSocket subscription in chatStore not unsubscribed on session change',
    timestamp: '2025-01-16T10:00:35Z',
  },
  {
    id: 'line-113',
    type: 'info',
    content: '[Claude] Preparing fix...',
    timestamp: '2025-01-16T10:00:40Z',
  },
  {
    id: 'line-114',
    type: 'stdout',
    content: 'Modifying: stores/chatStore.ts',
    timestamp: '2025-01-16T10:00:45Z',
  },
  {
    id: 'line-115',
    type: 'stdout',
    content: 'Modifying: components/ChatSession.tsx',
    timestamp: '2025-01-16T10:00:47Z',
  },
];

/**
 * Mock terminal output lines for session 3 (CI/CD run)
 */
const mockSession3Output: TerminalOutputLine[] = [
  {
    id: 'line-201',
    type: 'system',
    content: '=== GitHub Actions Workflow: CI/CD ===',
    timestamp: '2025-01-15T09:00:00Z',
  },
  {
    id: 'line-202',
    type: 'info',
    content: 'Trigger: Push to branch feature/kanban-dnd',
    timestamp: '2025-01-15T09:00:01Z',
  },
  {
    id: 'line-203',
    type: 'info',
    content: 'Job: test (node 18.x)',
    timestamp: '2025-01-15T09:00:05Z',
  },
  {
    id: 'line-204',
    type: 'command',
    content: '$ npm ci',
    timestamp: '2025-01-15T09:00:10Z',
  },
  {
    id: 'line-205',
    type: 'stdout',
    content: 'npm WARN deprecated @npmcli/move-file@2.0.1: This functionality has been moved to @npmcli/fs',
    timestamp: '2025-01-15T09:00:45Z',
  },
  {
    id: 'line-206',
    type: 'stdout',
    content: 'added 1234 packages in 35s',
    timestamp: '2025-01-15T09:00:50Z',
  },
  {
    id: 'line-207',
    type: 'command',
    content: '$ npm run lint',
    timestamp: '2025-01-15T09:01:00Z',
  },
  {
    id: 'line-208',
    type: 'stderr',
    content: '',
    timestamp: '2025-01-15T09:01:15Z',
  },
  {
    id: 'line-209',
    type: 'error',
    content: '/home/runner/work/app/components/KanbanColumn.tsx',
    timestamp: '2025-01-15T09:01:16Z',
  },
  {
    id: 'line-210',
    type: 'error',
    content: '  42:15  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any',
    timestamp: '2025-01-15T09:01:16Z',
  },
  {
    id: 'line-211',
    type: 'error',
    content: '  67:23  error  Missing return type on function  @typescript-eslint/explicit-function-return-type',
    timestamp: '2025-01-15T09:01:16Z',
  },
  {
    id: 'line-212',
    type: 'stdout',
    content: '',
    timestamp: '2025-01-15T09:01:17Z',
  },
  {
    id: 'line-213',
    type: 'error',
    content: '\u2716 2 problems (2 errors, 0 warnings)',
    timestamp: '2025-01-15T09:01:18Z',
  },
  {
    id: 'line-214',
    type: 'system',
    content: 'Job failed: lint check failed',
    timestamp: '2025-01-15T09:01:20Z',
  },
];

/**
 * Mock terminal output for session 4 (Idle session with recent activity)
 */
const mockSession4Output: TerminalOutputLine[] = [
  {
    id: 'line-301',
    type: 'system',
    content: '=== AutoClaude Task Execution Started ===',
    timestamp: '2025-01-14T16:00:00Z',
  },
  {
    id: 'line-302',
    type: 'info',
    content: 'Task: Set up CI/CD pipeline',
    timestamp: '2025-01-14T16:00:01Z',
  },
  {
    id: 'line-303',
    type: 'command',
    content: '$ mkdir -p .github/workflows',
    timestamp: '2025-01-14T16:00:05Z',
  },
  {
    id: 'line-304',
    type: 'info',
    content: '[Claude] Creating workflow file...',
    timestamp: '2025-01-14T16:00:10Z',
  },
  {
    id: 'line-305',
    type: 'stdout',
    content: 'Writing: .github/workflows/ci.yml',
    timestamp: '2025-01-14T16:00:15Z',
  },
  {
    id: 'line-306',
    type: 'stdout',
    content: 'Writing: .github/workflows/deploy.yml',
    timestamp: '2025-01-14T16:00:17Z',
  },
  {
    id: 'line-307',
    type: 'info',
    content: '[Claude] Configuring repository secrets...',
    timestamp: '2025-01-14T16:00:20Z',
  },
  {
    id: 'line-308',
    type: 'stdout',
    content: 'Required secrets: EXPO_TOKEN, APP_STORE_CONNECT_API_KEY',
    timestamp: '2025-01-14T16:00:22Z',
  },
  {
    id: 'line-309',
    type: 'info',
    content: '[Claude] Committing changes...',
    timestamp: '2025-01-14T16:00:30Z',
  },
  {
    id: 'line-310',
    type: 'command',
    content: '$ git add . && git commit -m "chore: add CI/CD workflows"',
    timestamp: '2025-01-14T16:00:31Z',
  },
  {
    id: 'line-311',
    type: 'stdout',
    content: '[feature/ci-cd 3a2b1c0] chore: add CI/CD workflows',
    timestamp: '2025-01-14T16:00:35Z',
  },
  {
    id: 'line-312',
    type: 'stdout',
    content: ' 2 files changed, 145 insertions(+)',
    timestamp: '2025-01-14T16:00:35Z',
  },
  {
    id: 'line-313',
    type: 'system',
    content: '=== Task Completed Successfully ===',
    timestamp: '2025-01-14T16:00:40Z',
  },
];

/**
 * Mock terminal sessions (3+)
 */
const mockSessions: TerminalSession[] = [
  {
    id: 'terminal-001',
    name: 'Task: Build notification service',
    status: 'active',
    process: {
      pid: 12345,
      command: 'node',
      args: ['autoclaude-runner.js', '--task', 'task-004'],
      cwd: '/workspace/autoclaude/companion-app',
      startedAt: '2025-01-16T14:00:00Z',
    },
    currentCommand: 'npm test -- --coverage',
    output: mockSession1Output,
    outputLineCount: mockSession1Output.length,
    maxBufferLines: 1000,
    taskId: 'task-004',
    taskTitle: 'Build notification service',
    createdAt: '2025-01-16T14:00:00Z',
    updatedAt: '2025-01-16T14:01:02Z',
    lastActivityAt: '2025-01-16T14:01:02Z',
    fontSize: 14,
    wordWrap: false,
  },
  {
    id: 'terminal-002',
    name: 'Investigation: Memory leak',
    status: 'active',
    process: {
      pid: 23456,
      command: 'node',
      args: ['autoclaude-runner.js', '--investigate', 'issue-001'],
      cwd: '/workspace/autoclaude/companion-app',
      startedAt: '2025-01-16T10:00:00Z',
    },
    currentCommand: 'Analyzing code...',
    output: mockSession2Output,
    outputLineCount: mockSession2Output.length,
    maxBufferLines: 1000,
    taskId: 'task-005',
    taskTitle: 'Fix memory leak in chat component',
    createdAt: '2025-01-16T10:00:00Z',
    updatedAt: '2025-01-16T10:00:47Z',
    lastActivityAt: '2025-01-16T10:00:47Z',
    fontSize: 14,
    wordWrap: true,
  },
  {
    id: 'terminal-003',
    name: 'CI/CD: feature/kanban-dnd',
    status: 'error',
    process: {
      pid: 34567,
      command: 'gh',
      args: ['run', 'watch', '12345678'],
      cwd: '/workspace/autoclaude/companion-app',
      startedAt: '2025-01-15T09:00:00Z',
      exitCode: 1,
      exitedAt: '2025-01-15T09:01:20Z',
    },
    output: mockSession3Output,
    outputLineCount: mockSession3Output.length,
    maxBufferLines: 1000,
    createdAt: '2025-01-15T09:00:00Z',
    updatedAt: '2025-01-15T09:01:20Z',
    lastActivityAt: '2025-01-15T09:01:20Z',
    fontSize: 14,
    wordWrap: false,
  },
  {
    id: 'terminal-004',
    name: 'Task: Set up CI/CD pipeline',
    status: 'closed',
    process: {
      pid: 45678,
      command: 'node',
      args: ['autoclaude-runner.js', '--task', 'task-011'],
      cwd: '/workspace/autoclaude/companion-app',
      startedAt: '2025-01-14T16:00:00Z',
      exitCode: 0,
      exitedAt: '2025-01-14T16:00:40Z',
    },
    output: mockSession4Output,
    outputLineCount: mockSession4Output.length,
    maxBufferLines: 1000,
    taskId: 'task-011',
    taskTitle: 'Set up CI/CD pipeline',
    createdAt: '2025-01-14T16:00:00Z',
    updatedAt: '2025-01-14T16:00:40Z',
    lastActivityAt: '2025-01-14T16:00:40Z',
    fontSize: 14,
    wordWrap: false,
  },
];

/**
 * Terminal Store State Interface
 */
interface TerminalState {
  /** All terminal sessions */
  sessions: TerminalSession[];

  /** Currently selected session ID */
  selectedSessionId: string | null;

  /** Terminal filters */
  filters: TerminalFilters;

  /** Scroll states for each session */
  scrollStates: TerminalScrollState[];

  /** Display settings */
  displaySettings: TerminalDisplaySettings;

  /** Loading state */
  isLoading: boolean;

  /** Error message */
  error: string | null;
}

/**
 * Terminal Store Actions Interface
 */
interface TerminalActions {
  /** Select a terminal session */
  selectSession: (id: string | null) => void;

  /** Get session by ID */
  getSessionById: (id: string) => TerminalSession | undefined;

  /** Get sessions by status */
  getSessionsByStatus: (status: TerminalStatus) => TerminalSession[];

  /** Get session by task ID */
  getSessionByTaskId: (taskId: string) => TerminalSession | undefined;

  /** Add output line to session */
  addOutputLine: (sessionId: string, line: Omit<TerminalOutputLine, 'id'>) => void;

  /** Clear session output */
  clearSessionOutput: (sessionId: string) => void;

  /** Update session status */
  updateSessionStatus: (sessionId: string, status: TerminalStatus) => void;

  /** Update session */
  updateSession: (sessionId: string, updates: Partial<TerminalSession>) => void;

  /** Set filters */
  setFilters: (filters: TerminalFilters) => void;

  /** Clear filters */
  clearFilters: () => void;

  /** Get filtered sessions */
  getFilteredSessions: () => TerminalSession[];

  /** Update scroll state */
  updateScrollState: (sessionId: string, state: Partial<TerminalScrollState>) => void;

  /** Get scroll state */
  getScrollState: (sessionId: string) => TerminalScrollState | undefined;

  /** Update display settings */
  updateDisplaySettings: (settings: Partial<TerminalDisplaySettings>) => void;

  /** Reset display settings */
  resetDisplaySettings: () => void;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error */
  setError: (error: string | null) => void;

  /** Reset store */
  resetStore: () => void;

  /** Get active session count */
  getActiveSessionCount: () => number;

  /** Get session summary list */
  getSessionSummaries: () => Array<{
    id: string;
    name: string;
    status: TerminalStatus;
    taskId?: string;
    taskTitle?: string;
    lastCommand?: string;
    lastActivityAt?: string;
    outputLineCount: number;
  }>;

  /** Simulate adding output (for mock real-time updates) */
  simulateOutput: (sessionId: string, type: OutputLineType, content: string) => void;
}

/**
 * Combined Terminal Store Type
 */
type TerminalStore = TerminalState & TerminalActions;

/**
 * Initial state
 */
const initialState: TerminalState = {
  sessions: mockSessions,
  selectedSessionId: null,
  filters: {},
  scrollStates: mockSessions.map((s) => ({
    sessionId: s.id,
    scrollPosition: 0,
    isAutoScrollEnabled: true,
  })),
  displaySettings: defaultTerminalDisplaySettings,
  isLoading: false,
  error: null,
};

/**
 * Terminal Store
 */
export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      selectSession: (id: string | null): void => {
        set({ selectedSessionId: id });
      },

      getSessionById: (id: string): TerminalSession | undefined => {
        return get().sessions.find((session) => session.id === id);
      },

      getSessionsByStatus: (status: TerminalStatus): TerminalSession[] => {
        return get().sessions.filter((session) => session.status === status);
      },

      getSessionByTaskId: (taskId: string): TerminalSession | undefined => {
        return get().sessions.find((session) => session.taskId === taskId);
      },

      addOutputLine: (sessionId: string, line: Omit<TerminalOutputLine, 'id'>): void => {
        const newLine: TerminalOutputLine = {
          ...line,
          id: generateId(),
        };

        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;

            const newOutput = [...session.output, newLine];
            // Trim if exceeds max buffer
            const trimmedOutput =
              newOutput.length > session.maxBufferLines
                ? newOutput.slice(-session.maxBufferLines)
                : newOutput;

            return {
              ...session,
              output: trimmedOutput,
              outputLineCount: trimmedOutput.length,
              updatedAt: new Date().toISOString(),
              lastActivityAt: new Date().toISOString(),
            };
          }),
        }));
      },

      clearSessionOutput: (sessionId: string): void => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  output: [],
                  outputLineCount: 0,
                  updatedAt: new Date().toISOString(),
                }
              : session
          ),
        }));
      },

      updateSessionStatus: (sessionId: string, status: TerminalStatus): void => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  status,
                  updatedAt: new Date().toISOString(),
                  lastActivityAt: new Date().toISOString(),
                }
              : session
          ),
        }));
      },

      updateSession: (sessionId: string, updates: Partial<TerminalSession>): void => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                }
              : session
          ),
        }));
      },

      setFilters: (filters: TerminalFilters): void => {
        set({ filters });
      },

      clearFilters: (): void => {
        set({ filters: {} });
      },

      getFilteredSessions: (): TerminalSession[] => {
        const { sessions, filters } = get();

        return sessions.filter((session) => {
          // Status filter
          if (filters.status && filters.status.length > 0) {
            if (!filters.status.includes(session.status)) return false;
          }

          // Task filter
          if (filters.taskId) {
            if (session.taskId !== filters.taskId) return false;
          }

          // Search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const matchesName = session.name.toLowerCase().includes(searchLower);
            const matchesTask = session.taskTitle
              ?.toLowerCase()
              .includes(searchLower);
            const matchesOutput = session.output.some((line) =>
              line.content.toLowerCase().includes(searchLower)
            );
            if (!matchesName && !matchesTask && !matchesOutput) return false;
          }

          return true;
        });
      },

      updateScrollState: (
        sessionId: string,
        state: Partial<TerminalScrollState>
      ): void => {
        set((currentState) => {
          const existing = currentState.scrollStates.find(
            (s) => s.sessionId === sessionId
          );
          if (existing) {
            return {
              scrollStates: currentState.scrollStates.map((s) =>
                s.sessionId === sessionId ? { ...s, ...state } : s
              ),
            };
          }
          return {
            scrollStates: [
              ...currentState.scrollStates,
              {
                sessionId,
                scrollPosition: 0,
                isAutoScrollEnabled: true,
                ...state,
              },
            ],
          };
        });
      },

      getScrollState: (sessionId: string): TerminalScrollState | undefined => {
        return get().scrollStates.find((s) => s.sessionId === sessionId);
      },

      updateDisplaySettings: (settings: Partial<TerminalDisplaySettings>): void => {
        set((state) => ({
          displaySettings: { ...state.displaySettings, ...settings },
        }));
      },

      resetDisplaySettings: (): void => {
        set({ displaySettings: defaultTerminalDisplaySettings });
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

      getActiveSessionCount: (): number => {
        return get().sessions.filter((s) => s.status === 'active').length;
      },

      getSessionSummaries: () => {
        return get().sessions.map((session) => ({
          id: session.id,
          name: session.name,
          status: session.status,
          taskId: session.taskId,
          taskTitle: session.taskTitle,
          lastCommand: session.currentCommand,
          lastActivityAt: session.lastActivityAt,
          outputLineCount: session.outputLineCount,
        }));
      },

      simulateOutput: (
        sessionId: string,
        type: OutputLineType,
        content: string
      ): void => {
        get().addOutputLine(sessionId, {
          type,
          content,
          timestamp: new Date().toISOString(),
        });
      },
    }),
    {
      name: 'autoclaude-terminal-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist display settings and scroll states
      partialize: (state) => ({
        displaySettings: state.displaySettings,
        scrollStates: state.scrollStates,
        filters: state.filters,
      }),
    }
  )
);

/**
 * Selector hooks
 */

/** Get the currently selected session */
export const useSelectedSession = (): TerminalSession | undefined => {
  const { sessions, selectedSessionId } = useTerminalStore();
  return sessions.find((session) => session.id === selectedSessionId);
};

/** Get the output lines for the selected session */
export const useSelectedSessionOutput = (): TerminalOutputLine[] => {
  const { sessions, selectedSessionId } = useTerminalStore();
  const session = sessions.find((s) => s.id === selectedSessionId);
  return session?.output ?? [];
};

/** Get active session count */
export const useActiveSessionCount = (): number => {
  return useTerminalStore((state) =>
    state.sessions.filter((s) => s.status === 'active').length
  );
};

/** Get total session count */
export const useTotalSessionCount = (): number => {
  return useTerminalStore((state) => state.sessions.length);
};

/** Get session counts by status */
export const useSessionCounts = (): Record<TerminalStatus, number> => {
  const sessions = useTerminalStore((state) => state.sessions);
  return {
    active: sessions.filter((s) => s.status === 'active').length,
    idle: sessions.filter((s) => s.status === 'idle').length,
    closed: sessions.filter((s) => s.status === 'closed').length,
    error: sessions.filter((s) => s.status === 'error').length,
  };
};

/** Get display settings */
export const useTerminalDisplaySettings = (): TerminalDisplaySettings => {
  return useTerminalStore((state) => state.displaySettings);
};

/** Check if auto-scroll is enabled for a session */
export const useIsAutoScrollEnabled = (sessionId: string): boolean => {
  const scrollState = useTerminalStore((state) =>
    state.scrollStates.find((s) => s.sessionId === sessionId)
  );
  return scrollState?.isAutoScrollEnabled ?? true;
};
