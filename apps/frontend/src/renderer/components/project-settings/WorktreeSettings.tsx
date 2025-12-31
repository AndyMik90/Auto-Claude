import { FolderOpen, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import type { ProjectEnvConfig } from '../../../shared/types';

// Browser-compatible path utilities
const isAbsolutePath = (p: string): boolean => {
  // Unix absolute path starts with /
  // Windows absolute path starts with drive letter (C:\) or UNC path (\\)
  return p.startsWith('/') || /^[a-zA-Z]:[/\\]/.test(p) || p.startsWith('\\\\');
};

const joinPath = (...parts: string[]): string => {
  // Simple path join that works in browser
  return parts.join('/').replace(/\/+/g, '/');
};

const getRelativePath = (from: string, to: string): string => {
  // Normalize paths
  const fromParts = from.split(/[/\\]/).filter(Boolean);
  const toParts = to.split(/[/\\]/).filter(Boolean);

  // Find common base
  let commonLength = 0;
  const minLength = Math.min(fromParts.length, toParts.length);
  for (let i = 0; i < minLength; i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength = i + 1;
    } else {
      break;
    }
  }

  // If no common base, paths are on different roots
  if (commonLength === 0) {
    return to; // Return absolute path
  }

  // Build relative path
  const upCount = fromParts.length - commonLength;
  const downParts = toParts.slice(commonLength);

  if (upCount === 0 && downParts.length === 0) {
    return '.';
  }

  const ups = Array(upCount).fill('..');
  return [...ups, ...downParts].join('/');
};

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
    ? (isAbsolutePath(worktreePath)
        ? worktreePath
        : joinPath(projectPath, worktreePath))
    : joinPath(projectPath, '.worktrees');

  const handleBrowse = async () => {
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: projectPath,
      title: 'Select Worktree Location'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      // Convert to relative path if inside project
      const relativePath = getRelativePath(projectPath, selectedPath);
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
