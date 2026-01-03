import { FolderOpen, Info } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import type { ProjectEnvConfig } from '../../../shared/types';
import { DEFAULT_WORKTREE_PATH } from '../../../shared/constants';

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

/**
 * Render the worktree settings UI that lets the user view and edit the project's worktree base path.
 *
 * The component displays an input for the worktree base path, a browse button that opens a directory picker,
 * and a resolved-path readout. When a directory is chosen via browse, it updates the env config with a path
 * relative to the project root if the selection is inside the project, otherwise with the absolute path.
 * The resolved path is computed as:
 * - the absolute `worktreePath` when it is an absolute path;
 * - `joinPath(projectPath, worktreePath)` when `worktreePath` is relative;
 * - `joinPath(projectPath, DEFAULT_WORKTREE_PATH)` when `worktreePath` is empty.
 *
 * @param envConfig - The current environment configuration for the project, or `null` when unset
 * @param updateEnvConfig - Callback to apply a partial update to the project's environment configuration
 * @param projectPath - Absolute filesystem path to the project root
 * @returns A React element rendering controls and information for configuring the project's worktree path
 */
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
    : joinPath(projectPath, DEFAULT_WORKTREE_PATH);

  const handleBrowse = async () => {
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: projectPath,
      title: t('settings:worktree.selectLocation')
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
          <p>{t('settings:worktree.description')}</p>
          <p className="font-medium">
            <Trans i18nKey="settings:worktree.defaultInfo">
              Default: <code>.worktrees/</code> in your project root
            </Trans>
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="worktreePath">{t('settings:worktree.basePathLabel')}</Label>
        <div className="flex gap-2">
          <Input
            id="worktreePath"
            placeholder={t('settings:worktree.basePathPlaceholder')}
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
          <Trans i18nKey="settings:worktree.pathTypeDescription">
            Supports relative paths (e.g., <code>worktrees</code>) or absolute paths (e.g., <code>/tmp/worktrees</code>)
          </Trans>
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-xs font-medium text-foreground">{t('settings:worktree.resolvedPath')}</p>
        <code className="text-xs text-muted-foreground break-all">{resolvedPath}</code>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium">{t('settings:worktree.commonUseCases')}</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>
            <Trans i18nKey="settings:worktree.externalDrive">
              External drive: <code>/Volumes/FastSSD/worktrees</code>
            </Trans>
          </li>
          <li>
            <Trans i18nKey="settings:worktree.tempDirectory">
              Temp directory: <code>/tmp/my-project-worktrees</code>
            </Trans>
          </li>
          <li>
            <Trans i18nKey="settings:worktree.sharedBuilds">
              Shared builds: <code>../shared-worktrees</code>
            </Trans>
          </li>
        </ul>
      </div>
    </section>
  );
}