/**
 * Application configuration constants
 * Default settings, file paths, and project structure
 */

// ============================================
// UI Scale Constants
// ============================================

export const UI_SCALE_MIN = 75;
export const UI_SCALE_MAX = 200;
export const UI_SCALE_DEFAULT = 100;
export const UI_SCALE_STEP = 5;

// ============================================
// Terminal Font Constants
// ============================================

import type { TerminalFont } from '../types/settings';

export const TERMINAL_FONT_DEFAULT: TerminalFont = 'jetbrains-mono';

export interface TerminalFontDefinition {
  id: TerminalFont;
  name: string;
  description: string;
  cssFamily: string; // CSS font-family value
  hasLigatures: boolean;
}

export const TERMINAL_FONTS: TerminalFontDefinition[] = [
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    description: 'Modern font with ligatures',
    cssFamily: "'JetBrains Mono', monospace",
    hasLigatures: true
  },
  {
    id: 'fira-code',
    name: 'Fira Code',
    description: 'Popular font with ligatures',
    cssFamily: "'Fira Code', monospace",
    hasLigatures: true
  },
  {
    id: 'cascadia-code',
    name: 'Cascadia Code',
    description: 'Microsoft font with ligatures',
    cssFamily: "'Cascadia Code', monospace",
    hasLigatures: true
  },
  {
    id: 'source-code-pro',
    name: 'Source Code Pro',
    description: 'Adobe monospace font',
    cssFamily: "'Source Code Pro', monospace",
    hasLigatures: false
  },
  {
    id: 'menlo',
    name: 'Menlo',
    description: 'macOS default',
    cssFamily: "'Menlo', monospace",
    hasLigatures: false
  },
  {
    id: 'consolas',
    name: 'Consolas',
    description: 'Windows default',
    cssFamily: "'Consolas', monospace",
    hasLigatures: false
  },
  {
    id: 'sf-mono',
    name: 'SF Mono',
    description: 'San Francisco Mono (macOS)',
    cssFamily: "'SF Mono', monospace",
    hasLigatures: false
  },
  {
    id: 'monaco',
    name: 'Monaco',
    description: 'Classic macOS font',
    cssFamily: "'Monaco', monospace",
    hasLigatures: false
  },
  {
    id: 'courier-new',
    name: 'Courier New',
    description: 'Universal fallback',
    cssFamily: "'Courier New', monospace",
    hasLigatures: false
  },
  {
    id: 'ubuntu-mono',
    name: 'Ubuntu Mono',
    description: 'Ubuntu system font',
    cssFamily: "'Ubuntu Mono', monospace",
    hasLigatures: false
  },
  {
    id: 'dejavu-sans-mono',
    name: 'DejaVu Sans Mono',
    description: 'Open source font',
    cssFamily: "'DejaVu Sans Mono', monospace",
    hasLigatures: false
  },
  {
    id: 'hack',
    name: 'Hack',
    description: 'Font for source code',
    cssFamily: "'Hack', monospace",
    hasLigatures: false
  },
  {
    id: 'inconsolata',
    name: 'Inconsolata',
    description: 'Clean monospace font',
    cssFamily: "'Inconsolata', monospace",
    hasLigatures: false
  },
  {
    id: 'roboto-mono',
    name: 'Roboto Mono',
    description: 'Google font',
    cssFamily: "'Roboto Mono', monospace",
    hasLigatures: false
  }
];

// ============================================
// Default App Settings
// ============================================

export const DEFAULT_APP_SETTINGS = {
  theme: 'system' as const,
  colorTheme: 'default' as const,
  defaultModel: 'opus',
  agentFramework: 'auto-claude',
  pythonPath: undefined as string | undefined,
  gitPath: undefined as string | undefined,
  githubCLIPath: undefined as string | undefined,
  autoBuildPath: undefined as string | undefined,
  autoUpdateAutoBuild: true,
  autoNameTerminals: true,
  onboardingCompleted: false,
  notifications: {
    onTaskComplete: true,
    onTaskFailed: true,
    onReviewNeeded: true,
    sound: false
  },
  // Global API keys (used as defaults for all projects)
  globalClaudeOAuthToken: undefined as string | undefined,
  globalOpenAIApiKey: undefined as string | undefined,
  // Selected agent profile - defaults to 'auto' for per-phase optimized model selection
  selectedAgentProfile: 'auto',
  // Changelog preferences (persisted between sessions)
  changelogFormat: 'keep-a-changelog' as const,
  changelogAudience: 'user-facing' as const,
  changelogEmojiLevel: 'none' as const,
  // UI Scale (default 100% - standard size)
  uiScale: UI_SCALE_DEFAULT,
  // Beta updates opt-in (receive pre-release versions)
  betaUpdates: false,
  // Language preference (default to English)
  language: 'en' as const,
  // Terminal font (default JetBrains Mono)
  terminalFont: TERMINAL_FONT_DEFAULT
};

// ============================================
// Default Project Settings
// ============================================

export const DEFAULT_PROJECT_SETTINGS = {
  model: 'opus',
  memoryBackend: 'file' as const,
  linearSync: false,
  notifications: {
    onTaskComplete: true,
    onTaskFailed: true,
    onReviewNeeded: true,
    sound: false
  },
  // Graphiti MCP server for agent-accessible knowledge graph (enabled by default)
  graphitiMcpEnabled: true,
  graphitiMcpUrl: 'http://localhost:8000/mcp/',
  // Include CLAUDE.md instructions in agent context (enabled by default)
  useClaudeMd: true
};

// ============================================
// Auto Build File Paths
// ============================================

// File paths relative to project
// IMPORTANT: All paths use .auto-claude/ (the installed instance), NOT auto-claude/ (source code)
export const AUTO_BUILD_PATHS = {
  SPECS_DIR: '.auto-claude/specs',
  ROADMAP_DIR: '.auto-claude/roadmap',
  IDEATION_DIR: '.auto-claude/ideation',
  IMPLEMENTATION_PLAN: 'implementation_plan.json',
  SPEC_FILE: 'spec.md',
  QA_REPORT: 'qa_report.md',
  BUILD_PROGRESS: 'build-progress.txt',
  CONTEXT: 'context.json',
  REQUIREMENTS: 'requirements.json',
  ROADMAP_FILE: 'roadmap.json',
  ROADMAP_DISCOVERY: 'roadmap_discovery.json',
  COMPETITOR_ANALYSIS: 'competitor_analysis.json',
  IDEATION_FILE: 'ideation.json',
  IDEATION_CONTEXT: 'ideation_context.json',
  PROJECT_INDEX: '.auto-claude/project_index.json',
  GRAPHITI_STATE: '.graphiti_state.json'
} as const;

/**
 * Get the specs directory path.
 * All specs go to .auto-claude/specs/ (the project's data directory).
 */
export function getSpecsDir(autoBuildPath: string | undefined): string {
  const basePath = autoBuildPath || '.auto-claude';
  return `${basePath}/specs`;
}
