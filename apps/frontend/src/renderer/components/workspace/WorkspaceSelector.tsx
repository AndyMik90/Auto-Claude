import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FolderGit2, GitBranch, Plus, Check, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { useWorkspaceStore, getDefaultRepo } from '../../stores/workspace-store';
import type { Workspace, WorkspaceRepo } from '../../../shared/types/workspace';

interface WorkspaceSelectorProps {
  /** Current project path (for workspace detection) */
  projectPath: string;
  /** Callback when a repo is selected */
  onRepoSelect?: (repo: WorkspaceRepo) => void;
  /** Callback to open workspace settings */
  onOpenSettings?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Dropdown selector for choosing between repositories in a workspace.
 * Shows a simple project indicator for standalone projects.
 */
export function WorkspaceSelector({
  projectPath,
  onRepoSelect,
  onOpenSettings,
  className
}: WorkspaceSelectorProps) {
  const { t } = useTranslation('workspace');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    activeRepoId,
    setActiveRepo,
    detectProjectType
  } = useWorkspaceStore();

  // Load workspace info when project changes
  useEffect(() => {
    const loadWorkspace = async () => {
      setIsLoading(true);
      try {
        // Detect project type
        const detection = await detectProjectType(projectPath);

        if (detection?.type === 'workspace') {
          // Load workspace
          const result = await window.electronAPI.getWorkspace(projectPath);
          if (result.success && result.data) {
            setWorkspace(result.data);
            // Set default repo if none selected
            if (!activeRepoId) {
              const defaultRepo = getDefaultRepo(result.data.id);
              if (defaultRepo) {
                setActiveRepo(defaultRepo.id);
              }
            }
          } else {
            setWorkspace(null);
          }
        } else {
          setWorkspace(null);
        }
      } catch {
        setWorkspace(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkspace();
  }, [projectPath, detectProjectType, activeRepoId, setActiveRepo]);

  // Get currently selected repo
  const selectedRepo = workspace?.repos.find(r => r.id === activeRepoId) ||
    workspace?.repos.find(r => r.isDefault) ||
    workspace?.repos[0];

  const handleRepoSelect = (repo: WorkspaceRepo) => {
    setActiveRepo(repo.id);
    onRepoSelect?.(repo);
  };

  // Don't show selector for standalone projects
  if (!workspace) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
        <FolderGit2 className="h-4 w-4 animate-pulse" />
        <span className="text-sm">{t('loading', 'Loading...')}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("flex items-center gap-2", className)}
        >
          <FolderGit2 className="h-4 w-4" />
          <span className="max-w-[150px] truncate">
            {selectedRepo?.name || workspace.name}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel className="flex items-center gap-2">
          <FolderGit2 className="h-4 w-4" />
          {workspace.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {workspace.repos.map((repo) => (
          <DropdownMenuItem
            key={repo.id}
            onClick={() => handleRepoSelect(repo)}
            className="flex items-center gap-2"
          >
            <GitBranch className="h-4 w-4" />
            <span className="flex-1 truncate">{repo.name}</span>
            {repo.isDefault && (
              <span className="text-xs text-muted-foreground">
                {t('default', 'default')}
              </span>
            )}
            {repo.id === selectedRepo?.id && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}

        {workspace.repos.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t('noRepos', 'No repositories added')}
          </div>
        )}

        <DropdownMenuSeparator />

        {onOpenSettings && (
          <DropdownMenuItem onClick={onOpenSettings}>
            <Settings className="h-4 w-4 mr-2" />
            {t('workspaceSettings', 'Workspace Settings')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
