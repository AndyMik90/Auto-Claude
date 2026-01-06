import { useState } from 'react';
import { Lock, Globe, Server, Loader2, Plus, ArrowLeft, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import { OwnerSelector } from './OwnerSelector';
import type { Owner, RemoteAction, GitLabVisibility } from './types';

interface GitLabRepoConfigStepProps {
  projectName: string;
  config: {
    instanceUrl?: string;
    namespace?: string;
    visibility?: GitLabVisibility;
    action?: RemoteAction;
    existingProject?: string;
  };
  onChange: (updates: Partial<GitLabRepoConfigStepProps['config']>) => void;
  onComplete: (config: GitLabRepoConfigStepProps['config']) => void;
  onBack: () => void;
  gitlabUsername?: string;
  groups?: Owner[];
  isLoadingGroups?: boolean;
}

/**
 * GitLab project configuration step
 * Handles create/link project with namespace and visibility selection
 */
export function GitLabRepoConfigStep({
  projectName,
  config,
  onChange,
  onComplete,
  onBack,
  gitlabUsername,
  groups = [],
  isLoadingGroups = false,
}: GitLabRepoConfigStepProps) {
  const { t } = useTranslation('dialogs');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    instanceUrl = '',
    namespace = gitlabUsername || '',
    visibility = 'private',
    action = 'create',
    existingProject = '',
  } = config;

  const handleNamespaceSelect = (selected: string) => {
    onChange({ namespace: selected });
  };

  const handleVisibilitySelect = (selected: GitLabVisibility) => {
    onChange({ visibility: selected });
  };

  const handleSetAction = (newAction: RemoteAction) => {
    onChange({ action: newAction });
  };

  const handleComplete = async () => {
    if (action === 'link') {
      if (!existingProject.trim()) {
        setError('Please enter a project path');
        return;
      }
      // Validate format: group/project or just project
      const format = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)?$/;
      if (!format.test(existingProject.trim())) {
        setError('Invalid project format. Use group/project or project');
        return;
      }
    } else {
      if (!namespace.trim()) {
        setError('Please select a namespace');
        return;
      }
    }

    setError(null);
    setIsCreating(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      onComplete(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure project');
    } finally {
      setIsCreating(false);
    }
  };

  const sanitizedProjectName = projectName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Configure GitLab Project</h2>
        <p className="text-sm text-muted-foreground">
          Create a new project or link to an existing one
        </p>
      </div>

      {/* Action Selection */}
      {action === 'create' || action === 'link' ? (
        <>
          {action === 'create' ? (
            <>
              {/* Create New Project Form */}
              <div className="space-y-4">
                {/* Instance URL (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="instance-url">
                    {t('remoteSetup.repoConfig.instanceUrl')}
                  </Label>
                  <Input
                    id="instance-url"
                    value={instanceUrl}
                    onChange={(e) => onChange({ instanceUrl: e.target.value })}
                    placeholder="https://gitlab.com"
                    disabled={isCreating}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('remoteSetup.repoConfig.instanceUrlHelp')}
                  </p>
                </div>

                {/* Namespace Selection */}
                {gitlabUsername && (
                  <OwnerSelector
                    type="gitlab"
                    personal={{ id: gitlabUsername, name: gitlabUsername, path: gitlabUsername }}
                    organizations={groups}
                    selected={namespace}
                    onSelect={handleNamespaceSelect}
                    isLoading={isLoadingGroups}
                    disabled={isCreating}
                  />
                )}

                {/* Project Name */}
                <div className="space-y-2">
                  <Label>{t('remoteSetup.repoConfig.projectName')}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {namespace || '...'} /
                    </span>
                    <Input
                      value={sanitizedProjectName}
                      readOnly
                      disabled={isCreating}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Auto-filled from project name
                  </p>
                </div>

                {/* Visibility Selection */}
                <div className="space-y-2">
                  <Label>{t('remoteSetup.repoConfig.visibility')}</Label>
                  <div className="flex flex-wrap gap-2" role="radiogroup">
                    <button
                      onClick={() => handleVisibilitySelect('private')}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-md border transition-colors',
                        visibility === 'private'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-muted hover:border-primary/50'
                      )}
                      disabled={isCreating}
                      role="radio"
                      aria-checked={visibility === 'private'}
                    >
                      <Lock className="h-4 w-4" />
                      <span className="text-sm">{t('remoteSetup.repoConfig.private')}</span>
                    </button>
                    <button
                      onClick={() => handleVisibilitySelect('internal')}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-md border transition-colors',
                        visibility === 'internal'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-muted hover:border-primary/50'
                      )}
                      disabled={isCreating}
                      role="radio"
                      aria-checked={visibility === 'internal'}
                    >
                      <Users className="h-4 w-4" />
                      <span className="text-sm">{t('remoteSetup.repoConfig.internal')}</span>
                    </button>
                    <button
                      onClick={() => handleVisibilitySelect('public')}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-md border transition-colors',
                        visibility === 'public'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-muted hover:border-primary/50'
                      )}
                      disabled={isCreating}
                      role="radio"
                      aria-checked={visibility === 'public'}
                    >
                      <Globe className="h-4 w-4" />
                      <span className="text-sm">{t('remoteSetup.repoConfig.public')}</span>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('remoteSetup.repoConfig.visibilityHelp')}
                  </p>
                </div>

                {/* Switch to Link Existing */}
                <button
                  onClick={() => handleSetAction('link')}
                  className="text-sm text-primary hover:underline"
                >
                  Or link to existing project
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Link Existing Project Form */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetAction('create')}
                    className="h-auto p-0"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <span className="text-sm text-muted-foreground">Link to existing project</span>
                </div>

                {/* Instance URL */}
                <div className="space-y-2">
                  <Label htmlFor="link-instance-url">
                    {t('remoteSetup.repoConfig.instanceUrl')}
                  </Label>
                  <Input
                    id="link-instance-url"
                    value={instanceUrl}
                    onChange={(e) => onChange({ instanceUrl: e.target.value })}
                    placeholder="https://gitlab.com"
                    disabled={isCreating}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('remoteSetup.repoConfig.instanceUrlHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="existing-project">
                    {t('remoteSetup.repoConfig.existingProject')}
                  </Label>
                  <Input
                    id="existing-project"
                    value={existingProject}
                    onChange={(e) => onChange({ existingProject: e.target.value })}
                    placeholder="group/project"
                    disabled={isCreating}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the full project path (e.g., mygroup/myproject)
                  </p>
                </div>

                {/* Switch to Create New */}
                <button
                  onClick={() => handleSetAction('create')}
                  className="text-sm text-primary hover:underline"
                >
                  Or create a new project
                </button>
              </div>
            </>
          )}

          {/* Error Display */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} disabled={isCreating}>
              Back
            </Button>
            <Button onClick={handleComplete} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  {action === 'link' ? 'Link Project' : 'Create Project'}
                </>
              )}
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Initial Action Selection */}
          <div className="grid gap-3">
            <button
              onClick={() => handleSetAction('create')}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left',
                'bg-card hover:bg-accent hover:border-accent'
              )}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                <Plus className="h-6 w-6 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">{t('remoteSetup.repoConfig.createNew')}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Create a new project on GitLab
                </p>
              </div>
            </button>

            <button
              onClick={() => handleSetAction('link')}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left',
                'bg-card hover:bg-accent hover:border-accent'
              )}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Server className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">{t('remoteSetup.repoConfig.linkExisting')}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Connect to an existing GitLab project
                </p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
