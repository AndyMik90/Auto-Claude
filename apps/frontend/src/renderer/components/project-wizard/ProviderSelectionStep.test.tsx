/**
 * @vitest-environment jsdom
 */
/**
 * ProviderSelectionStep component tests
 *
 * Tests for the provider selection step in the project wizard.
 * Verifies provider selection UI, GitHub/GitLab toggles, and navigation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProviderSelectionStep } from './ProviderSelectionStep';

// Mock react-i18next with project-wizard translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'provider.title': 'Connect Git Hosting',
        'provider.description': 'Choose which git hosting providers you\'d like to integrate with',
        'provider.optionalLabel': 'Optional - Skip if you\'ll configure later',
        'provider.helpText': 'You can configure one or both providers, or skip to configure later',
        'provider.skip': 'Skip for now',
        'project.back': 'Back',
        'project.continue': 'Continue'
      };
      return translations[key] || key;
    },
    i18n: { language: 'en' }
  })
}));

describe('ProviderSelectionStep Component Tests', () => {
  const defaultProps = {
    onComplete: vi.fn(),
    onBack: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the provider selection step with all elements', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      expect(screen.getByText('Connect Git Hosting')).toBeInTheDocument();
      expect(screen.getByText(/Choose which git hosting providers/)).toBeInTheDocument();
      expect(screen.getByText('Optional - Skip if you\'ll configure later')).toBeInTheDocument();
    });

    it('should show both GitHub and GitLab provider options', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('Connect your GitHub repository for branch and PR management')).toBeInTheDocument();
      expect(screen.getByText('GitLab')).toBeInTheDocument();
      expect(screen.getByText('Connect your GitLab project for merge request management')).toBeInTheDocument();
    });

    it('should show help text', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      expect(screen.getByText(/You can configure one or both providers/)).toBeInTheDocument();
    });

    it('should have back button', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    it('should have skip and continue buttons', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      expect(screen.getByText('Skip for now')).toBeInTheDocument();
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });
  });

  describe('Provider Selection', () => {
    it('should select GitHub when clicked', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const githubButton = screen.getByText('GitHub').closest('button');
      fireEvent.click(githubButton!);

      // GitHub should be selected (button has different styling)
      expect(githubButton).toHaveClass('border-primary');
    });

    it('should select GitLab when clicked', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const gitlabButton = screen.getByText('GitLab').closest('button');
      fireEvent.click(gitlabButton!);

      // GitLab should be selected
      expect(gitlabButton).toHaveClass('border-primary');
    });

    it('should allow selecting both GitHub and GitLab', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const githubButton = screen.getByText('GitHub').closest('button');
      const gitlabButton = screen.getByText('GitLab').closest('button');

      fireEvent.click(githubButton!);
      fireEvent.click(gitlabButton!);

      // Both should be selected
      expect(githubButton).toHaveClass('border-primary');
      expect(gitlabButton).toHaveClass('border-primary');
    });

    it('should deselect provider when clicked again', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const githubButton = screen.getByText('GitHub').closest('button');
      fireEvent.click(githubButton!);
      fireEvent.click(githubButton!);

      // Should be deselected
      expect(githubButton).not.toHaveClass('border-primary');
    });
  });

  describe('Complete Handler', () => {
    it('should call onComplete with github: true when only GitHub selected', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const githubButton = screen.getByText('GitHub').closest('button');
      fireEvent.click(githubButton!);

      const continueButton = screen.getByText('Continue');
      fireEvent.click(continueButton);

      expect(defaultProps.onComplete).toHaveBeenCalledWith({
        github: true,
        gitlab: false
      });
    });

    it('should call onComplete with gitlab: true when only GitLab selected', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const gitlabButton = screen.getByText('GitLab').closest('button');
      fireEvent.click(gitlabButton!);

      const continueButton = screen.getByText('Continue');
      fireEvent.click(continueButton);

      expect(defaultProps.onComplete).toHaveBeenCalledWith({
        github: false,
        gitlab: true
      });
    });

    it('should call onComplete with both true when both providers selected', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const githubButton = screen.getByText('GitHub').closest('button');
      const gitlabButton = screen.getByText('GitLab').closest('button');
      fireEvent.click(githubButton!);
      fireEvent.click(gitlabButton!);

      const continueButton = screen.getByText('Continue');
      fireEvent.click(continueButton);

      expect(defaultProps.onComplete).toHaveBeenCalledWith({
        github: true,
        gitlab: true
      });
    });

    it('should call onComplete with both false when no providers selected', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const continueButton = screen.getByText('Continue');
      fireEvent.click(continueButton);

      expect(defaultProps.onComplete).toHaveBeenCalledWith({
        github: false,
        gitlab: false
      });
    });

    it('should call onComplete with both false when skip is clicked', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const skipButton = screen.getByText('Skip for now');
      fireEvent.click(skipButton);

      expect(defaultProps.onComplete).toHaveBeenCalledWith({
        github: false,
        gitlab: false
      });
    });
  });

  describe('Back Handler', () => {
    it('should call onBack when back button is clicked', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);

      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const githubButton = screen.getByText('GitHub').closest('button');
      const gitlabButton = screen.getByText('GitLab').closest('button');
      const backButton = screen.getByText('Back');
      const skipButton = screen.getByText('Skip for now');
      const continueButton = screen.getByText('Continue');

      expect(githubButton?.tagName).toBe('BUTTON');
      expect(gitlabButton?.tagName).toBe('BUTTON');
      expect(backButton.tagName).toBe('BUTTON');
      expect(skipButton.tagName).toBe('BUTTON');
      expect(continueButton.tagName).toBe('BUTTON');
    });

    it('should have descriptive text for each provider option', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      expect(screen.getByText('Connect your GitHub repository for branch and PR management')).toBeInTheDocument();
      expect(screen.getByText('Connect your GitLab project for merge request management')).toBeInTheDocument();
    });
  });

  describe('AC Coverage', () => {
    it('AC1: should display provider selection screen', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      expect(screen.getByText('Connect Git Hosting')).toBeInTheDocument();
      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('GitLab')).toBeInTheDocument();
    });

    it('AC2: should allow selecting GitHub provider', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const githubButton = screen.getByText('GitHub').closest('button');
      fireEvent.click(githubButton!);

      const continueButton = screen.getByText('Continue');
      fireEvent.click(continueButton);

      expect(defaultProps.onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ github: true })
      );
    });

    it('AC3: should allow selecting GitLab provider', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const gitlabButton = screen.getByText('GitLab').closest('button');
      fireEvent.click(gitlabButton!);

      const continueButton = screen.getByText('Continue');
      fireEvent.click(continueButton);

      expect(defaultProps.onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ gitlab: true })
      );
    });

    it('AC4: should allow skipping provider selection', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      const skipButton = screen.getByText('Skip for now');
      fireEvent.click(skipButton);

      expect(defaultProps.onComplete).toHaveBeenCalledWith({
        github: false,
        gitlab: false
      });
    });

    it('AC5: should have back button for navigation', () => {
      render(<ProviderSelectionStep {...defaultProps} />);

      expect(screen.getByText('Back')).toBeInTheDocument();

      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);

      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });
  });
});
