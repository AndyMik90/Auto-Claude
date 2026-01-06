import { useState, useEffect } from 'react';
import { Lock, Globe, Loader2, Plus, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import { OwnerSelector } from './OwnerSelector';
import type { Owner, RemoteAction, GitHubVisibility } from './types';

interface GitHubRepoConfigStepProps {
  projectName: string;
  config: {
    owner?: string;
    visibility?: GitHubVisibility;
    action?: RemoteAction;
    existingRepo?: string;
  };
  onChange: (updates: Partial<GitHubRepoConfigStepProps['config']>) => void;
  onComplete: (config: GitHubRepoConfigStepProps['config']) => void;
  onBack: () => void;
  githubUsername?: string;
  organizations?: Owner[];
  isLoadingOrgs?: boolean;
}

/**
 * GitHub repository configuration step
 * Handles create/link repository with owner and visibility selection
 */
export function GitHubRepoConfigStep({
  projectName,
  config,
  onChange,
  onComplete,
  onBack,
  githubUsername,
  organizations = [],
  isLoadingOrgs = false,
}: GitHubRepoConfigStepProps) {
  const { t } = useTranslation('dialogs');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { action = 'create', owner = githubUsername || '', visibility = 'private', existingRepo = '' } = config;

  const handleOwnerSelect = (selected: string) => {
    onChange({ owner: selected });
  };

  const handleVisibilitySelect = (selected: GitHubVisibility) => {
    onChange({ visibility: selected });
  };

  const handleSetAction = (newAction: RemoteAction) => {
    onChange({ action: newAction });
  };

  const handleComplete = async () => {
    if (action === 'link') {
      if (!existingRepo.trim()) {
        setError('Please enter a repository path');
        return;
      }
      // Validate format: owner/repo
      const format = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
      if (!format.test(existingRepo.trim())) {
        setError('Invalid repository format. Use owner/repo');
        return;
      }
    } else {
      if (!owner.trim()) {
        setError('Please select an owner');
        return;
      }
    }

    setError(null);
    setIsCreating(true);

    try {
      // Simulate async operation (actual repo creation happens in parent)
      await new Promise(resolve => setTimeout(resolve, 500));
      onComplete(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure repository');
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
        <h2 className="text-lg font-semibold">Configure GitHub Repository</h2>
        <p className="text-sm text-muted-foreground">
          Create a new repository or link to an existing one
        </p>
      </div>

      {/* Action Selection (initial state) */}
      {action === 'create' || action === 'link' ? (
        <>
          {action === 'create' ? (
            <>
              {/* Create New Repository Form */}
              <div className="space-y-4">
                {/* Owner Selection */}
                {githubUsername && (
                  <OwnerSelector
                    type="github"
                    personal={{ id: githubUsername, name: githubUsername, path: githubUsername }}
                    organizations={organizations}
                    selected={owner}
                    onSelect={handleOwnerSelect}
                    isLoading={isLoadingOrgs}
                    disabled={isCreating}
                  />
                )}

                {/* Repository Name */}
                <div className="space-y-2">
                  <Label htmlFor="repo-name">Repository Name</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {owner || '...'} /
                    </span>
                    <Input
                      id="repo-name"
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
                  <Label>Visibility</Label>
                  <div className="flex gap-2" role="radiogroup">
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
                      <span className="text-sm">Private</span>
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
                      <span className="text-sm">Public</span>
                    </button>
                  </div>
                </div>

                {/* Switch to Link Existing */}
                <button
                  onClick={() => handleSetAction('link')}
                  className="text-sm text-primary hover:underline"
                >
                  Or link to existing repository
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Link Existing Repository Form */}
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
                  <span className="text-sm text-muted-foreground">Link to existing repository</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="existing-repo">Repository</Label>
                  <Input
                    id="existing-repo"
                    value={existingRepo}
                    onChange={(e) => onChange({ existingRepo: e.target.value })}
                    placeholder="username/repository"
                    disabled={isCreating}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the full repository path (e.g., octocat/hello-world)
                  </p>
                </div>

                {/* Switch to Create New */}
                <button
                  onClick={() => handleSetAction('create')}
                  className="text-sm text-primary hover:underline"
                >
                  Or create a new repository
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
                  {action === 'link' ? 'Link Repository' : 'Create Repository'}
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">Create new repository</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Create a new repository on GitHub
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-muted-foreground"
                >
                  <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4" />
                  <polyline points="9 12 12 15 15 12" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">Link existing repository</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Connect to an existing GitHub repository
                </p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
