/**
 * Project Store Unit Tests
 * Tests project management, recent tracking, and switcher functionality
 */

import { act } from '@testing-library/react-native';
import { useProjectStore } from '../projectStore';
import type { ProjectCreateInput, ProjectStatus } from '../../types';

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

describe('ProjectStore', () => {
  // Reset store before each test
  beforeEach(() => {
    act(() => {
      useProjectStore.getState().resetStore();
    });
  });

  describe('Initial State', () => {
    it('should have mock projects on initialization', () => {
      const { projects } = useProjectStore.getState();
      expect(projects.length).toBeGreaterThan(0);
    });

    it('should have a current project selected by default', () => {
      const { currentProjectId } = useProjectStore.getState();
      expect(currentProjectId).toBeDefined();
      expect(currentProjectId).not.toBeNull();
    });

    it('should have recent projects populated', () => {
      const { recentProjects } = useProjectStore.getState();
      expect(recentProjects.length).toBeGreaterThan(0);
      expect(recentProjects.length).toBeLessThanOrEqual(5);
    });

    it('should have empty filters initially', () => {
      const { filters } = useProjectStore.getState();
      expect(filters).toEqual({});
    });

    it('should have projects with various statuses', () => {
      const { projects } = useProjectStore.getState();
      const statuses = new Set(projects.map((p) => p.status));
      expect(statuses.size).toBeGreaterThan(1);
    });
  });

  describe('addProject', () => {
    it('should add a new project to the store', () => {
      const { addProject, projects: initialProjects } = useProjectStore.getState();
      const input: ProjectCreateInput = {
        name: 'New Test Project',
        description: 'This is a test project',
        path: '/path/to/project',
      };

      let newProject;
      act(() => {
        newProject = addProject(input);
      });

      const { projects } = useProjectStore.getState();
      expect(projects.length).toBe(initialProjects.length + 1);
      expect(newProject).toBeDefined();
      expect(newProject!.name).toBe(input.name);
    });

    it('should assign a unique ID to new projects', () => {
      const { addProject } = useProjectStore.getState();

      let project1, project2;
      act(() => {
        project1 = addProject({
          name: 'Project 1',
          description: 'First project',
          path: '/path/1',
        });
        project2 = addProject({
          name: 'Project 2',
          description: 'Second project',
          path: '/path/2',
        });
      });

      expect(project1!.id).not.toBe(project2!.id);
    });

    it('should default to active status', () => {
      const { addProject } = useProjectStore.getState();

      let newProject;
      act(() => {
        newProject = addProject({
          name: 'Active Project',
          description: 'Should be active',
          path: '/path',
        });
      });

      expect(newProject!.status).toBe('active');
    });

    it('should initialize stats with zeros', () => {
      const { addProject } = useProjectStore.getState();

      let newProject;
      act(() => {
        newProject = addProject({
          name: 'Fresh Project',
          description: 'No tasks yet',
          path: '/path',
        });
      });

      expect(newProject!.stats).toEqual({
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        backlogTasks: 0,
        aiReviewTasks: 0,
        humanReviewTasks: 0,
      });
    });

    it('should add new project to recent projects', () => {
      const { addProject, recentProjects: initialRecent } =
        useProjectStore.getState();

      act(() => {
        addProject({
          name: 'Recent Project',
          description: 'Should appear in recents',
          path: '/path',
        });
      });

      const { recentProjects } = useProjectStore.getState();
      expect(recentProjects[0].name).toBe('Recent Project');
    });

    it('should set timestamps on new project', () => {
      const { addProject } = useProjectStore.getState();
      const beforeTime = new Date().toISOString();

      let newProject;
      act(() => {
        newProject = addProject({
          name: 'Timestamp Project',
          description: 'Testing timestamps',
          path: '/path',
        });
      });

      expect(newProject!.createdAt).toBeDefined();
      expect(newProject!.updatedAt).toBeDefined();
      expect(newProject!.lastOpenedAt).toBeDefined();
    });

    it('should include optional repositoryUrl', () => {
      const { addProject } = useProjectStore.getState();

      let newProject;
      act(() => {
        newProject = addProject({
          name: 'GitHub Project',
          description: 'Has repository',
          path: '/path',
          repositoryUrl: 'https://github.com/test/repo',
        });
      });

      expect(newProject!.repositoryUrl).toBe('https://github.com/test/repo');
    });
  });

  describe('updateProject', () => {
    it('should update an existing project', () => {
      const { projects, updateProject, getProjectById } =
        useProjectStore.getState();
      const projectToUpdate = projects[0];

      act(() => {
        updateProject(projectToUpdate.id, { name: 'Updated Project Name' });
      });

      const updatedProject = getProjectById(projectToUpdate.id);
      expect(updatedProject?.name).toBe('Updated Project Name');
    });

    it('should update the updatedAt timestamp', () => {
      const { projects, updateProject, getProjectById } =
        useProjectStore.getState();
      const projectToUpdate = projects[0];
      const originalUpdatedAt = projectToUpdate.updatedAt;

      act(() => {
        updateProject(projectToUpdate.id, { description: 'New description' });
      });

      const updatedProject = getProjectById(projectToUpdate.id);
      expect(updatedProject?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should merge settings when provided', () => {
      const { projects, updateProject, getProjectById } =
        useProjectStore.getState();
      const projectToUpdate = projects[0];
      const originalSettings = { ...projectToUpdate.settings };

      act(() => {
        updateProject(projectToUpdate.id, {
          settings: { autoReviewEnabled: false },
        });
      });

      const updatedProject = getProjectById(projectToUpdate.id);
      expect(updatedProject?.settings?.autoReviewEnabled).toBe(false);
      // Other settings should be preserved
      expect(updatedProject?.settings?.notificationsEnabled).toBe(
        originalSettings?.notificationsEnabled
      );
    });

    it('should update recent projects when name changes', () => {
      const { projects, updateProject, recentProjects } =
        useProjectStore.getState();
      const projectInRecent = projects.find((p) =>
        recentProjects.some((r) => r.id === p.id)
      )!;

      act(() => {
        updateProject(projectInRecent.id, { name: 'Renamed Project' });
      });

      const { recentProjects: updatedRecent } = useProjectStore.getState();
      const recentEntry = updatedRecent.find((r) => r.id === projectInRecent.id);
      expect(recentEntry?.name).toBe('Renamed Project');
    });
  });

  describe('deleteProject', () => {
    it('should remove a project from the store', () => {
      const { projects, deleteProject, getProjectById } =
        useProjectStore.getState();
      const projectToDelete = projects[projects.length - 1]; // Delete last to avoid affecting currentProjectId
      const initialCount = projects.length;

      act(() => {
        deleteProject(projectToDelete.id);
      });

      const { projects: updatedProjects } = useProjectStore.getState();
      expect(updatedProjects.length).toBe(initialCount - 1);
      expect(getProjectById(projectToDelete.id)).toBeUndefined();
    });

    it('should clear selection if deleted project was selected', () => {
      const { projects, selectProject, deleteProject } =
        useProjectStore.getState();
      const projectToDelete = projects[1]; // Not the default selected one

      act(() => {
        selectProject(projectToDelete.id);
      });

      expect(useProjectStore.getState().currentProjectId).toBe(
        projectToDelete.id
      );

      act(() => {
        deleteProject(projectToDelete.id);
      });

      expect(useProjectStore.getState().currentProjectId).toBeNull();
    });

    it('should remove project from recent list', () => {
      const { recentProjects, deleteProject } = useProjectStore.getState();
      const recentProject = recentProjects[0];

      act(() => {
        deleteProject(recentProject.id);
      });

      const { recentProjects: updatedRecent } = useProjectStore.getState();
      expect(updatedRecent.find((r) => r.id === recentProject.id)).toBeUndefined();
    });
  });

  describe('selectProject', () => {
    it('should select a project', () => {
      const { projects, selectProject } = useProjectStore.getState();
      const projectToSelect = projects[1];

      act(() => {
        selectProject(projectToSelect.id);
      });

      expect(useProjectStore.getState().currentProjectId).toBe(
        projectToSelect.id
      );
    });

    it('should update lastOpenedAt when selecting', () => {
      const { projects, selectProject, getProjectById } =
        useProjectStore.getState();
      const projectToSelect = projects[1];
      const originalLastOpened = projectToSelect.lastOpenedAt;

      act(() => {
        selectProject(projectToSelect.id);
      });

      const selectedProject = getProjectById(projectToSelect.id);
      expect(selectedProject?.lastOpenedAt).not.toBe(originalLastOpened);
    });

    it('should add to recent projects when selecting', () => {
      const { projects, selectProject } = useProjectStore.getState();
      const projectToSelect = projects[projects.length - 1]; // Likely not in recents

      act(() => {
        selectProject(projectToSelect.id);
      });

      const { recentProjects } = useProjectStore.getState();
      expect(recentProjects[0].id).toBe(projectToSelect.id);
    });

    it('should not select non-existent project', () => {
      const { selectProject, currentProjectId: originalId } =
        useProjectStore.getState();

      act(() => {
        selectProject('non-existent-id');
      });

      expect(useProjectStore.getState().currentProjectId).toBe(originalId);
    });
  });

  describe('clearSelection', () => {
    it('should clear the current project selection', () => {
      const { projects, selectProject, clearSelection } =
        useProjectStore.getState();

      act(() => {
        selectProject(projects[0].id);
        clearSelection();
      });

      expect(useProjectStore.getState().currentProjectId).toBeNull();
    });
  });

  describe('Recent Projects', () => {
    it('should limit recent projects to maximum of 5', () => {
      const { addProject, selectProject } = useProjectStore.getState();

      // Add and select many projects
      act(() => {
        for (let i = 0; i < 10; i++) {
          const project = addProject({
            name: `Project ${i}`,
            description: `Description ${i}`,
            path: `/path/${i}`,
          });
          selectProject(project.id);
        }
      });

      const { recentProjects } = useProjectStore.getState();
      expect(recentProjects.length).toBeLessThanOrEqual(5);
    });

    it('should move project to front when re-selected', () => {
      const { recentProjects, selectProject } = useProjectStore.getState();
      const secondRecent = recentProjects[1];

      act(() => {
        selectProject(secondRecent.id);
      });

      const { recentProjects: updatedRecent } = useProjectStore.getState();
      expect(updatedRecent[0].id).toBe(secondRecent.id);
    });

    it('should remove project from recent list', () => {
      const { recentProjects, removeFromRecent } = useProjectStore.getState();
      const toRemove = recentProjects[0];
      const initialCount = recentProjects.length;

      act(() => {
        removeFromRecent(toRemove.id);
      });

      const { recentProjects: updatedRecent } = useProjectStore.getState();
      expect(updatedRecent.length).toBe(initialCount - 1);
      expect(updatedRecent.find((r) => r.id === toRemove.id)).toBeUndefined();
    });
  });

  describe('getProjectById', () => {
    it('should return the project with the given ID', () => {
      const { projects, getProjectById } = useProjectStore.getState();
      const expectedProject = projects[0];

      const foundProject = getProjectById(expectedProject.id);

      expect(foundProject).toEqual(expectedProject);
    });

    it('should return undefined for non-existent ID', () => {
      const { getProjectById } = useProjectStore.getState();

      const foundProject = getProjectById('non-existent-id');

      expect(foundProject).toBeUndefined();
    });
  });

  describe('getCurrentProject', () => {
    it('should return the currently selected project', () => {
      const { projects, selectProject, getCurrentProject } =
        useProjectStore.getState();
      const projectToSelect = projects[0];

      act(() => {
        selectProject(projectToSelect.id);
      });

      const currentProject = useProjectStore.getState().getCurrentProject();
      expect(currentProject?.id).toBe(projectToSelect.id);
    });

    it('should return undefined when no project is selected', () => {
      const { clearSelection, getCurrentProject } = useProjectStore.getState();

      act(() => {
        clearSelection();
      });

      const currentProject = useProjectStore.getState().getCurrentProject();
      expect(currentProject).toBeUndefined();
    });
  });

  describe('updateStats', () => {
    it('should update project stats', () => {
      const { projects, updateStats, getProjectById } =
        useProjectStore.getState();
      const project = projects[0];

      act(() => {
        updateStats(project.id, {
          completedTasks: 10,
          totalTasks: 20,
        });
      });

      const updatedProject = getProjectById(project.id);
      expect(updatedProject?.stats?.completedTasks).toBe(10);
      expect(updatedProject?.stats?.totalTasks).toBe(20);
    });

    it('should preserve other stats when partially updating', () => {
      const { projects, updateStats, getProjectById } =
        useProjectStore.getState();
      const project = projects[0];
      const originalInProgress = project.stats?.inProgressTasks ?? 0;

      act(() => {
        updateStats(project.id, { completedTasks: 99 });
      });

      const updatedProject = getProjectById(project.id);
      expect(updatedProject?.stats?.inProgressTasks).toBe(originalInProgress);
    });
  });

  describe('Filters', () => {
    it('should set filters', () => {
      const { setFilters } = useProjectStore.getState();

      act(() => {
        setFilters({ status: ['active'] });
      });

      const { filters } = useProjectStore.getState();
      expect(filters.status).toEqual(['active']);
    });

    it('should clear filters', () => {
      const { setFilters, clearFilters } = useProjectStore.getState();

      act(() => {
        setFilters({ status: ['active'], search: 'test' });
        clearFilters();
      });

      const { filters } = useProjectStore.getState();
      expect(filters).toEqual({});
    });

    it('should filter projects by status', () => {
      const { setFilters, getFilteredProjects } = useProjectStore.getState();

      act(() => {
        setFilters({ status: ['active'] });
      });

      const filteredProjects = getFilteredProjects();
      expect(filteredProjects.every((p) => p.status === 'active')).toBe(true);
    });

    it('should filter projects by search term', () => {
      const { setFilters, getFilteredProjects } = useProjectStore.getState();

      act(() => {
        setFilters({ search: 'mobile' });
      });

      const filteredProjects = getFilteredProjects();
      expect(filteredProjects.length).toBeGreaterThan(0);
      expect(
        filteredProjects.every(
          (p) =>
            p.name.toLowerCase().includes('mobile') ||
            p.description.toLowerCase().includes('mobile')
        )
      ).toBe(true);
    });

    it('should combine status and search filters', () => {
      const { setFilters, getFilteredProjects } = useProjectStore.getState();

      act(() => {
        setFilters({
          status: ['active'],
          search: 'api',
        });
      });

      const filteredProjects = getFilteredProjects();
      expect(
        filteredProjects.every(
          (p) =>
            p.status === 'active' &&
            (p.name.toLowerCase().includes('api') ||
              p.description.toLowerCase().includes('api'))
        )
      ).toBe(true);
    });
  });

  describe('getProjectsByStatus', () => {
    it('should return projects with the given status', () => {
      const { getProjectsByStatus } = useProjectStore.getState();

      const activeProjects = getProjectsByStatus('active');

      expect(activeProjects.every((p) => p.status === 'active')).toBe(true);
    });

    it('should return empty array for status with no projects', () => {
      const { getProjectsByStatus, projects, deleteProject } =
        useProjectStore.getState();

      // Delete all archived projects first if any exist
      const archivedProjects = projects.filter((p) => p.status === 'archived');
      act(() => {
        archivedProjects.forEach((p) => deleteProject(p.id));
      });

      const result = useProjectStore.getState().getProjectsByStatus('archived');
      expect(result).toEqual([]);
    });
  });

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const { setLoading } = useProjectStore.getState();

      act(() => {
        setLoading(true);
      });

      expect(useProjectStore.getState().isLoading).toBe(true);

      act(() => {
        setLoading(false);
      });

      expect(useProjectStore.getState().isLoading).toBe(false);
    });

    it('should set error message', () => {
      const { setError } = useProjectStore.getState();

      act(() => {
        setError('Failed to load projects');
      });

      expect(useProjectStore.getState().error).toBe('Failed to load projects');

      act(() => {
        setError(null);
      });

      expect(useProjectStore.getState().error).toBeNull();
    });
  });

  describe('resetStore', () => {
    it('should reset store to initial state', () => {
      const { addProject, setFilters, clearSelection, resetStore } =
        useProjectStore.getState();

      // Modify state
      act(() => {
        addProject({
          name: 'Temp Project',
          description: 'Will be reset',
          path: '/tmp',
        });
        setFilters({ status: ['paused'] });
        clearSelection();
      });

      // Reset
      act(() => {
        resetStore();
      });

      const state = useProjectStore.getState();
      expect(state.filters).toEqual({});
      expect(state.currentProjectId).toBeDefined();
    });
  });
});
