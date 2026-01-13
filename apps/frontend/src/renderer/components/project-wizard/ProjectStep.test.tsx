/**
 * @vitest-environment jsdom
 */
/**
 * ProjectStep component tests
 *
 * Tests for the project selection step in the project wizard.
 * Verifies open existing and create new options, cancel button, and project addition.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProjectStep } from './ProjectStep';
import type { Project } from '../../../shared/types';

// Mock react-i18next with project-wizard translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'project.title': 'Add Project',
        'project.description': 'Choose how you\'d like to add a project',
        'project.openExisting': 'Open Existing Folder',
        'project.openExistingDescription': 'Browse to an existing project on your computer',
        'project.createNew': 'Create New Project',
        'project.createNewDescription': 'Start fresh with a new project folder',
        'project.openExistingAriaLabel': 'Open existing project folder',
        'project.createNewAriaLabel': 'Create new project folder',
        'wizard.cancel': 'Cancel'
      };
      return translations[key] || key;
    },
    i18n: { language: 'en' }
  })
}));

// Mock electronAPI
const mockSelectDirectory = vi.fn().mockResolvedValue('/path/to/project');
const mockAddProject = vi.fn().mockResolvedValue({
  success: true,
  data: {
    id: 'test-project-id',
    name: 'test-project',
    path: '/path/to/project',
    autoBuildPath: '',
    settings: {
      model: 'claude-sonnet-4-5-20250929',
      memoryBackend: 'graphiti',
      linearSync: false,
      notifications: {
        onTaskComplete: true,
        onTaskFailed: true,
        onReviewNeeded: false,
        sound: false
      },
      graphitiMcpEnabled: false
    },
    createdAt: new Date(),
    updatedAt: new Date()
  } as Project
});
const mockDetectMainBranch = vi.fn().mockResolvedValue({
  success: true,
  data: 'main'
});
const mockUpdateProjectSettings = vi.fn().mockResolvedValue({ success: true });

Object.defineProperty(window, 'electronAPI', {
  value: {
    selectDirectory: mockSelectDirectory,
    addProject: mockAddProject,
    detectMainBranch: mockDetectMainBranch,
    updateProjectSettings: mockUpdateProjectSettings
  },
  writable: true
});

describe('ProjectStep Component Tests', () => {
  const defaultProps = {
    onNext: vi.fn(),
    onCreateNew: vi.fn(),
    onBack: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the project step with all elements', () => {
      render(<ProjectStep {...defaultProps} />);

      // Check for heading
      expect(screen.getByText('Add Project')).toBeInTheDocument();

      // Check for description
      expect(screen.getByText('Choose how you\'d like to add a project')).toBeInTheDocument();

      // Check for options
      expect(screen.getByText('Open Existing Folder')).toBeInTheDocument();
      expect(screen.getByText('Create New Project')).toBeInTheDocument();

      // Check for cancel button
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should display two option cards with equal visual weight', () => {
      const { container } = render(<ProjectStep {...defaultProps} />);

      // Check for grid layout with two columns
      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
      expect(grid?.className).toContain('md:grid-cols-2');
    });

    it('should show icons for each option', () => {
      const { container } = render(<ProjectStep {...defaultProps} />);

      // Check for icon containers
      const iconContainers = container.querySelectorAll('.bg-primary\\/10');
      expect(iconContainers.length).toBeGreaterThanOrEqual(1);
    });

    it('should show descriptions for each option', () => {
      render(<ProjectStep {...defaultProps} />);

      expect(screen.getByText('Browse to an existing project on your computer')).toBeInTheDocument();
      expect(screen.getByText('Start fresh with a new project folder')).toBeInTheDocument();
    });
  });

  describe('Open Existing Project Handler', () => {
    it('should call selectDirectory when Open Existing is clicked', async () => {
      render(<ProjectStep {...defaultProps} />);

      const openExistingButton = screen.getByLabelText('Open existing project folder');
      fireEvent.click(openExistingButton);

      await waitFor(() => {
        expect(mockSelectDirectory).toHaveBeenCalled();
      });
    });

    it('should call addProject after directory selection', async () => {
      render(<ProjectStep {...defaultProps} />);

      const openExistingButton = screen.getByLabelText('Open existing project folder');
      fireEvent.click(openExistingButton);

      await waitFor(() => {
        expect(mockAddProject).toHaveBeenCalledWith('/path/to/project');
      });
    });

    it('should detect main branch for existing projects', async () => {
      render(<ProjectStep {...defaultProps} />);

      const openExistingButton = screen.getByLabelText('Open existing project folder');
      fireEvent.click(openExistingButton);

      await waitFor(() => {
        expect(mockDetectMainBranch).toHaveBeenCalledWith('/path/to/project');
        expect(mockUpdateProjectSettings).toHaveBeenCalled();
      });
    });

    it('should call onNext with project data when successfully opened', async () => {
      const mockOnNext = vi.fn();
      render(<ProjectStep {...defaultProps} onNext={mockOnNext} />);

      const openExistingButton = screen.getByLabelText('Open existing project folder');
      fireEvent.click(openExistingButton);

      await waitFor(() => {
        expect(mockOnNext).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'test-project-id',
            name: 'test-project',
            path: '/path/to/project'
          }),
          true, // needsGit
          true  // needsAutoClaude
        );
      });
    });

    it('should handle directory selection cancellation gracefully', async () => {
      mockSelectDirectory.mockResolvedValueOnce(null);

      render(<ProjectStep {...defaultProps} />);

      const openExistingButton = screen.getByLabelText('Open existing project folder');
      fireEvent.click(openExistingButton);

      await waitFor(() => {
        expect(mockSelectDirectory).toHaveBeenCalled();
        expect(mockAddProject).not.toHaveBeenCalled();
        expect(defaultProps.onNext).not.toHaveBeenCalled();
      });
    });

    it('should handle project addition failure gracefully', async () => {
      mockAddProject.mockResolvedValueOnce({
        success: false,
        error: 'Failed to add project'
      });

      render(<ProjectStep {...defaultProps} />);

      const openExistingButton = screen.getByLabelText('Open existing project folder');
      fireEvent.click(openExistingButton);

      await waitFor(() => {
        expect(mockAddProject).toHaveBeenCalled();
        expect(defaultProps.onNext).not.toHaveBeenCalled();
      });
    });

    it('should handle main branch detection failure gracefully', async () => {
      mockDetectMainBranch.mockResolvedValueOnce({
        success: false
      });

      render(<ProjectStep {...defaultProps} />);

      const openExistingButton = screen.getByLabelText('Open existing project folder');
      fireEvent.click(openExistingButton);

      await waitFor(() => {
        // Should still call onNext despite main branch detection failure
        expect(defaultProps.onNext).toHaveBeenCalled();
      });
    });
  });

  describe('Create New Project Handler', () => {
    it('should call onCreateNew when Create New is clicked', () => {
      render(<ProjectStep {...defaultProps} />);

      const createNewButton = screen.getByLabelText('Create new project folder');
      fireEvent.click(createNewButton);

      expect(defaultProps.onCreateNew).toHaveBeenCalledTimes(1);
    });

    it('should not call onNext when Create New is clicked', () => {
      render(<ProjectStep {...defaultProps} />);

      const createNewButton = screen.getByLabelText('Create new project folder');
      fireEvent.click(createNewButton);

      expect(defaultProps.onNext).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Button Handler', () => {
    it('should call onBack when cancel is clicked', () => {
      render(<ProjectStep {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels for option buttons', () => {
      render(<ProjectStep {...defaultProps} />);

      expect(screen.getByLabelText('Open existing project folder')).toBeInTheDocument();
      expect(screen.getByLabelText('Create new project folder')).toBeInTheDocument();
    });

    it('should have proper button roles', () => {
      render(<ProjectStep {...defaultProps} />);

      const openExistingButton = screen.getByLabelText('Open existing project folder');
      const createNewButton = screen.getByLabelText('Create new project folder');
      const cancelButton = screen.getByText('Cancel');

      expect(openExistingButton.tagName).toBe('BUTTON');
      expect(createNewButton.tagName).toBe('BUTTON');
      expect(cancelButton.tagName).toBe('BUTTON');
    });
  });

  describe('Visual Consistency', () => {
    it('should follow the onboarding visual pattern', () => {
      const { container } = render(<ProjectStep {...defaultProps} />);

      // Check for container with proper classes
      const mainContainer = container.querySelector('.flex.h-full.flex-col');
      expect(mainContainer).toBeInTheDocument();

      // Check for max-w-2xl content wrapper
      const contentWrapper = container.querySelector('.max-w-2xl');
      expect(contentWrapper).toBeInTheDocument();

      // Check for centered text
      const centeredText = container.querySelector('.text-center');
      expect(centeredText).toBeInTheDocument();
    });

    it('should have proper styling for option cards', () => {
      const { container } = render(<ProjectStep {...defaultProps} />);

      // Check for card styling
      const cards = container.querySelectorAll('.rounded-xl');
      expect(cards.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('AC Coverage', () => {
    it('AC1: should display project selection with two clear options', () => {
      render(<ProjectStep {...defaultProps} />);

      expect(screen.getByText('Open Existing Folder')).toBeInTheDocument();
      expect(screen.getByText('Create New Project')).toBeInTheDocument();
    });

    it('AC2: should provide descriptions for each option', () => {
      render(<ProjectStep {...defaultProps} />);

      expect(screen.getByText('Browse to an existing project on your computer')).toBeInTheDocument();
      expect(screen.getByText('Start fresh with a new project folder')).toBeInTheDocument();
    });

    it('AC3: should have a cancel button', () => {
      render(<ProjectStep {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('AC4: should navigate correctly for each option', () => {
      render(<ProjectStep {...defaultProps} />);

      // Create new calls onCreateNew
      const createNewButton = screen.getByLabelText('Create new project folder');
      fireEvent.click(createNewButton);
      expect(defaultProps.onCreateNew).toHaveBeenCalled();

      // Open existing triggers directory selection
      const openExistingButton = screen.getByLabelText('Open existing project folder');
      fireEvent.click(openExistingButton);
      expect(mockSelectDirectory).toHaveBeenCalled();
    });
  });
});
