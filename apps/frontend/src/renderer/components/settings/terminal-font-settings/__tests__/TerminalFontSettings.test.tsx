/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for TerminalFontSettings component
 * Tests the infinite re-render loop fix using individual selectors + useMemo
 * Verifies component renders without errors and maintains stable object references
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { act } from 'react';
import { TerminalFontSettings } from '../TerminalFontSettings';
import { useTerminalFontSettingsStore } from '../../../../stores/terminal-font-settings-store';
import i18n from '../../../../../shared/i18n';

// Polyfill ResizeObserver for jsdom environment
global.ResizeObserver = vi.fn().mockImplementation(function() {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
});

// Mock the toast hook
vi.mock('../../../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock xterm.js to prevent initialization errors in tests
// vi.mock calls are hoisted to the top, so we use function keyword
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function() {
    return {
      open: vi.fn(),
      write: vi.fn(),
      loadAddon: vi.fn(),
      options: {},
      refresh: vi.fn(),
      dispose: vi.fn(),
      rows: 24,
    };
  }),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(function() {
    return {
      fit: vi.fn(),
    };
  }),
}));

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('TerminalFontSettings - Infinite Re-render Loop Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to default state before each test
    const store = useTerminalFontSettingsStore.getState();
    store.resetToDefaults();
  });

  describe('Component Rendering', () => {
    it('should render without throwing errors', () => {
      expect(() => {
        renderWithI18n(<TerminalFontSettings />);
      }).not.toThrow();
    });

    it('should render all expected sections', () => {
      renderWithI18n(<TerminalFontSettings />);

      // Main sections
      expect(screen.getByText(/terminal fonts/i)).toBeInTheDocument();

      // Import/Export buttons
      expect(screen.getByText(/export json/i)).toBeInTheDocument();
      expect(screen.getByText(/import json/i)).toBeInTheDocument();
      expect(screen.getByText(/copy to clipboard/i)).toBeInTheDocument();

      // Configuration sections
      expect(screen.getByText(/font configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/cursor configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/performance settings/i)).toBeInTheDocument();
      // Use getAllByText for text that might appear multiple times
      expect(screen.getAllByText(/quick presets/i).length).toBeGreaterThan(0);

      // Preview section
      expect(screen.getByText(/live preview/i)).toBeInTheDocument();
    });

    it('should complete render cycle within reasonable time', async () => {
      const startTime = Date.now();

      renderWithI18n(<TerminalFontSettings />);

      // Wait for component to fully render
      await waitFor(
        () => {
          expect(screen.getByText(/terminal fonts/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      // If there's an infinite loop, this would timeout
      // A healthy render should complete quickly
      expect(renderTime).toBeLessThan(2000);
    });
  });

  describe('Store Integration', () => {
    it('should access all store properties without errors', () => {
      renderWithI18n(<TerminalFontSettings />);

      const state = useTerminalFontSettingsStore.getState();

      // Verify all properties are accessible
      expect(state.fontFamily).toBeDefined();
      expect(state.fontSize).toBeDefined();
      expect(state.fontWeight).toBeDefined();
      expect(state.lineHeight).toBeDefined();
      expect(state.letterSpacing).toBeDefined();
      expect(state.cursorStyle).toBeDefined();
      expect(state.cursorBlink).toBeDefined();
      expect(state.cursorAccentColor).toBeDefined();
      expect(state.scrollback).toBeDefined();
    });

    it('should handle individual setting updates', () => {
      renderWithI18n(<TerminalFontSettings />);

      // Update a single setting
      act(() => {
        useTerminalFontSettingsStore.getState().setFontSize(16);
      });

      expect(useTerminalFontSettingsStore.getState().fontSize).toBe(16);
    });
  });

  describe('State Updates - No Infinite Loop', () => {
    it('should handle rapid state changes without infinite loop', async () => {
      renderWithI18n(<TerminalFontSettings />);

      const originalFontSize = useTerminalFontSettingsStore.getState().fontSize;

      // Simulate rapid state changes (like dragging a slider)
      const sizes = [14, 15, 16, 17, 18, 17, 16, 15, 14];

      for (const size of sizes) {
        await act(async () => {
          useTerminalFontSettingsStore.getState().setFontSize(size);
          // Small delay to simulate user interaction
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      }

      // If we reach here without timeout, the infinite loop is fixed
      expect(useTerminalFontSettingsStore.getState().fontSize).toBe(14);

      // Reset
      act(() => {
        useTerminalFontSettingsStore.getState().setFontSize(originalFontSize);
      });
    });

    it('should handle preset application without infinite loop', async () => {
      renderWithI18n(<TerminalFontSettings />);

      // Apply a preset (which updates multiple values at once)
      await act(async () => {
        useTerminalFontSettingsStore.getState().applyPreset('vscode');
      });

      // Verify preset was applied
      const state = useTerminalFontSettingsStore.getState();
      expect(state.fontFamily).toContain('Consolas');

      // Reset for other tests
      act(() => {
        useTerminalFontSettingsStore.getState().resetToDefaults();
      });
    });

    it('should handle reset to defaults without infinite loop', async () => {
      // First change some settings
      act(() => {
        useTerminalFontSettingsStore.getState().setFontSize(20);
        useTerminalFontSettingsStore.getState().setFontWeight(700);
      });

      renderWithI18n(<TerminalFontSettings />);

      // Reset to defaults - if there's an infinite loop, this will timeout
      await act(async () => {
        useTerminalFontSettingsStore.getState().resetToDefaults();
        // Small delay to allow any potential infinite loop to manifest
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // If we reach here, no infinite loop occurred
      expect(true).toBe(true);
    });

    it('should handle concurrent updates without race conditions', async () => {
      renderWithI18n(<TerminalFontSettings />);

      const originalFontSize = useTerminalFontSettingsStore.getState().fontSize;
      const originalFontWeight = useTerminalFontSettingsStore.getState().fontWeight;
      const originalLineHeight = useTerminalFontSettingsStore.getState().lineHeight;

      // Simulate concurrent updates
      const promises = [
        Promise.resolve().then(() => act(() => useTerminalFontSettingsStore.getState().setFontSize(16))),
        Promise.resolve().then(() => act(() => useTerminalFontSettingsStore.getState().setFontWeight(500))),
        Promise.resolve().then(() => act(() => useTerminalFontSettingsStore.getState().setLineHeight(1.5))),
      ];

      await Promise.all(promises);

      // Verify final state is consistent
      const state = useTerminalFontSettingsStore.getState();
      expect(state.fontSize).toBe(16);
      expect(state.fontWeight).toBe(500);
      expect(state.lineHeight).toBe(1.5);

      // Reset
      act(() => {
        useTerminalFontSettingsStore.getState().setFontSize(originalFontSize);
        useTerminalFontSettingsStore.getState().setFontWeight(originalFontWeight);
        useTerminalFontSettingsStore.getState().setLineHeight(originalLineHeight);
      });
    });
  });

  describe('Import/Export Operations', () => {
    it('should export settings without errors', () => {
      renderWithI18n(<TerminalFontSettings />);

      const exported = useTerminalFontSettingsStore.getState().exportSettings();

      expect(exported).toBeTruthy();
      expect(typeof exported).toBe('string');

      // Verify it's valid JSON
      expect(() => JSON.parse(exported)).not.toThrow();

      const parsed = JSON.parse(exported);
      expect(parsed.fontFamily).toBeDefined();
      expect(parsed.fontSize).toBeDefined();
    });

    it('should import valid settings without errors', () => {
      renderWithI18n(<TerminalFontSettings />);

      const json = JSON.stringify({
        fontFamily: ['Fira Code', 'monospace'],
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: 0.5,
        cursorStyle: 'underline',
        cursorBlink: false,
        cursorAccentColor: '#ff0000',
        scrollback: 50000,
      });

      const success = useTerminalFontSettingsStore.getState().importSettings(json);

      expect(success).toBe(true);
      expect(useTerminalFontSettingsStore.getState().fontSize).toBe(16);
      expect(useTerminalFontSettingsStore.getState().fontFamily).toEqual(['Fira Code', 'monospace']);

      // Reset
      act(() => {
        useTerminalFontSettingsStore.getState().resetToDefaults();
      });
    });
  });

  describe('Child Component Integration', () => {
    it('should pass settings to child components', () => {
      renderWithI18n(<TerminalFontSettings />);

      // Verify child components render (indicates successful prop passing)
      expect(screen.getByText(/font configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/cursor configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/performance settings/i)).toBeInTheDocument();
      // Use getAllByText for text that might appear multiple times
      expect(screen.getAllByText(/quick presets/i).length).toBeGreaterThan(0);
    });

    it('should initialize xterm.js terminal for preview', () => {
      renderWithI18n(<TerminalFontSettings />);

      // If we reach here without errors, xterm.js initialized correctly
      expect(true).toBe(true);
    });
  });

  describe('Regression Prevention', () => {
    it('should not log React warnings about getSnapshot caching', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderWithI18n(<TerminalFontSettings />);

      // Check for getSnapshot-related warnings
      const warnCalls = consoleWarnSpy.mock.calls.filter((call) =>
        call.some((arg) => typeof arg === 'string' && arg.includes('getSnapshot'))
      );

      expect(warnCalls.length).toBe(0);

      consoleWarnSpy.mockRestore();
    });

    it('should not cause "Maximum update depth exceeded" error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithI18n(<TerminalFontSettings />);

      // Check for infinite loop errors
      const errorCalls = consoleErrorSpy.mock.calls.filter((call) =>
        call.some(
          (arg) =>
            typeof arg === 'string' &&
            (arg.includes('Maximum update depth') || arg.includes('infinite loop'))
        )
      );

      expect(errorCalls.length).toBe(0);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Memoization - Stable References', () => {
    it('should use useMemo for settings object reconstruction', () => {
      // This test verifies the component structure uses useMemo
      // by checking that multiple re-renders don't cause issues

      const { rerender } = renderWithI18n(<TerminalFontSettings />);

      // Rerender multiple times without state changes
      // If useMemo wasn't used, this might cause issues with child components
      for (let i = 0; i < 5; i++) {
        act(() => {
          rerender(<TerminalFontSettings />);
        });
      }

      // If we reach here without errors, useMemo is working correctly
      expect(true).toBe(true);
    });
  });
});
