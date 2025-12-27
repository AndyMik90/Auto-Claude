/**
 * Mock WebSocket Simulator
 *
 * This module provides mock real-time updates for development and testing.
 * It simulates WebSocket messages by:
 * - Periodically updating task statuses (Kanban movements)
 * - Adding terminal output lines to active sessions
 * - Simulating chat streaming responses
 *
 * Integrates with the WebSocket client's message handling system.
 */

import { wsClient } from '../api/websocket';
import { useTaskStore } from '../stores/taskStore';
import { useTerminalStore } from '../stores/terminalStore';
import { useChatStore } from '../stores/chatStore';
import type {
  TaskStatus,
  OutputLineType,
  WebSocketMessage,
} from '../types';

/**
 * Configuration for mock WebSocket simulation
 */
export interface MockWebSocketConfig {
  /** Enable mock task updates */
  enableTaskUpdates: boolean;
  /** Enable mock terminal output */
  enableTerminalOutput: boolean;
  /** Enable mock chat responses */
  enableChatResponses: boolean;
  /** Interval for task updates in milliseconds */
  taskUpdateInterval: number;
  /** Interval for terminal output in milliseconds */
  terminalOutputInterval: number;
  /** Minimum delay for chat response in milliseconds */
  chatResponseMinDelay: number;
  /** Maximum delay for chat response in milliseconds */
  chatResponseMaxDelay: number;
  /** Simulate connection state changes */
  simulateConnectionChanges: boolean;
}

/**
 * Default mock configuration
 */
const defaultConfig: MockWebSocketConfig = {
  enableTaskUpdates: true,
  enableTerminalOutput: true,
  enableChatResponses: true,
  taskUpdateInterval: 15000, // Every 15 seconds
  terminalOutputInterval: 3000, // Every 3 seconds
  chatResponseMinDelay: 500, // 500ms minimum
  chatResponseMaxDelay: 2000, // 2s maximum
  simulateConnectionChanges: false,
};

/**
 * Possible task status transitions for simulation
 */
const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ['in_progress'],
  in_progress: ['ai_review', 'human_review'],
  ai_review: ['human_review', 'in_progress', 'done'],
  human_review: ['done', 'in_progress'],
  done: [], // Terminal state
};

/**
 * Mock terminal output templates
 */
const TERMINAL_OUTPUT_TEMPLATES: Array<{
  type: OutputLineType;
  content: string;
}> = [
  { type: 'stdout', content: 'Processing file: src/components/*.tsx' },
  { type: 'stdout', content: 'Running type check...' },
  { type: 'info', content: '[Claude] Analyzing code structure...' },
  { type: 'stdout', content: 'Compiling TypeScript...' },
  { type: 'stdout', content: 'Build complete.' },
  { type: 'info', content: '[Claude] Generating test cases...' },
  { type: 'command', content: '$ npm test' },
  { type: 'stdout', content: 'PASS  __tests__/components.test.tsx' },
  { type: 'stdout', content: '  ✓ renders correctly (45 ms)' },
  { type: 'stdout', content: '  ✓ handles user input (23 ms)' },
  { type: 'info', content: '[Claude] Validating changes...' },
  { type: 'stdout', content: 'All checks passed.' },
  { type: 'warning', content: 'Warning: Deprecated API usage detected' },
  { type: 'info', content: '[Claude] Optimizing bundle size...' },
  { type: 'stdout', content: 'Bundle size: 245KB (gzip: 78KB)' },
  { type: 'system', content: '=== Task checkpoint saved ===' },
];

/**
 * Mock chat response phrases for streaming simulation
 */
const CHAT_RESPONSE_PHRASES = [
  "I'll analyze that for you.",
  'Looking at the code structure...',
  'Based on my analysis, I can see that',
  'The implementation follows the established patterns.',
  'Here are my recommendations:',
  'I found a few areas that could be improved.',
  'The code looks good overall.',
  "Let me explain the architecture here.",
  'This component handles the following responsibilities:',
  'I can help refactor this section.',
  'The tests cover most edge cases.',
  'Consider adding error handling here.',
];

/**
 * MockWebSocketManager Class
 *
 * Manages mock WebSocket message simulation for development.
 * Provides periodic updates to tasks, terminals, and chat.
 */
