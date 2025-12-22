/**
 * Unit tests for Ideation Store Project Scope Persistence
 * Tests Zustand store for proper project-scoped data management
 *
 * This test verifies the fix for:
 * - Issue: Ideation session doesn't clear/reload when project changes
 * - Fix: loadIdeation now calls clearSession() before loading new project data
 * - Fix: currentProjectId is tracked to validate IPC events
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useIdeationStore } from '../stores/ideation-store';
import type {
  IdeationSession,
  Idea,
  IdeationType,
  IdeationConfig
} from '../../shared/types';

// Helper to create test idea
function createTestIdea(overrides: Partial<Idea> = {}): Idea {
  const now = new Date();
  return {
    id: `idea-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    title: 'Test Idea',
    description: 'Test description',
    rationale: 'Test rationale',
    status: 'draft',
    createdAt: now,
    type: 'code_improvements',
    buildsUpon: [],
    estimatedEffort: 'small',
    affectedFiles: ['src/test.ts'],
    existingPatterns: [],
    ...overrides
  } as Idea;
}

// Helper to create test session
function createTestSession(projectId: string, overrides: Partial<IdeationSession> = {}): IdeationSession {
  const now = new Date();
  return {
    id: `session-${Date.now()}`,
    projectId,
    config: {
      enabledTypes: ['code_improvements', 'ui_ux_improvements'] as IdeationType[],
      includeRoadmapContext: false,
      includeKanbanContext: false,
      maxIdeasPerType: 5
    },
    ideas: [
      createTestIdea({ title: `Idea for ${projectId}` })
    ],
    projectContext: {
      existingFeatures: ['Feature 1'],
      techStack: ['TypeScript', 'React'],
      plannedFeatures: []
    },
    generatedAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('Ideation Store - Project Scope Persistence', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useIdeationStore.setState({
      session: null,
      generationStatus: {
        phase: 'idle',
        progress: 0,
        message: ''
      },
      config: {
        enabledTypes: ['code_improvements', 'ui_ux_improvements'] as IdeationType[],
        includeRoadmapContext: false,
        includeKanbanContext: false,
        maxIdeasPerType: 5
      },
      logs: [],
      typeStates: {
        code_improvements: 'pending',
        ui_ux_improvements: 'pending',
        documentation_gaps: 'pending',
        security_hardening: 'pending',
        performance_optimizations: 'pending',
        code_quality: 'pending'
      },
      selectedIds: new Set<string>(),
      currentProjectId: null
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('clearSession', () => {
    it('should clear session data', () => {
      // Setup: Create a session
      const session = createTestSession('project-a');
      useIdeationStore.setState({
        session,
        currentProjectId: 'project-a'
      });

      // Verify initial state
      expect(useIdeationStore.getState().session).not.toBeNull();
      expect(useIdeationStore.getState().currentProjectId).toBe('project-a');

      // Act: Clear session
      useIdeationStore.getState().clearSession();

      // Assert: Session is cleared
      const state = useIdeationStore.getState();
      expect(state.session).toBeNull();
      expect(state.currentProjectId).toBeNull();
    });

    it('should reset generation status to idle', () => {
      // Setup: Set generation in progress
      useIdeationStore.setState({
        session: createTestSession('project-a'),
        generationStatus: {
          phase: 'generating',
          progress: 50,
          message: 'Generating ideas...'
        },
        currentProjectId: 'project-a'
      });

      // Act: Clear session
      useIdeationStore.getState().clearSession();

      // Assert: Generation status is reset
      const state = useIdeationStore.getState();
      expect(state.generationStatus.phase).toBe('idle');
      expect(state.generationStatus.progress).toBe(0);
      expect(state.generationStatus.message).toBe('');
    });

    it('should reset all type states to pending', () => {
      // Setup: Set some type states to completed
      useIdeationStore.setState({
        session: createTestSession('project-a'),
        typeStates: {
          code_improvements: 'completed',
          ui_ux_improvements: 'completed',
          documentation_gaps: 'generating',
          security_hardening: 'failed',
          performance_optimizations: 'pending',
          code_quality: 'pending'
        },
        currentProjectId: 'project-a'
      });

      // Act: Clear session
      useIdeationStore.getState().clearSession();

      // Assert: All type states are reset to pending
      const state = useIdeationStore.getState();
      expect(state.typeStates.code_improvements).toBe('pending');
      expect(state.typeStates.ui_ux_improvements).toBe('pending');
      expect(state.typeStates.documentation_gaps).toBe('pending');
      expect(state.typeStates.security_hardening).toBe('pending');
      expect(state.typeStates.performance_optimizations).toBe('pending');
      expect(state.typeStates.code_quality).toBe('pending');
    });

    it('should clear selection', () => {
      // Setup: Select some ideas
      useIdeationStore.setState({
        session: createTestSession('project-a'),
        selectedIds: new Set(['idea-1', 'idea-2', 'idea-3']),
        currentProjectId: 'project-a'
      });

      // Act: Clear session
      useIdeationStore.getState().clearSession();

      // Assert: Selection is cleared
      expect(useIdeationStore.getState().selectedIds.size).toBe(0);
    });

    it('should clear currentProjectId', () => {
      // Setup: Set current project
      useIdeationStore.setState({
        session: createTestSession('project-a'),
        currentProjectId: 'project-a'
      });

      // Act: Clear session
      useIdeationStore.getState().clearSession();

      // Assert: currentProjectId is cleared
      expect(useIdeationStore.getState().currentProjectId).toBeNull();
    });
  });

  describe('setCurrentProjectId', () => {
    it('should set the current project ID', () => {
      // Act: Set project ID
      useIdeationStore.getState().setCurrentProjectId('project-b');

      // Assert
      expect(useIdeationStore.getState().currentProjectId).toBe('project-b');
    });

    it('should allow setting to null', () => {
      // Setup
      useIdeationStore.setState({ currentProjectId: 'project-a' });

      // Act
      useIdeationStore.getState().setCurrentProjectId(null);

      // Assert
      expect(useIdeationStore.getState().currentProjectId).toBeNull();
    });

    it('should update when switching projects', () => {
      // Setup: Set initial project
      useIdeationStore.getState().setCurrentProjectId('project-a');
      expect(useIdeationStore.getState().currentProjectId).toBe('project-a');

      // Act: Switch to new project
      useIdeationStore.getState().setCurrentProjectId('project-b');

      // Assert: New project ID is set
      expect(useIdeationStore.getState().currentProjectId).toBe('project-b');
    });
  });

  describe('Project Switch Simulation', () => {
    it('should show empty state when switching to project with no ideation', () => {
      // Setup: Project A has ideation data
      const sessionA = createTestSession('project-a', {
        ideas: [
          createTestIdea({ id: 'idea-a-1', title: 'Project A Idea 1' }),
          createTestIdea({ id: 'idea-a-2', title: 'Project A Idea 2' })
        ]
      });
      useIdeationStore.setState({
        session: sessionA,
        currentProjectId: 'project-a'
      });

      // Verify Project A data is loaded
      expect(useIdeationStore.getState().session?.ideas).toHaveLength(2);
      expect(useIdeationStore.getState().session?.ideas[0].title).toBe('Project A Idea 1');

      // Act: Switch to Project B (simulating loadIdeation behavior)
      // 1. Clear session (as loadIdeation does)
      useIdeationStore.getState().clearSession();
      // 2. Set new project ID (as loadIdeation does)
      useIdeationStore.getState().setCurrentProjectId('project-b');
      // 3. No data loaded (project B has no ideation)

      // Assert: Empty state shown
      expect(useIdeationStore.getState().session).toBeNull();
      expect(useIdeationStore.getState().currentProjectId).toBe('project-b');
    });

    it('should maintain project isolation when switching between projects with data', () => {
      // Setup: Project A has ideation
      const sessionA = createTestSession('project-a', {
        ideas: [
          createTestIdea({ id: 'idea-a-1', title: 'Project A Idea' })
        ]
      });
      useIdeationStore.setState({
        session: sessionA,
        currentProjectId: 'project-a'
      });

      // Switch to Project B and load its ideation
      useIdeationStore.getState().clearSession();
      useIdeationStore.getState().setCurrentProjectId('project-b');
      const sessionB = createTestSession('project-b', {
        ideas: [
          createTestIdea({ id: 'idea-b-1', title: 'Project B Idea' })
        ]
      });
      useIdeationStore.getState().setSession(sessionB);

      // Assert: Project B's ideas are shown, not Project A's
      expect(useIdeationStore.getState().session?.projectId).toBe('project-b');
      expect(useIdeationStore.getState().session?.ideas).toHaveLength(1);
      expect(useIdeationStore.getState().session?.ideas[0].title).toBe('Project B Idea');
      expect(useIdeationStore.getState().currentProjectId).toBe('project-b');
    });

    it('should restore correct project data when switching back', () => {
      // This test simulates the full E2E flow:
      // 1. Open project A, generate ideation
      // 2. Switch to project B (no ideation)
      // 3. Generate ideation for project B
      // 4. Switch back to project A
      // 5. Verify project A's ideation shown (not project B's)

      // Step 1: Project A has ideation
      const sessionA = createTestSession('project-a', {
        ideas: [
          createTestIdea({ id: 'idea-a-1', title: 'Project A Idea 1' }),
          createTestIdea({ id: 'idea-a-2', title: 'Project A Idea 2' })
        ]
      });

      // Simulate initial load for Project A
      useIdeationStore.getState().clearSession();
      useIdeationStore.getState().setCurrentProjectId('project-a');
      useIdeationStore.getState().setSession(sessionA);

      expect(useIdeationStore.getState().session?.ideas).toHaveLength(2);
      expect(useIdeationStore.getState().currentProjectId).toBe('project-a');

      // Step 2 & 3: Switch to Project B and load its data
      useIdeationStore.getState().clearSession();
      useIdeationStore.getState().setCurrentProjectId('project-b');

      // Verify empty state for project B
      expect(useIdeationStore.getState().session).toBeNull();
      expect(useIdeationStore.getState().currentProjectId).toBe('project-b');

      // Generate ideation for project B
      const sessionB = createTestSession('project-b', {
        ideas: [
          createTestIdea({ id: 'idea-b-1', title: 'Project B Idea 1' })
        ]
      });
      useIdeationStore.getState().setSession(sessionB);

      expect(useIdeationStore.getState().session?.ideas).toHaveLength(1);
      expect(useIdeationStore.getState().session?.ideas[0].title).toBe('Project B Idea 1');

      // Step 4 & 5: Switch back to Project A
      useIdeationStore.getState().clearSession();
      useIdeationStore.getState().setCurrentProjectId('project-a');
      // Reload Project A's data
      useIdeationStore.getState().setSession(sessionA);

      // Assert: Project A's ideation is shown, not Project B's
      expect(useIdeationStore.getState().session?.projectId).toBe('project-a');
      expect(useIdeationStore.getState().session?.ideas).toHaveLength(2);
      expect(useIdeationStore.getState().session?.ideas[0].title).toBe('Project A Idea 1');
      expect(useIdeationStore.getState().session?.ideas[1].title).toBe('Project A Idea 2');
      expect(useIdeationStore.getState().currentProjectId).toBe('project-a');
    });
  });

  describe('IPC Event Project Validation', () => {
    it('should track currentProjectId for IPC event validation', () => {
      // This tests that the store tracks currentProjectId which is used
      // by the isValidProjectId helper in setupIdeationListeners

      // Setup: Set current project
      useIdeationStore.getState().setCurrentProjectId('project-a');

      // Assert: currentProjectId is tracked
      expect(useIdeationStore.getState().currentProjectId).toBe('project-a');

      // Switch project
      useIdeationStore.getState().clearSession();
      useIdeationStore.getState().setCurrentProjectId('project-b');

      // Assert: New project ID is tracked
      expect(useIdeationStore.getState().currentProjectId).toBe('project-b');
    });

    it('should allow checking if event projectId matches current project', () => {
      // Setup: Set current project
      useIdeationStore.getState().setCurrentProjectId('project-a');
      const currentProjectId = useIdeationStore.getState().currentProjectId;

      // Simulate IPC event validation logic
      const eventProjectId = 'project-a';
      const isValid = !currentProjectId || eventProjectId === currentProjectId;
      expect(isValid).toBe(true);

      // Wrong project event should be invalid
      const wrongEventProjectId = 'project-b';
      const isInvalid = currentProjectId && wrongEventProjectId !== currentProjectId;
      expect(isInvalid).toBe(true);
    });
  });

  describe('Generation Status During Project Switch', () => {
    it('should reset generation status when clearing session', () => {
      // Setup: Generation in progress
      useIdeationStore.setState({
        session: createTestSession('project-a'),
        generationStatus: {
          phase: 'generating',
          progress: 75,
          message: '3/4 types complete'
        },
        currentProjectId: 'project-a'
      });

      // Act: Clear session (simulates project switch)
      useIdeationStore.getState().clearSession();

      // Assert: Generation status is reset
      const state = useIdeationStore.getState();
      expect(state.generationStatus.phase).toBe('idle');
      expect(state.generationStatus.progress).toBe(0);
      expect(state.generationStatus.message).toBe('');
    });
  });
});
