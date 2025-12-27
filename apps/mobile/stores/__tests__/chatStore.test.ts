/**
 * Chat Store Unit Tests
 * Tests session management, message handling, and streaming functionality
 */

import { act } from '@testing-library/react-native';
import { useChatStore } from '../chatStore';
import type { ChatSessionCreateInput, ToolCall, ChatMessage } from '../../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
  },
}));

describe('ChatStore', () => {
  // Reset store before each test
  beforeEach(() => {
    act(() => {
      useChatStore.getState().resetStore();
    });
  });

  describe('Initial State', () => {
    it('should have mock sessions on initialization', () => {
      const { sessions } = useChatStore.getState();
      expect(sessions.length).toBeGreaterThan(0);
    });

    it('should have a current session selected by default', () => {
      const { currentSessionId } = useChatStore.getState();
      expect(currentSessionId).toBeDefined();
      expect(currentSessionId).not.toBeNull();
    });

    it('should have sessions with messages', () => {
      const { sessions } = useChatStore.getState();
      const sessionWithMessages = sessions.find((s) => s.messages.length > 0);
      expect(sessionWithMessages).toBeDefined();
    });

    it('should not be streaming initially', () => {
      const { isStreaming } = useChatStore.getState();
      expect(isStreaming).toBe(false);
    });

    it('should have empty filters initially', () => {
      const { filters } = useChatStore.getState();
      expect(filters).toEqual({});
    });
  });

  describe('createSession', () => {
    it('should create a new session', () => {
      const { createSession, sessions: initialSessions } = useChatStore.getState();

      let newSession;
      act(() => {
        newSession = createSession();
      });

      const { sessions } = useChatStore.getState();
      expect(sessions.length).toBe(initialSessions.length + 1);
      expect(newSession).toBeDefined();
    });

    it('should assign a unique ID to new session', () => {
      const { createSession } = useChatStore.getState();

      let session1, session2;
      act(() => {
        session1 = createSession();
        session2 = createSession();
      });

      expect(session1!.id).not.toBe(session2!.id);
    });

    it('should use provided name if given', () => {
      const { createSession } = useChatStore.getState();
      const input: ChatSessionCreateInput = {
        name: 'Custom Session Name',
      };

      let newSession;
      act(() => {
        newSession = createSession(input);
      });

      expect(newSession!.name).toBe('Custom Session Name');
    });

    it('should generate default name if not provided', () => {
      const { createSession } = useChatStore.getState();

      let newSession;
      act(() => {
        newSession = createSession();
      });

      expect(newSession!.name).toContain('New Session');
    });

    it('should set new session as current', () => {
      const { createSession } = useChatStore.getState();

      let newSession;
      act(() => {
        newSession = createSession();
      });

      expect(useChatStore.getState().currentSessionId).toBe(newSession!.id);
    });

    it('should mark new session as active', () => {
      const { createSession } = useChatStore.getState();

      let newSession;
      act(() => {
        newSession = createSession();
      });

      expect(newSession!.isActive).toBe(true);
    });

    it('should deactivate other sessions when creating new one', () => {
      const { createSession, sessions: initialSessions } = useChatStore.getState();

      act(() => {
        createSession();
      });

      const { sessions } = useChatStore.getState();
      const otherSessions = sessions.filter(
        (s) => initialSessions.find((is) => is.id === s.id)
      );
      expect(otherSessions.every((s) => !s.isActive)).toBe(true);
    });

    it('should initialize session with empty messages', () => {
      const { createSession } = useChatStore.getState();

      let newSession;
      act(() => {
        newSession = createSession();
      });

      expect(newSession!.messages).toEqual([]);
      expect(newSession!.messageCount).toBe(0);
    });

    it('should set timestamps on new session', () => {
      const { createSession } = useChatStore.getState();
      const beforeTime = new Date().toISOString();

      let newSession;
      act(() => {
        newSession = createSession();
      });

      expect(newSession!.createdAt).toBeDefined();
      expect(newSession!.updatedAt).toBeDefined();
      expect(newSession!.createdAt >= beforeTime).toBe(true);
    });

    it('should include projectId if provided', () => {
      const { createSession } = useChatStore.getState();

      let newSession;
      act(() => {
        newSession = createSession({ projectId: 'project-123' });
      });

      expect(newSession!.projectId).toBe('project-123');
    });

    it('should include claudeProfileId if provided', () => {
      const { createSession } = useChatStore.getState();

      let newSession;
      act(() => {
        newSession = createSession({ claudeProfileId: 'profile-custom' });
      });

      expect(newSession!.claudeProfileId).toBe('profile-custom');
    });
  });

  describe('switchSession', () => {
    it('should switch to a different session', () => {
      const { sessions, switchSession } = useChatStore.getState();
      const targetSession = sessions[1];

      act(() => {
        switchSession(targetSession.id);
      });

      expect(useChatStore.getState().currentSessionId).toBe(targetSession.id);
    });

    it('should mark switched session as active', () => {
      const { sessions, switchSession, getSessionById } = useChatStore.getState();
      const targetSession = sessions[1];

      act(() => {
        switchSession(targetSession.id);
      });

      const session = useChatStore.getState().getSessionById(targetSession.id);
      expect(session?.isActive).toBe(true);
    });

    it('should deactivate other sessions', () => {
      const { sessions, switchSession } = useChatStore.getState();
      const targetSession = sessions[1];

      act(() => {
        switchSession(targetSession.id);
      });

      const { sessions: updatedSessions } = useChatStore.getState();
      const otherSessions = updatedSessions.filter((s) => s.id !== targetSession.id);
      expect(otherSessions.every((s) => !s.isActive)).toBe(true);
    });

    it('should stop streaming when switching sessions', () => {
      const { sessions, switchSession, setStreaming } = useChatStore.getState();
      const targetSession = sessions[1];

      act(() => {
        setStreaming(true);
        switchSession(targetSession.id);
      });

      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it('should not switch to non-existent session', () => {
      const { currentSessionId: originalId, switchSession } = useChatStore.getState();

      act(() => {
        switchSession('non-existent-id');
      });

      expect(useChatStore.getState().currentSessionId).toBe(originalId);
    });
  });

  describe('renameSession', () => {
    it('should rename a session', () => {
      const { sessions, renameSession, getSessionById } = useChatStore.getState();
      const session = sessions[0];

      act(() => {
        renameSession(session.id, 'Renamed Session');
      });

      const renamedSession = getSessionById(session.id);
      expect(renamedSession?.name).toBe('Renamed Session');
    });

    it('should update updatedAt when renaming', () => {
      const { sessions, renameSession, getSessionById } = useChatStore.getState();
      const session = sessions[0];
      const originalUpdatedAt = session.updatedAt;

      act(() => {
        renameSession(session.id, 'New Name');
      });

      const renamedSession = getSessionById(session.id);
      expect(renamedSession?.updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', () => {
      const { sessions, deleteSession, getSessionById } = useChatStore.getState();
      const sessionToDelete = sessions[1]; // Not the current one
      const initialCount = sessions.length;

      act(() => {
        deleteSession(sessionToDelete.id);
      });

      const { sessions: updatedSessions } = useChatStore.getState();
      expect(updatedSessions.length).toBe(initialCount - 1);
      expect(getSessionById(sessionToDelete.id)).toBeUndefined();
    });

    it('should switch to another session when deleting current', () => {
      const { sessions, currentSessionId, deleteSession } = useChatStore.getState();
      const currentSession = sessions.find((s) => s.id === currentSessionId)!;

      act(() => {
        deleteSession(currentSession.id);
      });

      expect(useChatStore.getState().currentSessionId).not.toBe(currentSession.id);
      expect(useChatStore.getState().currentSessionId).not.toBeNull();
    });

    it('should not delete the last session', () => {
      const { sessions, deleteSession } = useChatStore.getState();

      // Delete all but one session
      act(() => {
        const sessionsToDelete = sessions.slice(1);
        sessionsToDelete.forEach((s) => deleteSession(s.id));
      });

      const { sessions: remainingSessions } = useChatStore.getState();
      expect(remainingSessions.length).toBe(1);

      // Try to delete the last one
      act(() => {
        deleteSession(remainingSessions[0].id);
      });

      expect(useChatStore.getState().sessions.length).toBe(1);
    });

    it('should set error when trying to delete last session', () => {
      const { sessions, deleteSession } = useChatStore.getState();

      // Delete all but one session
      act(() => {
        const sessionsToDelete = sessions.slice(1);
        sessionsToDelete.forEach((s) => deleteSession(s.id));
      });

      const { sessions: remainingSessions } = useChatStore.getState();

      // Try to delete the last one
      act(() => {
        deleteSession(remainingSessions[0].id);
      });

      expect(useChatStore.getState().error).toBe('Cannot delete the last session');
    });
  });

  describe('addMessage', () => {
    it('should add a user message to current session', () => {
      const { addMessage, getCurrentSession } = useChatStore.getState();
      const initialMessageCount = getCurrentSession()?.messageCount || 0;

      act(() => {
        addMessage('Hello, Claude!');
      });

      const session = useChatStore.getState().getCurrentSession();
      expect(session?.messageCount).toBe(initialMessageCount + 1);
    });

    it('should return the new message', () => {
      const { addMessage } = useChatStore.getState();

      let newMessage: ChatMessage | undefined;
      act(() => {
        newMessage = addMessage('Test message');
      });

      expect(newMessage).toBeDefined();
      expect(newMessage?.content).toBe('Test message');
      expect(newMessage?.role).toBe('user');
    });

    it('should set message as complete by default', () => {
      const { addMessage } = useChatStore.getState();

      let newMessage: ChatMessage | undefined;
      act(() => {
        newMessage = addMessage('Test message');
      });

      expect(newMessage?.status).toBe('complete');
    });

    it('should set timestamps on new message', () => {
      const { addMessage } = useChatStore.getState();

      let newMessage: ChatMessage | undefined;
      act(() => {
        newMessage = addMessage('Test message');
      });

      expect(newMessage?.createdAt).toBeDefined();
      expect(newMessage?.completedAt).toBeDefined();
    });

    it('should update session totalTokens', () => {
      const { addMessage, getCurrentSession } = useChatStore.getState();
      const initialTokens = getCurrentSession()?.totalTokens || 0;

      act(() => {
        addMessage('Test message with some content');
      });

      const session = useChatStore.getState().getCurrentSession();
      expect(session?.totalTokens).toBeGreaterThan(initialTokens);
    });

    it('should update session lastMessageAt', () => {
      const { addMessage, getCurrentSession } = useChatStore.getState();

      act(() => {
        addMessage('New message');
      });

      const session = useChatStore.getState().getCurrentSession();
      expect(session?.lastMessageAt).toBeDefined();
    });

    it('should support assistant role', () => {
      const { addMessage } = useChatStore.getState();

      let newMessage: ChatMessage | undefined;
      act(() => {
        newMessage = addMessage('I am Claude!', 'assistant');
      });

      expect(newMessage?.role).toBe('assistant');
    });

    it('should return undefined if no current session', () => {
      const { clearFilters } = useChatStore.getState();

      // Set currentSessionId to null by manipulating state
      act(() => {
        useChatStore.setState({ currentSessionId: null });
      });

      let result;
      act(() => {
        result = useChatStore.getState().addMessage('Test');
      });

      expect(result).toBeUndefined();
    });
  });

  describe('updateMessage', () => {
    it('should update message content', () => {
      const { addMessage, updateMessage, getCurrentSession } =
        useChatStore.getState();

      let message;
      act(() => {
        message = addMessage('Original content');
        updateMessage(message!.id, { content: 'Updated content' });
      });

      const session = useChatStore.getState().getCurrentSession();
      const updatedMessage = session?.messages.find((m) => m.id === message!.id);
      expect(updatedMessage?.content).toBe('Updated content');
    });

    it('should update session updatedAt', () => {
      const { addMessage, updateMessage, getCurrentSession } =
        useChatStore.getState();
      const initialUpdatedAt = getCurrentSession()?.updatedAt;

      let message;
      act(() => {
        message = addMessage('Test');
        updateMessage(message!.id, { content: 'New content' });
      });

      const session = useChatStore.getState().getCurrentSession();
      expect(session?.updatedAt).not.toBe(initialUpdatedAt);
    });
  });

  describe('Streaming', () => {
    it('should start streaming response', () => {
      const { startStreamingResponse } = useChatStore.getState();

      let streamingMessage: ChatMessage | undefined;
      act(() => {
        streamingMessage = startStreamingResponse();
      });

      expect(streamingMessage).toBeDefined();
      expect(streamingMessage?.role).toBe('assistant');
      expect(streamingMessage?.status).toBe('streaming');
      expect(streamingMessage?.isStreaming).toBe(true);
    });

    it('should set isStreaming to true when starting', () => {
      const { startStreamingResponse } = useChatStore.getState();

      act(() => {
        startStreamingResponse();
      });

      expect(useChatStore.getState().isStreaming).toBe(true);
    });

    it('should update streaming content', () => {
      const { startStreamingResponse, updateStreamingContent, getCurrentSession } =
        useChatStore.getState();

      act(() => {
        startStreamingResponse();
        updateStreamingContent('Hello');
        updateStreamingContent('Hello, world!');
      });

      const session = useChatStore.getState().getCurrentSession();
      const streamingMessage = session?.messages.find(
        (m) => m.status === 'streaming'
      );
      expect(streamingMessage?.content).toBe('Hello, world!');
    });

    it('should complete streaming response', () => {
      const {
        startStreamingResponse,
        updateStreamingContent,
        completeStreamingResponse,
        getCurrentSession,
      } = useChatStore.getState();

      act(() => {
        startStreamingResponse();
        updateStreamingContent('Partial...');
        completeStreamingResponse('Final content here');
      });

      const session = useChatStore.getState().getCurrentSession();
      const completedMessage = session?.messages.find(
        (m) => m.content === 'Final content here'
      );
      expect(completedMessage?.status).toBe('complete');
      expect(completedMessage?.isStreaming).toBe(false);
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it('should set completedAt when completing stream', () => {
      const { startStreamingResponse, completeStreamingResponse, getCurrentSession } =
        useChatStore.getState();

      act(() => {
        startStreamingResponse();
        completeStreamingResponse('Done!');
      });

      const session = useChatStore.getState().getCurrentSession();
      const message = session?.messages.find((m) => m.content === 'Done!');
      expect(message?.completedAt).toBeDefined();
    });

    it('should update session totalTokens when completing', () => {
      const { startStreamingResponse, completeStreamingResponse, getCurrentSession } =
        useChatStore.getState();
      const initialTokens = getCurrentSession()?.totalTokens || 0;

      act(() => {
        startStreamingResponse();
        completeStreamingResponse('This is a longer response with more tokens', 50);
      });

      const session = useChatStore.getState().getCurrentSession();
      expect(session?.totalTokens).toBe(initialTokens + 50);
    });

    it('should toggle isStreaming state', () => {
      const { setStreaming } = useChatStore.getState();

      act(() => {
        setStreaming(true);
      });
      expect(useChatStore.getState().isStreaming).toBe(true);

      act(() => {
        setStreaming(false);
      });
      expect(useChatStore.getState().isStreaming).toBe(false);
    });
  });

  describe('Tool Calls', () => {
    it('should add tool call to message', () => {
      const { addMessage, addToolCall, getCurrentSession } =
        useChatStore.getState();

      let message;
      act(() => {
        message = addMessage('Message with tool call', 'assistant');
        const toolCall: ToolCall = {
          id: 'tool-1',
          name: 'read_file',
          arguments: { path: '/test/file.ts' },
          status: 'pending',
          startedAt: new Date().toISOString(),
        };
        addToolCall(message!.id, toolCall);
      });

      const session = useChatStore.getState().getCurrentSession();
      const updatedMessage = session?.messages.find((m) => m.id === message!.id);
      expect(updatedMessage?.toolCalls).toBeDefined();
      expect(updatedMessage?.toolCalls?.length).toBe(1);
      expect(updatedMessage?.toolCalls?.[0].name).toBe('read_file');
    });

    it('should update tool call status', () => {
      const { addMessage, addToolCall, updateToolCall, getCurrentSession } =
        useChatStore.getState();

      let message;
      act(() => {
        message = addMessage('Message', 'assistant');
        const toolCall: ToolCall = {
          id: 'tool-1',
          name: 'read_file',
          arguments: { path: '/test' },
          status: 'pending',
          startedAt: new Date().toISOString(),
        };
        addToolCall(message!.id, toolCall);
        updateToolCall(message!.id, 'tool-1', {
          status: 'completed',
          result: 'File contents here',
          completedAt: new Date().toISOString(),
        });
      });

      const session = useChatStore.getState().getCurrentSession();
      const updatedMessage = session?.messages.find((m) => m.id === message!.id);
      expect(updatedMessage?.toolCalls?.[0].status).toBe('completed');
      expect(updatedMessage?.toolCalls?.[0].result).toBe('File contents here');
    });
  });

  describe('Filters', () => {
    it('should set filters', () => {
      const { setFilters } = useChatStore.getState();

      act(() => {
        setFilters({ projectId: 'project-001' });
      });

      const { filters } = useChatStore.getState();
      expect(filters.projectId).toBe('project-001');
    });

    it('should clear filters', () => {
      const { setFilters, clearFilters } = useChatStore.getState();

      act(() => {
        setFilters({ projectId: 'project-001', search: 'test' });
        clearFilters();
      });

      const { filters } = useChatStore.getState();
      expect(filters).toEqual({});
    });

    it('should filter sessions by project', () => {
      const { setFilters, getFilteredSessions } = useChatStore.getState();

      act(() => {
        setFilters({ projectId: 'project-001' });
      });

      const filteredSessions = getFilteredSessions();
      expect(
        filteredSessions.every((s) => s.projectId === 'project-001')
      ).toBe(true);
    });

    it('should filter sessions by search term', () => {
      const { setFilters, getFilteredSessions } = useChatStore.getState();

      act(() => {
        setFilters({ search: 'architecture' });
      });

      const filteredSessions = getFilteredSessions();
      expect(filteredSessions.length).toBeGreaterThan(0);
    });

    it('should filter sessions by active state', () => {
      const { setFilters, getFilteredSessions } = useChatStore.getState();

      act(() => {
        setFilters({ isActive: true });
      });

      const filteredSessions = getFilteredSessions();
      expect(filteredSessions.every((s) => s.isActive)).toBe(true);
    });
  });

  describe('getSessionsByProject', () => {
    it('should return sessions for a specific project', () => {
      const { getSessionsByProject } = useChatStore.getState();

      const projectSessions = getSessionsByProject('project-001');

      expect(projectSessions.every((s) => s.projectId === 'project-001')).toBe(
        true
      );
    });

    it('should return empty array for project with no sessions', () => {
      const { getSessionsByProject } = useChatStore.getState();

      const projectSessions = getSessionsByProject('non-existent-project');

      expect(projectSessions).toEqual([]);
    });
  });

  describe('clearSessionMessages', () => {
    it('should clear all messages from a session', () => {
      const { sessions, clearSessionMessages, getSessionById } =
        useChatStore.getState();
      const session = sessions.find((s) => s.messages.length > 0)!;

      act(() => {
        clearSessionMessages(session.id);
      });

      const clearedSession = getSessionById(session.id);
      expect(clearedSession?.messages).toEqual([]);
      expect(clearedSession?.messageCount).toBe(0);
      expect(clearedSession?.totalTokens).toBe(0);
    });
  });

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const { setLoading } = useChatStore.getState();

      act(() => {
        setLoading(true);
      });
      expect(useChatStore.getState().isLoading).toBe(true);

      act(() => {
        setLoading(false);
      });
      expect(useChatStore.getState().isLoading).toBe(false);
    });

    it('should set error message', () => {
      const { setError } = useChatStore.getState();

      act(() => {
        setError('Failed to send message');
      });
      expect(useChatStore.getState().error).toBe('Failed to send message');

      act(() => {
        setError(null);
      });
      expect(useChatStore.getState().error).toBeNull();
    });
  });

  describe('resetStore', () => {
    it('should reset store to initial state', () => {
      const { createSession, setFilters, setStreaming, resetStore } =
        useChatStore.getState();

      // Modify state
      act(() => {
        createSession({ name: 'Temp Session' });
        setFilters({ search: 'test' });
        setStreaming(true);
      });

      // Reset
      act(() => {
        resetStore();
      });

      const state = useChatStore.getState();
      expect(state.filters).toEqual({});
      expect(state.isStreaming).toBe(false);
      expect(state.currentSessionId).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message content', () => {
      const { addMessage } = useChatStore.getState();

      let message: ChatMessage | undefined;
      act(() => {
        message = addMessage('');
      });

      expect(message?.content).toBe('');
    });

    it('should handle very long messages', () => {
      const { addMessage, getCurrentSession } = useChatStore.getState();
      const longContent = 'A'.repeat(10000);

      act(() => {
        addMessage(longContent);
      });

      const session = useChatStore.getState().getCurrentSession();
      const lastMessage = session?.messages[session.messages.length - 1];
      expect(lastMessage?.content).toBe(longContent);
    });

    it('should handle rapid message additions', () => {
      const { addMessage, getCurrentSession } = useChatStore.getState();
      const initialCount = getCurrentSession()?.messageCount || 0;

      act(() => {
        for (let i = 0; i < 20; i++) {
          addMessage(`Message ${i}`);
        }
      });

      const session = useChatStore.getState().getCurrentSession();
      expect(session?.messageCount).toBe(initialCount + 20);
    });

    it('should handle special characters in messages', () => {
      const { addMessage, getCurrentSession } = useChatStore.getState();
      const specialContent = '```typescript\nconst x = "hello";\n```\n<script>alert("xss")</script>';

      act(() => {
        addMessage(specialContent);
      });

      const session = useChatStore.getState().getCurrentSession();
      const lastMessage = session?.messages[session.messages.length - 1];
      expect(lastMessage?.content).toBe(specialContent);
    });
  });
});
