/**
 * @vitest-environment jsdom
 */
/**
 * Tests for AuthStatusIndicator component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { initReactI18next } from react-i18next } from 'react-i18next';
import { AuthStatusIndicator } from './AuthStatusIndicator';
import { useSettingsStore } from '../stores/settings-store';
import type { APIProfile } from '../../shared/types/profile';

// Mock the settings store
vi.mock('../stores/settings-store', () => ({
  useSettingsStore: vi.fn()
}));

// Initialize i18next for tests
import { initReactI18next } from react-i18next({
  react: {
    useSuspense: false
  },
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        'common': {
          'authentication': 'Authentication',
          'apiProfile': 'API Profile',
          'oauth': 'OAuth',
          'provider': 'Provider',
          'profile': 'Profile',
          'id': 'ID',
          'apiEndpoint': 'API Endpoint',
          'notAvailable': 'N/A'
        },
        'usage': {
          'dataUnavailable': 'Usage data unavailable',
          'authentication': 'Authentication',
          'authenticationAriaLabel': 'Authentication: {{provider}}',
          'provider': 'Provider',
          'providerAnthropic': 'Anthropic',
          'providerZai': 'z.ai',
          'providerZhipu': 'ZHIPU AI'
        }
      }
    }
  }
});

// Wrap component with I18nextProvider for tests
function renderWithI18next(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={{
    resources: {
      en: {
        translation: {
          'common': {
            'authentication': 'Authentication',
            'apiProfile': 'API Profile',
            'oauth': 'OAuth',
            'provider': 'Provider',
            'profile': 'Profile',
            'id': 'ID',
            'apiEndpoint': 'API Endpoint',
            'notAvailable': 'N/A'
          },
          'usage': {
            'dataUnavailable': 'Usage data unavailable',
            'authentication': 'Authentication',
            'authenticationAriaLabel': 'Authentication: {{provider}}',
            'provider': 'Provider',
            'providerAnthropic': 'Anthropic',
            'providerZai': 'z.ai',
            'providerZhipu': 'ZHIPU AI'
          }
        }
      }
    }
  }}>
    {ui}
  </I18nextProvider>);
}

/**
 * Creates a mock settings store with optional overrides
 * @param overrides - Partial store state to override defaults
 * @returns Complete mock settings store object
 */
function createUseSettingsStoreMock(overrides?: Partial<ReturnType<typeof useSettingsStore>>) {
  return {
    profiles: testProfiles,
    activeProfileId: null,
    deleteProfile: vi.fn().mockResolvedValue(true),
    setActiveProfile: vi.fn().mockResolvedValue(true),
    profilesLoading: false,
    settings: {} as any,
    isLoading: false,
    error: null,
    setSettings: vi.fn(),
    updateSettings: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    setProfiles: vi.fn(),
    setProfilesLoading: vi.fn(),
    setProfilesError: vi.fn(),
    saveProfile: vi.fn().mockResolvedValue(true),
    updateProfile: vi.fn().mockResolvedValue(true),
    profilesError: null,
    ...overrides
  };
}

