import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FolderGit2, GitBranch, Plus, Check, Settings, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog';
import { cn } from '../../lib/utils';
import { useWorkspaceStore, getDefaultRepo } from '../../stores/workspace-store';
import { MigrationWizard } from './MigrationWizard';
import type { Workspace, WorkspaceRepo, ProjectTypeDetectionResult } from '../../../shared/types/workspace';

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
  const [detection, setDetection] = useState<ProjectTypeDetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingRepo, setIsAddingRepo] = useState(false);
  const [addRepoError, setAddRepoError] = useState<string | null>(null);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<WorkspaceRepo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    activeRepoId,
    setActiveRepo,
    detectProjectType,
    addRepoToWorkspace,
    removeRepoFromWorkspace
  } = useWorkspaceStore();

  // Load workspace info when project changes
  useEffect(() => {
    const loadWorkspace = async () => {
      setIsLoading(true);
      try {
        // Detect project type
        const detectionResult = await detectProjectType(projectPath);
        setDetection(detectionResult);

        if (detectionResult?.type === 'workspace') {
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
        setDetection(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkspace();
  }, [projectPath, detectProjectType, activeRepoId, setActiveRepo]);

  const handleMigrationComplete = async () => {
    // Reload workspace after migration
    const detectionResult = await detectProjectType(projectPath);
    setDetection(detectionResult);
    if (detectionResult?.type === 'workspace') {
      const result = await window.electronAPI.getWorkspace(projectPath);
      if (result.success && result.data) {
        setWorkspace(result.data);
      }
    }
  };

  // Get currently selected repo
  const selectedRepo = workspace?.repos.find(r => r.id === activeRepoId) ||
    workspace?.repos.find(r => r.isDefault) ||
    workspace?.repos[0];

  const handleRepoSelect = (repo: WorkspaceRepo) => {
    setActiveRepo(repo.id);
    onRepoSelect?.(repo);
  };

  const handleAddRepo = async () => {
    if (!workspace) return;

    setAddRepoError(null);
    try {
      // Open directory picker
      const selectedPath = await window.electronAPI.selectDirectory();
      if (!selectedPath) return; // User cancelled

      setIsAddingRepo(true);

      // Add repo to workspace
      const success = await addRepoToWorkspace({
        workspaceId: projectPath, // workspace:add-repo uses path as workspaceId
        repoPath: selectedPath
      });

      if (success) {
        // Reload workspace to get updated repos
        const result = await window.electronAPI.getWorkspace(projectPath);
        if (result.success && result.data) {
          setWorkspace(result.data);
        }
      } else {
        const storeError = useWorkspaceStore.getState().error;
        setAddRepoError(storeError || t('addRepoError', 'Failed to add repository'));
      }
    } catch (error) {
      setAddRepoError(error instanceof Error ? error.message : t('addRepoError', 'Failed to add repository'));
    } finally {
      setIsAddingRepo(false);
    }
  };

  const handleDeleteRepo = async () => {
    if (!workspace || !repoToDelete) return;

    setIsDeleting(true);
    try {
      const success = await removeRepoFromWorkspace(projectPath, repoToDelete.id);

      if (success) {
        // Reload workspace to get updated repos
        const result = await window.electronAPI.getWorkspace(projectPath);
        if (result.success && result.data) {
          setWorkspace(result.data);
        }
      }
    } finally {
      setIsDeleting(false);
      setRepoToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
        <FolderGit2 className="h-4 w-4 animate-pulse" />
        <span className="text-sm">{t('loading', 'Loading...')}</span>
      </div>
    );
  }

  // Show "Convert to Workspace" prompt for convertible projects
  if (detection?.type === 'convertible' && detection.subRepos && detection.subRepos.length > 0) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className={cn("w-full flex items-center gap-2 justify-between text-muted-foreground", className)}
          onClick={() => setShowMigrationWizard(true)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <FolderGit2 className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs">
              {t('migration.foundRepos', { count: detection.subRepos.length })}
            </span>
          </div>
          <ArrowRight className="h-3 w-3 shrink-0" />
        </Button>

        <MigrationWizard
          open={showMigrationWizard}
          onOpenChange={setShowMigrationWizard}
          projectPath={projectPath}
          onMigrationComplete={handleMigrationComplete}
        />
      </>
    );
  }

  // Don't show selector for standalone projects
  if (!workspace) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("w-full flex items-center gap-2 justify-between", className)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <FolderGit2 className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {selectedRepo?.name || workspace.name}
            </span>
          </div>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
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
            className="flex items-center gap-2 group"
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRepoToDelete(repo);
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1 -mr-1"
              title={t('removeRepo', 'Remove repository')}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </DropdownMenuItem>
        ))}

        {workspace.repos.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t('noRepos', 'No repositories added')}
          </div>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleAddRepo} disabled={isAddingRepo}>
          {isAddingRepo ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          {t('addRepo', 'Add Repository')}
        </DropdownMenuItem>

        {addRepoError && (
          <div className="px-2 py-2 text-xs text-destructive">
            {addRepoError}
          </div>
        )}

        {onOpenSettings && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenSettings}>
              <Settings className="h-4 w-4 mr-2" />
              {t('workspaceSettings', 'Workspace Settings')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!repoToDelete} onOpenChange={(open) => !open && setRepoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeRepoTitle', 'Remove Repository?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('removeRepoDescription', 'This will remove "{{name}}" from the workspace. The repository files will not be deleted.', { name: repoToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('common:cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRepo}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('removing', 'Removing...') : t('remove', 'Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DropdownMenu>
  );
}
