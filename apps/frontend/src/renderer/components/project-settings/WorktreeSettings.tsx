import { useState } from 'react';
import { FolderOpen, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import type { ProjectEnvConfig } from '../../../shared/types';

const path = window.require('path');

interface WorktreeSettingsProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  projectPath: string;
}

export function WorktreeSettings({
  envConfig,
  updateEnvConfig,
  projectPath
}: WorktreeSettingsProps) {
  const { t } = useTranslation(['settings']);
  const worktreePath = envConfig?.worktreePath || '';

  // Resolve the actual path that will be used
  const resolvedPath = worktreePath
    ? (path.isAbsolute(worktreePath)
        ? worktreePath
        : path.join(projectPath, worktreePath))
    : path.join(projectPath, '.worktrees');

  const handleBrowse = async () => {
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: projectPath,
      title: 'Select Worktree Location'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      // Convert to relative path if inside project
      const relativePath = path.relative(projectPath, selectedPath);
      const finalPath = relativePath.startsWith('..')
        ? selectedPath // Absolute if outside project
        : relativePath; // Relative if inside project

      updateEnvConfig({ worktreePath: finalPath });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Worktrees are isolated Git branches where Auto Claude builds features safely.</p>
          <p className="font-medium">Default: <code>.worktrees/</code> in your project root</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="worktreePath">Worktree Base Path</Label>
        <div className="flex gap-2">
          <Input
            id="worktreePath"
            placeholder=".worktrees (default)"
            value={worktreePath}
            onChange={(e) => updateEnvConfig({ worktreePath: e.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleBrowse}
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Supports relative paths (e.g., <code>worktrees</code>) or absolute paths (e.g., <code>/tmp/worktrees</code>)
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-xs font-medium text-foreground">Resolved Path:</p>
        <code className="text-xs text-muted-foreground break-all">{resolvedPath}</code>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium">Common Use Cases:</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>External drive: <code>/Volumes/FastSSD/worktrees</code></li>
          <li>Temp directory: <code>/tmp/my-project-worktrees</code></li>
          <li>Shared builds: <code>../shared-worktrees</code></li>
        </ul>
      </div>
    </section>
  );
}
