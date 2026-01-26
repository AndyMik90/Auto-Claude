import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderGit2, GitBranch, ArrowRight, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog';
import { Alert, AlertDescription } from '../ui/alert';
import { cn } from '../../lib/utils';
import { useWorkspaceStore } from '../../stores/workspace-store';
import type { ProjectTypeDetectionResult } from '../../../shared/types/workspace';

interface MigrationWizardProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** Path to the project being migrated */
  projectPath: string;
  /** Callback when migration is complete */
  onMigrationComplete?: () => void;
}

type WizardStep = 'detect' | 'configure' | 'confirm' | 'complete';

/**
 * Wizard for converting a directory with multiple Git repos into a workspace.
 * Guides users through detecting repos, naming the workspace, and selecting defaults.
 */
export function MigrationWizard({
  open,
  onOpenChange,
  projectPath,
  onMigrationComplete
}: MigrationWizardProps) {
  const { t } = useTranslation('workspace');

  const [step, setStep] = useState<WizardStep>('detect');
  const [workspaceName, setWorkspaceName] = useState('');
  const [detection, setDetection] = useState<ProjectTypeDetectionResult | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [defaultRepo, setDefaultRepo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createWorkspace, detectProjectType } = useWorkspaceStore();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('detect');
      setWorkspaceName('');
      setDetection(null);
      setSelectedRepos(new Set());
      setDefaultRepo(null);
      setError(null);
      runDetection();
    }
  }, [open, projectPath]);

  const runDetection = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await detectProjectType(projectPath);
      setDetection(result);

      if (result) {
        // Set default workspace name from path
        const pathParts = projectPath.split(/[/\\]/);
        setWorkspaceName(pathParts[pathParts.length - 1] || 'My Workspace');

        // Auto-select all detected repos
        if (result.subRepos) {
          const repoPaths = new Set(result.subRepos.map(r => r.path));
          setSelectedRepos(repoPaths);
          // Set first repo as default
          if (result.subRepos.length > 0) {
            setDefaultRepo(result.subRepos[0].path);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect project type');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepoToggle = (repoPath: string) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(repoPath)) {
      newSelected.delete(repoPath);
      // If we're removing the default, pick a new one
      if (defaultRepo === repoPath) {
        setDefaultRepo(Array.from(newSelected)[0] || null);
      }
    } else {
      newSelected.add(repoPath);
      // If this is the first repo, make it default
      if (newSelected.size === 1) {
        setDefaultRepo(repoPath);
      }
    }
    setSelectedRepos(newSelected);
  };

  const handleCreateWorkspace = async () => {
    if (!detection?.subRepos || selectedRepos.size === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const repos = detection.subRepos
        .filter(r => selectedRepos.has(r.path))
        .map(r => ({
          relativePath: r.path,
          name: r.name,
          isDefault: r.path === defaultRepo
        }));

      const workspace = await createWorkspace({
        name: workspaceName,
        path: projectPath,
        repos
      });

      if (workspace) {
        setStep('complete');
        onMigrationComplete?.();
      } else {
        setError('Failed to create workspace');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const renderDetectStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          {t('migration.title', 'Convert to Workspace')}
        </DialogTitle>
        <DialogDescription>
          {t('migration.detectDescription', 'Scanning for Git repositories in this directory...')}
        </DialogDescription>
      </DialogHeader>

      <div className="py-6">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {t('migration.scanning', 'Scanning for repositories...')}
            </p>
          </div>
        ) : detection?.type === 'convertible' && detection.subRepos ? (
          <div className="space-y-4">
            <Alert>
              <FolderGit2 className="h-4 w-4" />
              <AlertDescription>
                {t('migration.foundRepos', 'Found {{count}} Git repositories', {
                  count: detection.subRepos.length
                })}
              </AlertDescription>
            </Alert>

            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {detection.subRepos.map((repo) => (
                <div
                  key={repo.path}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                >
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{repo.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{repo.path}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : detection?.type === 'standalone' ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('migration.alreadyStandalone', 'This is already a Git repository. No conversion needed.')}
            </AlertDescription>
          </Alert>
        ) : detection?.type === 'workspace' ? (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>
              {t('migration.alreadyWorkspace', 'This is already a workspace.')}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('migration.noReposFound', 'No Git repositories found in subdirectories.')}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common:cancel', 'Cancel')}
        </Button>
        {detection?.type === 'convertible' && (
          <Button onClick={() => setStep('configure')}>
            {t('common:next', 'Next')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </DialogFooter>
    </>
  );

  const renderConfigureStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>{t('migration.configureTitle', 'Configure Workspace')}</DialogTitle>
        <DialogDescription>
          {t('migration.configureDescription', 'Name your workspace and select which repositories to include.')}
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">{t('migration.workspaceName', 'Workspace Name')}</Label>
          <Input
            id="workspace-name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder={t('migration.workspaceNamePlaceholder', 'My Workspace')}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('migration.selectRepos', 'Select Repositories')}</Label>
          <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-2">
            {detection?.subRepos?.map((repo) => (
              <div
                key={repo.path}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedRepos.has(repo.path)}
                  onCheckedChange={() => handleRepoToggle(repo.path)}
                />
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{repo.name}</p>
                </div>
                {selectedRepos.has(repo.path) && (
                  <Button
                    variant={defaultRepo === repo.path ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setDefaultRepo(repo.path)}
                  >
                    {defaultRepo === repo.path
                      ? t('migration.default', 'Default')
                      : t('migration.setDefault', 'Set as default')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('detect')}>
          {t('common:back', 'Back')}
        </Button>
        <Button
          onClick={() => setStep('confirm')}
          disabled={!workspaceName.trim() || selectedRepos.size === 0}
        >
          {t('common:next', 'Next')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );

  const renderConfirmStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>{t('migration.confirmTitle', 'Confirm Migration')}</DialogTitle>
        <DialogDescription>
          {t('migration.confirmDescription', 'Review your workspace configuration before creating.')}
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-4">
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-primary" />
            <span className="font-medium">{workspaceName}</span>
          </div>

          <div className="pl-7 space-y-2">
            {detection?.subRepos
              ?.filter(r => selectedRepos.has(r.path))
              .map((repo) => (
                <div key={repo.path} className="flex items-center gap-2 text-sm">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span>{repo.name}</span>
                  {repo.path === defaultRepo && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {t('migration.default', 'Default')}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('configure')} disabled={isLoading}>
          {t('common:back', 'Back')}
        </Button>
        <Button onClick={handleCreateWorkspace} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('migration.creating', 'Creating...')}
            </>
          ) : (
            t('migration.createWorkspace', 'Create Workspace')
          )}
        </Button>
      </DialogFooter>
    </>
  );

  const renderCompleteStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-green-600">
          <Check className="h-5 w-5" />
          {t('migration.completeTitle', 'Workspace Created')}
        </DialogTitle>
        <DialogDescription>
          {t('migration.completeDescription', 'Your workspace has been set up successfully.')}
        </DialogDescription>
      </DialogHeader>

      <div className="py-6">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-full bg-green-100 p-3">
            <FolderGit2 className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-center text-muted-foreground">
            {t('migration.completeMessage', 'You can now manage multiple repositories from this workspace.')}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={() => onOpenChange(false)}>
          {t('common:done', 'Done')}
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {step === 'detect' && renderDetectStep()}
        {step === 'configure' && renderConfigureStep()}
        {step === 'confirm' && renderConfirmStep()}
        {step === 'complete' && renderCompleteStep()}
      </DialogContent>
    </Dialog>
  );
}