export class MockWebSocketManager {
  private config: MockWebSocketConfig;
  private isRunning: boolean = false;
  private taskUpdateTimer: ReturnType<typeof setInterval> | null = null;
  private terminalOutputTimer: ReturnType<typeof setInterval> | null = null;
  private connectionChangeTimer: ReturnType<typeof setInterval> | null = null;
  private activeStreamingSession: string | null = null;
  private streamingMessageId: string | null = null;

  constructor(config: Partial<MockWebSocketConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Start mock WebSocket simulation
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start task update simulation
    if (this.config.enableTaskUpdates) {
      this.startTaskUpdates();
    }

    // Start terminal output simulation
    if (this.config.enableTerminalOutput) {
      this.startTerminalOutput();
    }

    // Start connection state simulation
    if (this.config.simulateConnectionChanges) {
      this.startConnectionChanges();
    }
  }

  /**
   * Stop mock WebSocket simulation
   */
  stop(): void {
    this.isRunning = false;

    if (this.taskUpdateTimer) {
      clearInterval(this.taskUpdateTimer);
      this.taskUpdateTimer = null;
    }

    if (this.terminalOutputTimer) {
      clearInterval(this.terminalOutputTimer);
      this.terminalOutputTimer = null;
    }

    if (this.connectionChangeTimer) {
      clearInterval(this.connectionChangeTimer);
      this.connectionChangeTimer = null;
    }
  }

  /**
   * Check if simulation is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MockWebSocketConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart if running to apply new config
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Start task status update simulation
   */
  private startTaskUpdates(): void {
    this.taskUpdateTimer = setInterval(() => {
      this.simulateTaskUpdate();
    }, this.config.taskUpdateInterval);
  }

  /**
   * Simulate a task status update
   */
  private simulateTaskUpdate(): void {
    const taskStore = useTaskStore.getState();
    const tasks = taskStore.tasks;

    // Find tasks that can transition (not in 'done' status)
    const movableTasks = tasks.filter(
      (task) => TASK_TRANSITIONS[task.status].length > 0
    );

    if (movableTasks.length === 0) {
      return;
    }

    // Pick a random task to update
    const randomIndex = Math.floor(Math.random() * movableTasks.length);
    const taskToUpdate = movableTasks[randomIndex];

    // Pick a random valid transition
    const possibleStatuses = TASK_TRANSITIONS[taskToUpdate.status];
    const newStatus =
      possibleStatuses[Math.floor(Math.random() * possibleStatuses.length)];

    // Create WebSocket message
    const message: WebSocketMessage = {
      type: 'task_update',
      payload: {
        taskId: taskToUpdate.id,
        updates: {
          status: newStatus,
        },
      },
      timestamp: new Date().toISOString(),
    };

    // Route through WebSocket client's message handler
    wsClient.handleMessage(message);
  }

  /**
   * Start terminal output simulation
   */
  private startTerminalOutput(): void {
    this.terminalOutputTimer = setInterval(() => {
      this.simulateTerminalOutput();
    }, this.config.terminalOutputInterval);
  }

  /**
   * Simulate terminal output
   */
  private simulateTerminalOutput(): void {
    const terminalStore = useTerminalStore.getState();
    const activeSessions = terminalStore.getSessionsByStatus('active');

    if (activeSessions.length === 0) {
      return;
    }

    // Pick a random active session
    const randomIndex = Math.floor(Math.random() * activeSessions.length);
    const session = activeSessions[randomIndex];

    // Pick a random output template
    const templateIndex = Math.floor(
      Math.random() * TERMINAL_OUTPUT_TEMPLATES.length
    );
    const template = TERMINAL_OUTPUT_TEMPLATES[templateIndex];

    // Create WebSocket message
    const message: WebSocketMessage = {
      type: 'terminal_output',
      payload: {
        sessionId: session.id,
        line: {
          type: template.type,
          content: template.content,
          timestamp: new Date().toISOString(),
        },
      },
      timestamp: new Date().toISOString(),
    };

    // Route through WebSocket client's message handler
    wsClient.handleMessage(message);
  }

