/**
 * Tests for settings onboarding migration logic
 *
 * Tests the SETTINGS_CLAUDE_CODE_GET_ONBOARDING_STATUS handler which
 * reads ~/.claude.json to check if Claude Code onboarding is complete.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Store registered IPC handlers so we can call them directly
type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const registeredHandlers: Map<string, IpcHandler> = new Map();

// Mock electron app
const mockHomeDir = tmpdir();
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      registeredHandlers.set(channel, handler);
    }),
  },
  app: {
    getPath: vi.fn((_pathName: string) => mockHomeDir),
    getAppPath: vi.fn(() => mockHomeDir),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
  },
}));

// Mock @electron-toolkit/utils
vi.mock('@electron-toolkit/utils', () => ({
  is: {
    dev: true,
  },
}));

// Mock fs
const mockFiles: Map<string, string> = new Map();
vi.mock('fs', () => ({
  existsSync: vi.fn((path: string) => mockFiles.has(path)),
  readFileSync: vi.fn((path: string) => {
    const content = mockFiles.get(path);
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    return content;
  }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn(),
}));

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  execFileSync: vi.fn(),
}));

// Mock other dependencies
vi.mock('../../shared/constants', () => ({
  IPC_CHANNELS: {
    SETTINGS_CLAUDE_CODE_GET_ONBOARDING_STATUS: 'settings:claudeCode:getOnboardingStatus',
    SETTINGS_GET: 'settings:get',
    SETTINGS_SAVE: 'settings:save',
    SETTINGS_GET_CLI_TOOLS_INFO: 'settings:getCliToolsInfo',
    DIALOG_SELECT_DIRECTORY: 'dialog:selectDirectory',
    DIALOG_CREATE_PROJECT_FOLDER: 'dialog:createProjectFolder',
    DIALOG_GET_DEFAULT_PROJECT_LOCATION: 'dialog:getDefaultProjectLocation',
    APP_VERSION: 'app:version',
    SHELL_OPEN_EXTERNAL: 'shell:openExternal',
    SHELL_OPEN_TERMINAL: 'shell:openTerminal',
    AUTOBUILD_SOURCE_ENV_GET: 'autobuild:source:env:get',
    AUTOBUILD_SOURCE_ENV_UPDATE: 'autobuild:source:env:update',
    AUTOBUILD_SOURCE_ENV_CHECK_TOKEN: 'autobuild:source:env:checkToken',
    SENTRY_STATE_CHANGED: 'sentry:state-changed',
    GET_SENTRY_DSN: 'sentry:get-dsn',
    GET_SENTRY_CONFIG: 'sentry:get-config',
  },
  DEFAULT_APP_SETTINGS: {},
  DEFAULT_AGENT_PROFILES: [],
}));

vi.mock('../cli-tool-manager', () => ({
  configureTools: vi.fn(),
  getToolInfo: vi.fn(),
  isPathFromWrongPlatform: vi.fn(() => false),
  preWarmToolCache: vi.fn(),
}));

vi.mock('../settings-utils', () => ({
  readSettingsFile: vi.fn(() => ({})),
  writeSettingsFile: vi.fn(),
  getSettingsPath: vi.fn(() => join(mockHomeDir, 'settings.json')),
}));

vi.mock('../agent', () => ({
  AgentManager: vi.fn(),
}));

vi.mock('./utils', () => ({
  parseEnvFile: vi.fn(() => ({})),
}));

vi.mock('../app-updater', () => ({
  setUpdateChannel: vi.fn(),
  setUpdateChannelWithDowngradeCheck: vi.fn(() => Promise.resolve()),
}));

import { IPC_CHANNELS } from '../../shared/constants';

describe('SETTINGS_CLAUDE_CODE_GET_ONBOARDING_STATUS handler', () => {
  let onboardingStatusHandler: IpcHandler;
  const claudeJsonPath = join(mockHomeDir, '.claude.json');

  beforeEach(async () => {
    vi.clearAllMocks();
    registeredHandlers.clear();
    mockFiles.clear();

    // Clean up any existing test file
    if (existsSync(claudeJsonPath)) {
      unlinkSync(claudeJsonPath);
    }

    // Reset module cache to get fresh state
    vi.resetModules();

    // Re-import to re-register handlers
    const { registerSettingsHandlers } = await import('../ipc-handlers/settings-handlers');
    // Mock agentManager and getMainWindow
    const mockAgentManager = {};
    const mockGetMainWindow = vi.fn(() => null);
    registerSettingsHandlers(mockAgentManager as never, mockGetMainWindow);

    // Get the handler
    const handler = registeredHandlers.get(IPC_CHANNELS.SETTINGS_CLAUDE_CODE_GET_ONBOARDING_STATUS);
    if (!handler) {
      throw new Error('SETTINGS_CLAUDE_CODE_GET_ONBOARDING_STATUS handler not registered');
    }
    onboardingStatusHandler = handler;
  });

  afterEach(() => {
    // Clean up test file
    if (existsSync(claudeJsonPath)) {
      try {
        unlinkSync(claudeJsonPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    mockFiles.clear();
  });

  describe('when ~/.claude.json does not exist', () => {
    test('should return hasCompletedOnboarding: false', async () => {
      const result = await onboardingStatusHandler({}, null) as {
        success: boolean;
        data?: { hasCompletedOnboarding: boolean };
        error?: string;
      };

      expect(result.success).toBe(true);
      expect(result.data?.hasCompletedOnboarding).toBe(false);
    });
  });

  describe('when ~/.claude.json exists', () => {
    describe('with hasCompletedOnboarding: true', () => {
      beforeEach(() => {
        const content = JSON.stringify({ hasCompletedOnboarding: true });
        mockFiles.set(claudeJsonPath, content);
      });

      test('should return hasCompletedOnboarding: true', async () => {
        const result = await onboardingStatusHandler({}, null) as {
          success: boolean;
          data?: { hasCompletedOnboarding: boolean };
        };

        expect(result.success).toBe(true);
        expect(result.data?.hasCompletedOnboarding).toBe(true);
      });
    });

    describe('with hasCompletedOnboarding: false', () => {
      beforeEach(() => {
        const content = JSON.stringify({ hasCompletedOnboarding: false });
        mockFiles.set(claudeJsonPath, content);
      });

      test('should return hasCompletedOnboarding: false', async () => {
        const result = await onboardingStatusHandler({}, null) as {
          success: boolean;
          data?: { hasCompletedOnboarding: boolean };
        };

        expect(result.success).toBe(true);
        expect(result.data?.hasCompletedOnboarding).toBe(false);
      });
    });

    describe('without hasCompletedOnboarding field', () => {
      beforeEach(() => {
        const content = JSON.stringify({ someOtherField: 'value' });
        mockFiles.set(claudeJsonPath, content);
      });

      test('should return hasCompletedOnboarding: false', async () => {
        const result = await onboardingStatusHandler({}, null) as {
          success: boolean;
          data?: { hasCompletedOnboarding: boolean };
        };

        expect(result.success).toBe(true);
        expect(result.data?.hasCompletedOnboarding).toBe(false);
      });
    });

    describe('with malformed JSON', () => {
      beforeEach(() => {
        mockFiles.set(claudeJsonPath, '{ invalid json }');
      });

      test('should return hasCompletedOnboarding: false (error handling)', async () => {
        const result = await onboardingStatusHandler({}, null) as {
          success: boolean;
          data?: { hasCompletedOnboarding: boolean };
        };

        expect(result.success).toBe(true);
        expect(result.data?.hasCompletedOnboarding).toBe(false);
      });
    });

    describe('with other Claude Code fields present', () => {
      beforeEach(() => {
        const content = JSON.stringify({
          hasCompletedOnboarding: true,
          oauthAccount: {
            emailAddress: 'user@example.com',
            accessToken: 'dummy-token',
          },
          lastChecked: '2024-01-15T10:30:00Z',
        });
        mockFiles.set(claudeJsonPath, content);
      });

      test('should return hasCompletedOnboarding: true', async () => {
        const result = await onboardingStatusHandler({}, null) as {
          success: boolean;
          data?: { hasCompletedOnboarding: boolean };
        };

        expect(result.success).toBe(true);
        expect(result.data?.hasCompletedOnboarding).toBe(true);
      });
    });
  });

  describe('error handling', () => {
    test('should handle read errors gracefully', async () => {
      // Simulate read error by not setting up the mock file
      // The existsSync mock will return false since it's not in mockFiles
      const result = await onboardingStatusHandler({}, null) as {
        success: boolean;
        data?: { hasCompletedOnboarding: boolean };
      };

      expect(result.success).toBe(true);
      expect(result.data?.hasCompletedOnboarding).toBe(false);
    });
  });
});
