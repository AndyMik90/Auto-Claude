import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TerminalProcess } from '../types';

const mockGetClaudeCliInvocation = vi.fn();
const mockGetClaudeProfileManager = vi.fn();
const mockPersistSession = vi.fn();

vi.mock('../../claude-cli-utils', () => ({
  getClaudeCliInvocation: mockGetClaudeCliInvocation,
}));

vi.mock('../../claude-profile-manager', () => ({
  getClaudeProfileManager: mockGetClaudeProfileManager,
}));

vi.mock('../session-handler', () => ({
  persistSession: mockPersistSession,
}));

describe('claude-integration-handler', () => {
  beforeEach(() => {
    mockGetClaudeCliInvocation.mockReset();
    mockGetClaudeProfileManager.mockReset();
    mockPersistSession.mockReset();
  });

  it('uses the resolved CLI path and PATH prefix when invoking Claude', async () => {
    mockGetClaudeCliInvocation.mockReturnValue({
      command: "/opt/claude bin/claude's",
      env: { PATH: '/opt/claude/bin:/usr/bin' },
    });
    mockGetClaudeProfileManager.mockReturnValue({
      getActiveProfile: () => ({ id: 'default', name: 'Default', isDefault: true }),
      getProfile: vi.fn(),
      getProfileToken: () => null,
      markProfileUsed: vi.fn(),
    });

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
    } as unknown as TerminalProcess;

    const { resumeClaude } = await import('../claude-integration-handler');
    resumeClaude(terminal, 'abc123', () => null);

    const resumeCall = vi.mocked(terminal.pty.write).mock.calls[0][0] as string;
    expect(resumeCall).toContain("PATH='/opt/claude/bin:/usr/bin' ");
    expect(resumeCall).toContain("'/opt/claude/bin/claude' --resume 'abc123'");

    vi.mocked(terminal.pty.write).mockClear();
    resumeClaude(terminal, undefined, () => null);
    const continueCall = vi.mocked(terminal.pty.write).mock.calls[0][0] as string;
    expect(continueCall).toContain("'/opt/claude/bin/claude' --continue");
  });
});