  /**
   * Simulate a chat streaming response
   * Call this method when a user sends a message
   */
  async simulateChatResponse(userMessage: string): Promise<void> {
    if (!this.config.enableChatResponses) {
      return;
    }

    const chatStore = useChatStore.getState();
    const currentSessionId = chatStore.currentSessionId;

    if (!currentSessionId) {
      return;
    }

    // Prevent multiple simultaneous responses
    if (this.activeStreamingSession) {
      return;
    }

    this.activeStreamingSession = currentSessionId;

    // Generate a mock response based on user message
    const response = this.generateMockResponse(userMessage);

    // Random delay before starting
    const startDelay =
      this.config.chatResponseMinDelay +
      Math.random() *
        (this.config.chatResponseMaxDelay - this.config.chatResponseMinDelay);

    await this.delay(startDelay);

    // Check if session is still active
    if (chatStore.currentSessionId !== currentSessionId) {
      this.activeStreamingSession = null;
      return;
    }

    // Start streaming message
    const streamingMsg = chatStore.startStreamingResponse();
    if (!streamingMsg) {
      this.activeStreamingSession = null;
      return;
    }

    this.streamingMessageId = streamingMsg.id;

    // Simulate streaming word by word
    const words = response.split(' ');
    let accumulatedContent = '';

    for (let i = 0; i < words.length; i++) {
      if (!this.isRunning || chatStore.currentSessionId !== currentSessionId) {
        break;
      }

      accumulatedContent += (i > 0 ? ' ' : '') + words[i];

      // Create streaming message
      const message: WebSocketMessage = {
        type: 'chat_message',
        payload: {
          sessionId: currentSessionId,
          message: {
            content: accumulatedContent,
          },
          isStreaming: true,
        },
        timestamp: new Date().toISOString(),
      };

      // Route through WebSocket client's message handler
      wsClient.handleMessage(message);

      // Small delay between words for realistic streaming
      await this.delay(30 + Math.random() * 50);
    }

    // Complete the streaming response
    const completeMessage: WebSocketMessage = {
      type: 'chat_message',
      payload: {
        sessionId: currentSessionId,
        message: {
          content: response,
          tokenCount: Math.ceil(response.length / 4),
        },
        isStreaming: false,
      },
      timestamp: new Date().toISOString(),
    };

    wsClient.handleMessage(completeMessage);

    this.activeStreamingSession = null;
    this.streamingMessageId = null;
  }

  /**
   * Generate a mock response based on user message
   */
  private generateMockResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();

    // Context-aware responses
    if (
      lowerMessage.includes('error') ||
      lowerMessage.includes('bug') ||
      lowerMessage.includes('fix')
    ) {
      return `I'll investigate this issue for you.

Looking at the error, it appears to be related to the component lifecycle. Here are my findings:

1. **Root Cause**: The error likely stems from an unhandled promise rejection
2. **Affected Files**: Based on the stack trace, check \`components/\` directory
3. **Recommended Fix**: Add proper error boundaries and try-catch blocks

Would you like me to create a fix for this issue?`;
    }

    if (
      lowerMessage.includes('implement') ||
      lowerMessage.includes('create') ||
      lowerMessage.includes('add')
    ) {
      return `I'll help you implement that feature.

Here's my implementation plan:

1. **Create the component structure** with proper TypeScript types
2. **Add state management** using the existing Zustand patterns
3. **Implement the UI** following the Material Design guidelines
4. **Write tests** to ensure functionality

I'll start working on this now. You can monitor progress in the terminal.`;
    }

    if (
      lowerMessage.includes('review') ||
      lowerMessage.includes('check') ||
      lowerMessage.includes('analyze')
    ) {
      return `I've analyzed the codebase and here's my review:

**Code Quality**: ⭐⭐⭐⭐ (4/5)

**Strengths:**
- Clean component structure
- Good TypeScript usage
- Follows established patterns

**Improvements Suggested:**
- Add more error handling
- Consider memoization for performance
- Some components could be split

Would you like me to create tasks for these improvements?`;
    }

    if (
      lowerMessage.includes('test') ||
      lowerMessage.includes('testing')
    ) {
      return `I'll help with testing.

**Current Test Coverage**: 78%

Here's what I recommend:
1. Add unit tests for the new components
2. Integration tests for the store interactions
3. E2E tests for critical user flows

Running tests now... I'll report back with the results.`;
    }

    // Default response using random phrases
    const numPhrases = 2 + Math.floor(Math.random() * 3);
    const selectedPhrases: string[] = [];

    for (let i = 0; i < numPhrases; i++) {
      const idx = Math.floor(Math.random() * CHAT_RESPONSE_PHRASES.length);
      if (!selectedPhrases.includes(CHAT_RESPONSE_PHRASES[idx])) {
        selectedPhrases.push(CHAT_RESPONSE_PHRASES[idx]);
      }
    }