// Test profile data
const testProfiles: APIProfile[] = [
  {
    id: 'profile-1',
    name: 'Production API',
    baseUrl: 'https://api.anthropic.com',
    apiKey: 'sk-ant-prod-key-1234',
    models: { default: 'claude-sonnet-4-5-20250929' },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'profile-2',
    name: 'Development API',
    baseUrl: 'https://dev-api.example.com/v1',
    apiKey: 'sk-ant-test-key-5678',
    models: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'profile-3',
    name: 'z.ai Global',
    baseUrl: 'https://api.z.ai/api/anthropic',
    apiKey: 'sk-zai-key-1234',
    models: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'profile-4',
    name: 'ZHIPU China',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKey: 'zhipu-key-5678',
    models: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

describe('AuthStatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.electronAPI usage functions
    (window as any).electronAPI = {
      onUsageUpdated: vi.fn(() => vi.fn()), // Returns unsubscribe function
      requestUsageUpdate: vi.fn().mockResolvedValue({ success: false, data: null })
    };
  });

  describe('when using OAuth (no active profile)', () => {
    beforeEach(() => {
      vi.mocked(useSettingsStore).mockReturnValue(
        createUseSettingsStoreMock({ activeProfileId: null })
      );
    });

    it('should display Anthropic provider with Lock icon', () => {
      render(<AuthStatusIndicator />);

      expect(screen.getByText('Anthropic')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /authentication: anthropic/i })).toBeInTheDocument();
    });

    it('should have correct aria-label for OAuth', () => {
      render(<AuthStatusIndicator />);

      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Authentication: Anthropic');
    });
  });

  describe('when using API profile', () => {
    beforeEach(() => {
      vi.mocked(useSettingsStore).mockReturnValue(
        createUseSettingsStoreMock({ activeProfileId: 'profile-1' })
      );
    });

    it('should display provider label (Anthropic) with Key icon', () => {
      render(<AuthStatusIndicator />);

      expect(screen.getByText('Anthropic')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /authentication: anthropic/i })).toBeInTheDocument();
    });

    it('should have correct aria-label for profile', () => {
      render(<AuthStatusIndicator />);

      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Authentication: Anthropic');
    });
  });

  describe('when active profile ID references non-existent profile', () => {
    beforeEach(() => {
      vi.mocked(useSettingsStore).mockReturnValue(
        createUseSettingsStoreMock({ activeProfileId: 'non-existent-id' })
      );
    });

    it('should fallback to Anthropic provider display', () => {
      render(<AuthStatusIndicator />);

      expect(screen.getByText('Anthropic')).toBeInTheDocument();
    });
  });

  describe('provider detection for different API profiles', () => {
    it('should display z.ai provider label for z.ai profile', () => {
      vi.mocked(useSettingsStore).mockReturnValue(
        createUseSettingsStoreMock({ activeProfileId: 'profile-3' })
      );

      render(<AuthStatusIndicator />);

      expect(screen.getByText('z.ai')).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Authentication: z.ai');
    });

    it('should display ZHIPU AI provider label for ZHIPU profile', () => {
      vi.mocked(useSettingsStore).mockReturnValue(
        createUseSettingsStoreMock({ activeProfileId: 'profile-4' })
      );

      render(<AuthStatusIndicator />);

      expect(screen.getByText('ZHIPU AI')).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Authentication: ZHIPU AI');
    });

    it('should apply correct color classes for each provider', () => {
      // Test Anthropic (orange)
      vi.mocked(useSettingsStore).mockReturnValue(
        createUseSettingsStoreMock({ activeProfileId: 'profile-1' })
      );

      const { rerender } = render(<AuthStatusIndicator />);
      const anthropicButton = screen.getByRole('button');
      expect(anthropicButton.className).toContain('text-orange-500');

      // Test z.ai (blue)
      vi.mocked(useSettingsStore).mockReturnValue(
        createUseSettingsStoreMock({ activeProfileId: 'profile-3' })
      );

      rerender(<AuthStatusIndicator />);
      const zaiButton = screen.getByRole('button');
      expect(zaiButton.className).toContain('text-blue-500');

      // Test ZHIPU (purple)
      vi.mocked(useSettingsStore).mockReturnValue(
        createUseSettingsStoreMock({ activeProfileId: 'profile-4' })
      );

      rerender(<AuthStatusIndicator />);
      const zhipuButton = screen.getByRole('button');
      expect(zhipuButton.className).toContain('text-purple-500');
    });
  });

  describe('component structure', () => {
    beforeEach(() => {
      vi.mocked(useSettingsStore).mockReturnValue(
        createUseSettingsStoreMock()
      );
    });

    it('should be a valid React component', () => {
      expect(() => render(<AuthStatusIndicator />)).not.toThrow();
    });
  });
});
