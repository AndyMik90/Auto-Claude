import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TerminalProcess } from '../types';

const mockGetClaudeCliInvocation = vi.fn();
const mockGetClaudeProfileManager = vi.fn();
const mockPersistSession = vi.fn();
const mockReleaseSessionId = vi.fn();

vi.mock('../../claude-cli-utils', () => ({
  getClaudeCliInvocation: mockGetClaudeCliInvocation,
}));

vi.mock('../../claude-profile-manager', () => ({
  getClaudeProfileManager: mockGetClaudeProfileManager,
}));

vi.mock('../session-handler', () => ({
  persistSession: mockPersistSession,
  releaseSessionId: mockReleaseSessionId,
}));

describe('claude-integration-handler', () => {
  beforeEach(() => {
    mockGetClaudeCliInvocation.mockReset();
    mockGetClaudeProfileManager.mockReset();
    mockPersistSession.mockReset();
    mockReleaseSessionId.mockReset();
  });

  it('uses the resolved CLI path and PATH prefix when invoking Claude', async () => {
    mockGetClaudeCliInvocation.mockReturnValue({
      command: "/opt/claude bin/claude's",
      env: { PATH: '/opt/claude/bin:/usr/bin' },
    });
    const profileManager = {
      getActiveProfile: vi.fn(() => ({ id: 'default', name: 'Default', isDefault: true })),
      getProfile: vi.fn(),
      getProfileToken: vi.fn(() => null),
      markProfileUsed: vi.fn(),
    };
    mockGetClaudeProfileManager.mockReturnValue(profileManager);

    const terminal = {
      id: 'term-1',
      pty: { write: vi.fn() },
      outputBuffer: '',
      isClaudeMode: false,
      claudeSessionId: undefined,
      claudeProfileId: undefined,
      cwd: '/tmp/project',
      projectPath: '/tmp/project',
    } as unknown as TerminalProcess;

    const { invokeClaude } = await import('../claude-integration-handler');
    invokeClaude(terminal, '/tmp/project', undefined, () => null, vi.fn());

    const written = vi.mocked(terminal.pty.write).mock.calls[0][0] as string;
    expect(written).toContain("cd '/tmp/project' && ");
    expect(written).toContain("PATH='/opt/claude/bin:/usr/bin' ");
    expect(written).toContain("'/opt/claude bin/claude'\\''s'");
    expect(mockReleaseSessionId).toHaveBeenCalledWith('term-1');
    expect(mockPersistSession).toHaveBeenCalledWith(terminal);
    expect(profileManager.getActiveProfile).toHaveBeenCalled();
    expect(profileManager.markProfileUsed).toHaveBeenCalledWith('default');
  });

  it('uses the resolved CLI path for resume and continue', async () => {
    mockGetClaudeCliInvocation.mockReturnValue({
      command: '/opt/claude/bin/claude',
      env: { PATH: '/opt/claude/bin:/usr/bin' },
    });

    const terminal = {
      id: 'term-2',
      pty: { write: vi.fn() },
      outputBuffer: '',
      isClaudeMode: false,
      claudeSessionId: undefined,
      claudeProfileId: undefined,
      projectPath: '/tmp/project',
    } as unknown as TerminalProcess;

    const { resumeClaude } = await import('../claude-integration-handler');
    resumeClaude(terminal, 'abc123', () => null);

    const resumeCall = vi.mocked(terminal.pty.write).mock.calls[0][0] as string;
    expect(resumeCall).toContain("PATH='/opt/claude/bin:/usr/bin' ");
    expect(resumeCall).toContain("'/opt/claude/bin/claude' --resume 'abc123'");
    expect(terminal.claudeSessionId).toBe('abc123');
    expect(terminal.isClaudeMode).toBe(true);
    expect(mockPersistSession).toHaveBeenCalledWith(terminal);

    vi.mocked(terminal.pty.write).mockClear();
    mockPersistSession.mockClear();
    terminal.projectPath = undefined;
    terminal.claudeSessionId = undefined;
    terminal.isClaudeMode = false;
    resumeClaude(terminal, undefined, () => null);
    const continueCall = vi.mocked(terminal.pty.write).mock.calls[0][0] as string;
    expect(continueCall).toContain("'/opt/claude/bin/claude' --continue");
    expect(terminal.isClaudeMode).toBe(true);
    expect(terminal.claudeSessionId).toBeUndefined();
    expect(mockPersistSession).not.toHaveBeenCalled();
  });
});