    return selectedPhrases.join(' ') + ' Let me know if you need more details.';
  }

  /**
   * Start connection state change simulation
   */
  private startConnectionChanges(): void {
    // Randomly disconnect and reconnect every 30-60 seconds
    this.connectionChangeTimer = setInterval(
      () => {
        this.simulateConnectionChange();
      },
      30000 + Math.random() * 30000
    );
  }

  /**
   * Simulate a connection state change
   */
  private simulateConnectionChange(): void {
    const message: WebSocketMessage = {
      type: 'connection_status',
      payload: {
        status: Math.random() > 0.7 ? 'connecting' : 'connected',
        message: 'Simulated connection change',
      },
      timestamp: new Date().toISOString(),
    };

    wsClient.handleMessage(message);
  }

  /**
   * Manually trigger a task status update
   */
  triggerTaskUpdate(taskId: string, newStatus: TaskStatus): void {
    const message: WebSocketMessage = {
      type: 'task_update',
      payload: {
        taskId,
        updates: {
          status: newStatus,
        },
      },
      timestamp: new Date().toISOString(),
    };

    wsClient.handleMessage(message);
  }

  /**
   * Manually trigger terminal output
   */
  triggerTerminalOutput(
    sessionId: string,
    type: OutputLineType,
    content: string
  ): void {
    const message: WebSocketMessage = {
      type: 'terminal_output',
      payload: {
        sessionId,
        line: {
          type,
          content,
          timestamp: new Date().toISOString(),
        },
      },
      timestamp: new Date().toISOString(),
    };

    wsClient.handleMessage(message);
  }

  /**
   * Manually trigger a notification
   */
  triggerNotification(
    notificationType:
      | 'task_completed'
      | 'task_failed'
      | 'ai_review_ready'
      | 'human_review_needed'
      | 'github_update',
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): void {
    const message: WebSocketMessage = {
      type: 'notification',
      payload: {
        type: notificationType,
        title,
        body,
        data,
      },
      timestamp: new Date().toISOString(),
    };

    wsClient.handleMessage(message);
  }

  /**
   * Helper to create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton mock WebSocket manager instance
 */
export const mockWebSocket = new MockWebSocketManager();

/**
 * Start mock WebSocket simulation
 */
export function startMockWebSocket(
  config?: Partial<MockWebSocketConfig>
): void {
  if (config) {
    mockWebSocket.updateConfig(config);
  }
  mockWebSocket.start();
}

/**
 * Stop mock WebSocket simulation
 */
export function stopMockWebSocket(): void {
  mockWebSocket.stop();
}

/**
 * Check if mock simulation is active
 */
export function isMockWebSocketActive(): boolean {
  return mockWebSocket.isActive();
}

/**
 * Simulate a chat response to a user message
 */
export async function simulateChatResponse(userMessage: string): Promise<void> {
  await mockWebSocket.simulateChatResponse(userMessage);
}

/**
 * Trigger a manual task update
 */
export function triggerMockTaskUpdate(
  taskId: string,
  newStatus: TaskStatus
): void {
  mockWebSocket.triggerTaskUpdate(taskId, newStatus);
}

/**
 * Trigger manual terminal output
 */
export function triggerMockTerminalOutput(
  sessionId: string,
  type: OutputLineType,
  content: string
): void {
  mockWebSocket.triggerTerminalOutput(sessionId, type, content);
}

/**
 * Trigger a manual notification
 */
export function triggerMockNotification(
  type:
    | 'task_completed'
    | 'task_failed'
    | 'ai_review_ready'
    | 'human_review_needed'
    | 'github_update',
  title: string,
  body: string,
  data?: Record<string, unknown>
): void {
  mockWebSocket.triggerNotification(type, title, body, data);
}

/**
 * Hook to use mock WebSocket in components
 * Starts simulation on mount, stops on unmount
 */
export function useMockWebSocket(
  config?: Partial<MockWebSocketConfig>
): {
  isActive: boolean;
  start: () => void;
  stop: () => void;
  simulateChatResponse: (message: string) => Promise<void>;
} {
  // Note: This is not a real React hook - it's a utility function
  // For actual hook usage, wrap in useEffect in the component

  return {
    isActive: mockWebSocket.isActive(),
    start: () => {
      if (config) {
        mockWebSocket.updateConfig(config);
      }
      mockWebSocket.start();
    },
    stop: () => mockWebSocket.stop(),
    simulateChatResponse: (message: string) =>
      mockWebSocket.simulateChatResponse(message),
  };
}
