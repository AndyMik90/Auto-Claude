import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isWindows, isMacOS, isLinux } from '../../shared/platform';

/**
 * Terminal font settings interface
 */
export interface TerminalFontSettings {
  fontFamily: string[];
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  cursorAccentColor: string;
  scrollback: number;
}

/**
 * Get OS-specific default font settings
 */
function getOSDefaults(): TerminalFontSettings {
  if (isWindows()) {
    return {
      fontFamily: ['Cascadia Code', 'Consolas', 'Courier New', 'monospace'],
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorStyle: 'block',
      cursorBlink: true,
      cursorAccentColor: '#000000',
      scrollback: 10000,
    };
  }

  if (isMacOS()) {
    return {
      fontFamily: ['SF Mono', 'Menlo', 'Monaco', 'monospace'],
      fontSize: 13,
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorStyle: 'block',
      cursorBlink: true,
      cursorAccentColor: '#000000',
      scrollback: 10000,
    };
  }

  if (isLinux()) {
    return {
      fontFamily: ['Ubuntu Mono', 'Source Code Pro', 'Liberation Mono', 'DejaVu Sans Mono', 'monospace'],
      fontSize: 13,
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorStyle: 'block',
      cursorBlink: true,
      cursorAccentColor: '#000000',
      scrollback: 10000,
    };
  }

  // Fallback for unknown platforms
  return {
    fontFamily: ['monospace'],
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
    cursorStyle: 'block',
    cursorBlink: true,
    cursorAccentColor: '#000000',
    scrollback: 10000,
  };
}

/**
 * Preset configurations for popular IDEs and terminals
 */
export const TERMINAL_PRESETS: Record<string, TerminalFontSettings> = {
  'vscode': {
    fontFamily: ['Consolas', 'Courier New', 'monospace'],
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
    cursorStyle: 'block',
    cursorBlink: true,
    cursorAccentColor: '#000000',
    scrollback: 10000,
  },
  'intellij': {
    fontFamily: ['JetBrains Mono', 'Consolas', 'monospace'],
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
    cursorStyle: 'block',
    cursorBlink: true,
    cursorAccentColor: '#000000',
    scrollback: 10000,
  },
  'macos': {
    fontFamily: ['SF Mono', 'Menlo', 'Monaco', 'monospace'],
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
    cursorStyle: 'block',
    cursorBlink: true,
    cursorAccentColor: '#000000',
    scrollback: 10000,
  },
  'ubuntu': {
    fontFamily: ['Ubuntu Mono', 'monospace'],
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
    cursorStyle: 'block',
    cursorBlink: true,
    cursorAccentColor: '#ffffff',
    scrollback: 10000,
  },
};

interface TerminalFontSettingsStore extends TerminalFontSettings {
  // Actions
  setFontFamily: (fonts: string[]) => void;
  setFontSize: (size: number) => void;
  setFontWeight: (weight: number) => void;
  setLineHeight: (height: number) => void;
  setLetterSpacing: (spacing: number) => void;
  setCursorStyle: (style: 'block' | 'underline' | 'bar') => void;
  setCursorBlink: (blink: boolean) => void;
  setCursorAccentColor: (color: string) => void;
  setScrollback: (scrollback: number) => void;

  // Bulk actions
  applyPreset: (presetName: string) => void;
  resetToDefaults: () => void;
  applySettings: (settings: Partial<TerminalFontSettings>) => void;

  // Import/Export
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
}

/**
 * Zustand store for terminal font settings with localStorage persistence
 */
export const useTerminalFontSettingsStore = create<TerminalFontSettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state with OS-specific defaults
      ...getOSDefaults(),

      // Font setters
      setFontFamily: (fontFamily) => set({ fontFamily }),

      setFontSize: (fontSize) => set({ fontSize }),

      setFontWeight: (fontWeight) => set({ fontWeight }),

      setLineHeight: (lineHeight) => set({ lineHeight }),

      setLetterSpacing: (letterSpacing) => set({ letterSpacing }),

      // Cursor setters
      setCursorStyle: (cursorStyle) => set({ cursorStyle }),

      setCursorBlink: (cursorBlink) => set({ cursorBlink }),

      setCursorAccentColor: (cursorAccentColor) => set({ cursorAccentColor }),

      // Performance setter
      setScrollback: (scrollback) => set({ scrollback }),

      // Bulk actions
      applyPreset: (presetName: string) => {
        const preset = TERMINAL_PRESETS[presetName];
        if (preset) {
          set(preset);
        }
      },

      resetToDefaults: () => set(getOSDefaults()),

      applySettings: (settings: Partial<TerminalFontSettings>) =>
        set((state) => ({
          ...state,
          ...settings,
        })),

      // Import/Export
      exportSettings: (): string => {
        const state = get();
        return JSON.stringify({
          fontFamily: state.fontFamily,
          fontSize: state.fontSize,
          fontWeight: state.fontWeight,
          lineHeight: state.lineHeight,
          letterSpacing: state.letterSpacing,
          cursorStyle: state.cursorStyle,
          cursorBlink: state.cursorBlink,
          cursorAccentColor: state.cursorAccentColor,
          scrollback: state.scrollback,
        }, null, 2);
      },

      importSettings: (json: string) => {
        try {
          const parsed = JSON.parse(json);

          // Validate parsed object has required fields
          if (
            typeof parsed !== 'object' ||
            !Array.isArray(parsed.fontFamily) ||
            typeof parsed.fontSize !== 'number' ||
            typeof parsed.fontWeight !== 'number' ||
            typeof parsed.lineHeight !== 'number' ||
            typeof parsed.letterSpacing !== 'number' ||
            !['block', 'underline', 'bar'].includes(parsed.cursorStyle) ||
            typeof parsed.cursorBlink !== 'boolean' ||
            typeof parsed.cursorAccentColor !== 'string' ||
            typeof parsed.scrollback !== 'number'
          ) {
            return false;
          }

          // Apply imported settings
          set(parsed as Partial<TerminalFontSettings>);
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'terminal-font-settings',
    }
  )
);
