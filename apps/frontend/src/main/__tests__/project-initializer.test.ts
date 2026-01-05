import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { initializeProject } from '../project-initializer';

describe('project-initializer', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('initializes without git when requireGit is false', () => {
    const projectPath = mkdtempSync(path.join(tmpdir(), 'auto-claude-init-'));
    tempDirs.push(projectPath);

    const result = initializeProject(projectPath, { requireGit: false });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(existsSync(path.join(projectPath, '.auto-claude'))).toBe(true);
    expect(existsSync(path.join(projectPath, '.auto-claude', 'specs'))).toBe(true);
  });
});
