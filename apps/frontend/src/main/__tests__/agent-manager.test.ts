import { describe, it, expect, vi, beforeEach } from 'vitest';

const profileManager = vi.hoisted(() => ({
  hasValidAuth: vi.fn(),
  getActiveProfile: vi.fn(() => ({ id: 'default' })),
  setActiveProfile: vi.fn()
}));

const codexCli = vi.hoisted(() => ({
  checkCodexCliReady: vi.fn()
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp')
  }
}));

vi.mock('../agent-process', () => ({
  AgentProcessManager: class {
    configure(): void {}
    getAutoBuildSourcePath(): string | null {
      return null;
    }
    getCombinedEnv(): Record<string, string> {
      return {};
    }
    spawnProcess(): void {}
    killProcess(): boolean {
      return true;
    }
    async killAllProcesses(): Promise<void> {}
  }
}));

vi.mock('../agent-queue', () => ({
  AgentQueueManager: class {
    constructor() {}
    startRoadmapGeneration(): void {}
    startIdeationGeneration(): void {}
    stopIdeation(): boolean {
      return true;
    }
    isIdeationRunning(): boolean {
      return false;
    }
    stopRoadmap(): boolean {
      return true;
    }
    isRoadmapRunning(): boolean {
      return false;
    }
  }
}));

vi.mock('../auto-build-provider', () => ({
  loadAutoBuildProvider: vi.fn(() => 'hybrid')
}));

vi.mock('../claude-profile-manager', () => ({
  getClaudeProfileManager: () => profileManager
}));

vi.mock('../codex-cli-utils', () => ({
  checkCodexCliReady: codexCli.checkCodexCliReady
}));

describe('AgentManager provider readiness', () => {
  beforeEach(() => {
    vi.resetModules();
    profileManager.hasValidAuth.mockReset();
    profileManager.setActiveProfile.mockReset();
    codexCli.checkCodexCliReady.mockReset();
  });

  it('blocks hybrid when Claude auth is missing', async () => {
    profileManager.hasValidAuth.mockReturnValue(false);
    codexCli.checkCodexCliReady.mockReturnValue({ ok: true });

    const { AgentManager } = await import('../agent/agent-manager');
    const manager = new AgentManager();
    const errors: string[] = [];

    manager.on('error', (_taskId, message: string) => {
      errors.push(message);
    });

    manager.startTaskExecution('task-1', '/project', 'spec-1');

    expect(errors[0]).toMatch(/Claude authentication required/i);
  });

  it('switches Claude profiles on restart in hybrid', async () => {
    profileManager.hasValidAuth.mockReturnValue(true);
    codexCli.checkCodexCliReady.mockReturnValue({ ok: true });

    const { AgentManager } = await import('../agent/agent-manager');
    const manager = new AgentManager();
    const managerAny = manager as unknown as { taskExecutionContext: Map<string, any> };
    managerAny.taskExecutionContext.set('task-1', {
      projectPath: '/project',
      specId: 'spec-1',
      options: {},
      isSpecCreation: false,
      swapCount: 0
    });

    const startSpy = vi
      .spyOn(manager as any, 'startTaskExecution')
      .mockImplementation(() => {});
    vi.spyOn(manager, 'killTask').mockImplementation(() => true);

    vi.useFakeTimers();
    manager.restartTask('task-1', 'new-profile');
    vi.runAllTimers();
    vi.useRealTimers();

    expect(profileManager.setActiveProfile).toHaveBeenCalledWith('new-profile');
    expect(startSpy).toHaveBeenCalled();
  });
});
