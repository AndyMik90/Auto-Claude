import { EventEmitter } from 'events';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

interface MockStdin {
  write: ReturnType<typeof vi.fn>;
  destroyed: boolean;
}

interface MockProc extends EventEmitter {
  stdout?: EventEmitter;
  stderr?: EventEmitter;
  stdin?: MockStdin;
}

function createProc(includeStdin = false): MockProc {
  const proc = new EventEmitter() as MockProc;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  if (includeStdin) {
    proc.stdin = {
      write: vi.fn(),
      destroyed: false
    };
  }
  return proc;
}

describe('env-handlers Claude CLI usage', () => {
  beforeEach(() => {
    mockGetClaudeCliInvocation.mockReset();
    mockGetProject.mockReset();
    spawnMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses resolved Claude CLI path/env for auth checks', async () => {
    const claudeEnv = { PATH: '/opt/claude/bin:/usr/bin' };
    const command = '/opt/claude/bin/claude';
    mockGetClaudeCliInvocation.mockReturnValue({
      command,
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
      command,
      ['--version'],
      expect.objectContaining({ cwd: '/tmp/project', env: claudeEnv, shell: false })
    );

    procs[0].emit('close', 0);
    await Promise.resolve();

    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(spawnMock).toHaveBeenCalledWith(
      command,
      ['api', '--help'],
      expect.objectContaining({ cwd: '/tmp/project', env: claudeEnv, shell: false })
    );

    procs[1].emit('close', 0);

    const result = await resultPromise;
    expect(result).toEqual({ success: true, data: { success: true, authenticated: true } });
  });

  it('uses resolved Claude CLI path/env for /login authentication', async () => {
    const claudeEnv = { PATH: '/opt/claude/bin:/usr/bin' };
    const command = '/opt/claude/bin/claude';
    mockGetClaudeCliInvocation.mockReturnValue({
      command,
      env: claudeEnv,
    });
    mockGetProject.mockReturnValue({ id: 'p2', path: '/tmp/project' });

    const proc = createProc(true); // Include stdin mock
    spawnMock.mockReturnValue(proc);

    registerEnvHandlers(() => null);
    const handler = mockIpcMain.getHandler(IPC_CHANNELS.ENV_INVOKE_CLAUDE_SETUP);
    if (!handler) {
      throw new Error('ENV_INVOKE_CLAUDE_SETUP handler not registered');
    }

    const resultPromise = handler({}, 'p2');

    // Verify spawn is called with interactive Claude session (no args)
    // and stdin pipe for sending /login command
    expect(spawnMock).toHaveBeenCalledWith(
      command,
      [],  // No arguments - spawns interactive Claude session
      expect.objectContaining({
        cwd: '/tmp/project',
        env: claudeEnv,
        shell: false,
        stdio: ['pipe', 'inherit', 'inherit']  // stdin piped to send /login
      })
    );

    // Advance timers to trigger the setTimeout that sends /login
    await vi.advanceTimersByTimeAsync(2000);

    // Verify /login command was sent to stdin
    expect(proc.stdin?.write).toHaveBeenCalledWith('/login\n');

    // Simulate successful close
    proc.emit('close', 0);
    const result = await resultPromise;
    expect(result).toEqual({ success: true, data: { success: true, authenticated: true } });
  });

  it('returns an error when Claude CLI resolution throws', async () => {
    mockGetClaudeCliInvocation.mockImplementation(() => {
      throw new Error('Claude CLI exploded');
    });
    mockGetProject.mockReturnValue({ id: 'p3', path: '/tmp/project' });

    registerEnvHandlers(() => null);
    const handler = mockIpcMain.getHandler(IPC_CHANNELS.ENV_CHECK_CLAUDE_AUTH);
    if (!handler) {
      throw new Error('ENV_CHECK_CLAUDE_AUTH handler not registered');
    }

    const result = await handler({}, 'p3');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Claude CLI exploded');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('returns an error when Claude CLI command is missing', async () => {
    mockGetClaudeCliInvocation.mockReturnValue({ command: '', env: {} });
    mockGetProject.mockReturnValue({ id: 'p4', path: '/tmp/project' });

    registerEnvHandlers(() => null);
    const handler = mockIpcMain.getHandler(IPC_CHANNELS.ENV_CHECK_CLAUDE_AUTH);
    if (!handler) {
      throw new Error('ENV_CHECK_CLAUDE_AUTH handler not registered');
    }

    const result = await handler({}, 'p4');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Claude CLI path not resolved');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('returns an error when Claude CLI exits with a non-zero code', async () => {
    const claudeEnv = { PATH: '/opt/claude/bin:/usr/bin' };
    const command = '/opt/claude/bin/claude';
    mockGetClaudeCliInvocation.mockReturnValue({
      command,
      env: claudeEnv,
    });
    mockGetProject.mockReturnValue({ id: 'p5', path: '/tmp/project' });

    const proc = createProc();
    spawnMock.mockReturnValue(proc);

    registerEnvHandlers(() => null);
    const handler = mockIpcMain.getHandler(IPC_CHANNELS.ENV_CHECK_CLAUDE_AUTH);
    if (!handler) {
      throw new Error('ENV_CHECK_CLAUDE_AUTH handler not registered');
    }

    const resultPromise = handler({}, 'p5');
    expect(spawnMock).toHaveBeenCalledWith(
      command,
      ['--version'],
      expect.objectContaining({ cwd: '/tmp/project', env: claudeEnv, shell: false })
    );
    proc.emit('close', 1);

    const result = await resultPromise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('Claude CLI not found');
  });
});
