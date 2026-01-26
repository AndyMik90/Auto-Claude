import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, ArrowRight, Check, AlertCircle, Loader2, Folder } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog';
import { Alert, AlertDescription } from '../ui/alert';
import { useWorkspaceStore } from '../../stores/workspace-store';

interface CreateWorkspaceWizardProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** Callback when workspace is created, returns the workspace path */
  onWorkspaceCreated: (workspacePath: string) => void;
}

type WizardStep = 'setup' | 'confirm' | 'complete';

/**
 * Wizard for creating a new empty workspace.
 * Users can add repositories to the workspace later via the sidebar.
 */
export function CreateWorkspaceWizard({
  open,
  onOpenChange,
  onWorkspaceCreated
}: CreateWorkspaceWizardProps) {
  const { t } = useTranslation(['workspace', 'common']);

  const [step, setStep] = useState<WizardStep>('setup');
  const [workspaceName, setWorkspaceName] = useState('');
  const [parentDirectory, setParentDirectory] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPath, setCreatedPath] = useState<string | null>(null);

  const { createWorkspace, error: storeError } = useWorkspaceStore();

  // Get the full workspace path
  const workspacePath = parentDirectory && workspaceName
    ? `${parentDirectory}/${workspaceName}`
    : '';

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('setup');
      setWorkspaceName('');
      setParentDirectory('');
      setError(null);
      setCreatedPath(null);
      loadDefaultLocation();
    }
  }, [open]);

  const loadDefaultLocation = async () => {
    try {
      const defaultDir = await window.electronAPI.getDefaultProjectLocation();
      if (defaultDir) {
        setParentDirectory(defaultDir);
      }
    } catch {
      // Ignore - will just be empty
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        setParentDirectory(path);
      }
    } catch {
      // User cancelled - ignore
    }
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim() || !parentDirectory.trim()) {
      setError(t('common:errors.requiredField'));
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const workspace = await createWorkspace({
        name: workspaceName.trim(),
        path: workspacePath,
        createDirectory: true,
        repos: []
      });

      if (workspace) {
        setCreatedPath(workspace.path);
        setStep('complete');
      } else {
        // Get detailed error from store if available
        const detailedError = useWorkspaceStore.getState().error;
        setError(detailedError || t('workspace:createWizard.error', 'Failed to create workspace'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workspace:createWizard.error', 'Failed to create workspace'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleComplete = () => {
    if (createdPath) {
      onWorkspaceCreated(createdPath);
    }
    onOpenChange(false);
  };

  const canProceedToConfirm = workspaceName.trim() && parentDirectory.trim();

  const renderSetupStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          {t('workspace:createWizard.title', 'Create New Workspace')}
        </DialogTitle>
        <DialogDescription>
          {t('workspace:createWizard.setupDescription', 'Choose a name and location for your new workspace.')}
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-4">
        {/* Workspace Name */}
        <div className="space-y-2">
          <Label htmlFor="workspace-name">
            {t('workspace:createWizard.workspaceName', 'Workspace Name')}
          </Label>
          <Input
            id="workspace-name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder={t('workspace:createWizard.workspaceNamePlaceholder', 'my-workspace')}
            autoFocus
          />
        </div>

        {/* Parent Directory */}
        <div className="space-y-2">
          <Label htmlFor="parent-directory">
            {t('workspace:createWizard.parentDirectory', 'Parent Directory')}
          </Label>
          <div className="flex gap-2">
            <Input
              id="parent-directory"
              value={parentDirectory}
              onChange={(e) => setParentDirectory(e.target.value)}
              placeholder={t('workspace:createWizard.parentDirectoryPlaceholder', 'Select a folder...')}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleSelectDirectory}>
              {t('workspace:createWizard.browse', 'Browse')}
            </Button>
          </div>
        </div>

        {/* Will create path */}
        {workspacePath && (
          <div className="text-sm">
            <span className="text-muted-foreground">
              {t('workspace:createWizard.willCreate', 'Will create:')}
            </span>
            <code className="ml-2 bg-muted px-2 py-1 rounded text-xs">
              {workspacePath}
            </code>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common:cancel', 'Cancel')}
        </Button>
        <Button onClick={() => setStep('confirm')} disabled={!canProceedToConfirm}>
          {t('common:next', 'Next')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );

  const renderConfirmStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>{t('workspace:createWizard.confirmTitle', 'Confirm')}</DialogTitle>
        <DialogDescription>
          {t('workspace:createWizard.confirmDescription', 'Review your workspace configuration before creating.')}
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-4">
        <div className="rounded-md border p-4 space-y-3">
          {/* Workspace Name */}
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t('workspace:createWizard.workspaceName', 'Workspace Name')}
              </p>
              <p className="font-medium">{workspaceName}</p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t('workspace:createWizard.location', 'Location')}
              </p>
              <p className="font-medium text-sm break-all">{workspacePath}</p>
            </div>
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
        <Button variant="outline" onClick={() => setStep('setup')} disabled={isCreating}>
          {t('common:back', 'Back')}
        </Button>
        <Button onClick={handleCreateWorkspace} disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('workspace:createWizard.creating', 'Creating...')}
            </>
          ) : (
            t('workspace:createWizard.create', 'Create Workspace')
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
          {t('workspace:createWizard.completeTitle', 'Workspace Created')}
        </DialogTitle>
        <DialogDescription>
          {t('workspace:createWizard.completeDescription', 'Your workspace has been created successfully.')}
        </DialogDescription>
      </DialogHeader>

      <div className="py-6">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-full bg-green-100 p-3">
            <Layers className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-center text-muted-foreground">
            {t('workspace:createWizard.completeMessage', 'Add repositories to your workspace using the sidebar menu.')}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={handleComplete}>
          {t('workspace:createWizard.openWorkspace', 'Open Workspace')}
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {step === 'setup' && renderSetupStep()}
        {step === 'confirm' && renderConfirmStep()}
        {step === 'complete' && renderCompleteStep()}
      </DialogContent>
    </Dialog>
  );
}
