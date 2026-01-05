import { EventEmitter } from 'events';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '../../shared/constants';
const {
  mockGetClaudeCliInvocation,
  mockGetProject,
  spawnMock,
  mockIpcMain,
} = vi.hoisted(() => {
  const ipcMain = new (class {
    handlers = new Map<string, Function>();

    handle(channel: string, handler: Function): void {
      this.handlers.set(channel, handler);
    }

    getHandler(channel: string): Function | undefined {
      return this.handlers.get(channel);
    }
  })();

  return {
    mockGetClaudeCliInvocation: vi.fn(),
    mockGetProject: vi.fn(),
    spawnMock: vi.fn(),
    mockIpcMain: ipcMain,
  };
});

vi.mock('../claude-cli-utils', () => ({
  getClaudeCliInvocation: mockGetClaudeCliInvocation,
}));

vi.mock('../project-store', () => ({
  projectStore: {
    getProject: mockGetProject,
  },
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return path.join('/tmp', 'userData');
      return '/tmp';
    }),
  },
  ipcMain: mockIpcMain,
}));

import { registerEnvHandlers } from '../ipc-handlers/env-handlers';

function createProc(): EventEmitter & { stdout?: EventEmitter; stderr?: EventEmitter } {
  const proc = new EventEmitter() as EventEmitter & {
    stdout?: EventEmitter;
    stderr?: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

describe('env-handlers Claude CLI usage', () => {
  beforeEach(() => {
    mockGetClaudeCliInvocation.mockReset();
    mockGetProject.mockReset();
    spawnMock.mockReset();
  });

  it('uses resolved Claude CLI path/env for auth checks', async () => {
    const claudeEnv = { PATH: '/opt/claude/bin:/usr/bin' };
    mockGetClaudeCliInvocation.mockReturnValue({
      command: '/opt/claude/bin/claude',
      env: claudeEnv,
    });
    mockGetProject.mockReturnValue({ id: 'p1', path: '/tmp/project' });

    const procs: ReturnType<typeof createProc>[] = [];
    spawnMock.mockImplementation(() => {
      const proc = createProc();
      procs.push(proc);
      return proc;
    });

    registerEnvHandlers(() => null);
    const handler = mockIpcMain.getHandler(IPC_CHANNELS.ENV_CHECK_CLAUDE_AUTH);
    if (!handler) {
      throw new Error('ENV_CHECK_CLAUDE_AUTH handler not registered');
    }

    const resultPromise = handler({}, 'p1');
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(
      '/opt/claude/bin/claude',
      ['--version'],
      expect.objectContaining({ env: claudeEnv })
    );

    procs[0].emit('close', 0);
    await Promise.resolve();

    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(spawnMock).toHaveBeenCalledWith(
      '/opt/claude/bin/claude',
      ['api', '--help'],
      expect.objectContaining({ env: claudeEnv })
    );

    procs[1].emit('close', 0);

    const result = await resultPromise;
    expect(result).toEqual({ success: true, data: { success: true, authenticated: true } });
  });

  it('uses resolved Claude CLI path/env for setup-token', async () => {
    const claudeEnv = { PATH: '/opt/claude/bin:/usr/bin' };
    mockGetClaudeCliInvocation.mockReturnValue({
      command: '/opt/claude/bin/claude',
      env: claudeEnv,
    });
    mockGetProject.mockReturnValue({ id: 'p2', path: '/tmp/project' });

    const proc = createProc();
    spawnMock.mockReturnValue(proc);

    registerEnvHandlers(() => null);
    const handler = mockIpcMain.getHandler(IPC_CHANNELS.ENV_INVOKE_CLAUDE_SETUP);
    if (!handler) {
      throw new Error('ENV_INVOKE_CLAUDE_SETUP handler not registered');
    }

    const resultPromise = handler({}, 'p2');
    expect(spawnMock).toHaveBeenCalledWith(
      '/opt/claude/bin/claude',
      ['setup-token'],
      expect.objectContaining({ env: claudeEnv })
    );

    proc.emit('close', 0);
    const result = await resultPromise;
    expect(result).toEqual({ success: true, data: { success: true, authenticated: true } });
  });
});
