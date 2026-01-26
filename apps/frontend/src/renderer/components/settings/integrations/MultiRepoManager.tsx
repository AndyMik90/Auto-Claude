/**
 * Multi-Repository Manager Component
 * Manages multiple GitHub repositories for a project
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  Star,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  GitFork,
  FolderGit2
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../ui/select';
import {
  useMultiRepoStore,
  loadMultiRepoConfig,
  addRepository,
  removeRepository,
  updateRepository,
  setDefaultRepository,
  checkAllRepoConnections
} from '../../../stores/github';
import type { GitHubRepoConfig, GitHubRepoSyncStatus } from '../../../../shared/types';

interface MultiRepoManagerProps {
  projectId: string;
}

export function MultiRepoManager({ projectId }: MultiRepoManagerProps) {
  const { t } = useTranslation(['settings']);
  const [isAddingRepo, setIsAddingRepo] = useState(false);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);

  const {
    config,
    isConfigLoading,
    configError,
    syncStatus,
    isSyncStatusLoading
  } = useMultiRepoStore();

  // Load config on mount
  useEffect(() => {
    if (projectId) {
      loadMultiRepoConfig(projectId);
      checkAllRepoConnections(projectId);
    }
  }, [projectId]);

  const handleAddRepository = async (repoConfig: GitHubRepoConfig) => {
    const success = await addRepository(projectId, repoConfig);
    if (success) {
      setIsAddingRepo(false);
      // Refresh connections after adding
      checkAllRepoConnections(projectId);
    }
  };

  const handleRemoveRepository = async (repo: string) => {
    await removeRepository(projectId, repo);
  };

  const handleUpdateRepository = async (repoConfig: GitHubRepoConfig) => {
    await updateRepository(projectId, repoConfig);
  };

  const handleSetDefault = async (repo: string) => {
    await setDefaultRepository(projectId, repo);
  };

  const handleRefreshConnections = () => {
    checkAllRepoConnections(projectId);
  };

  const getRepoSyncStatus = (repo: string): GitHubRepoSyncStatus | undefined => {
    return syncStatus?.repos.find((r) => r.repo === repo);
  };

  const repos = config?.repos || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-foreground">
            {t('settings:projectSections.github.multiRepo.title')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t('settings:projectSections.github.multiRepo.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshConnections}
            disabled={isSyncStatusLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncStatusLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddingRepo(true)}
            disabled={isAddingRepo}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('settings:projectSections.github.multiRepo.addRepository')}
          </Button>
        </div>
      </div>

      {/* Error display */}
      {configError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          <AlertCircle className="h-4 w-4" />
          {configError}
        </div>
      )}

      {/* Loading state */}
      {isConfigLoading && repos.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isConfigLoading && repos.length === 0 && !isAddingRepo && (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <FolderGit2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">
            {t('settings:projectSections.github.multiRepo.noRepositories')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('settings:projectSections.github.multiRepo.noRepositoriesDescription')}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setIsAddingRepo(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('settings:projectSections.github.multiRepo.addRepository')}
          </Button>
        </div>
      )}

      {/* Add repository form */}
      {isAddingRepo && (
        <AddRepositoryForm
          onAdd={handleAddRepository}
          onCancel={() => setIsAddingRepo(false)}
          isLoading={isConfigLoading}
        />
      )}

      {/* Repository list */}
      {repos.length > 0 && (
        <div className="space-y-2">
          {repos.map((repo) => (
            <RepositoryCard
              key={repo.repo}
              repoConfig={repo}
              isDefault={config?.defaultRepo === repo.repo}
              syncStatus={getRepoSyncStatus(repo.repo)}
              isExpanded={expandedRepo === repo.repo}
              onToggleExpand={() =>
                setExpandedRepo(expandedRepo === repo.repo ? null : repo.repo)
              }
              onUpdate={handleUpdateRepository}
              onRemove={() => handleRemoveRepository(repo.repo)}
              onSetDefault={() => handleSetDefault(repo.repo)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AddRepositoryFormProps {
  onAdd: (config: GitHubRepoConfig) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function AddRepositoryForm({ onAdd, onCancel, isLoading }: AddRepositoryFormProps) {
  const { t } = useTranslation(['settings']);
  const [repoName, setRepoName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!repoName.trim()) {
      setError('Repository name is required');
      return;
    }

    // Validate format (owner/repo)
    if (!repoName.includes('/')) {
      setError('Format: owner/repo (e.g., facebook/react)');
      return;
    }

    onAdd({
      repo: repoName.trim(),
      enabled: true,
      issuesSyncEnabled: true,
      prReviewEnabled: true,
      autoFixEnabled: false
    });
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Repository</Label>
        <Input
          placeholder="owner/repository"
          value={repoName}
          onChange={(e) => {
            setRepoName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
        />
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Format: owner/repo (e.g., facebook/react)
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={isLoading || !repoName.trim()}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          Add
        </Button>
      </div>
    </div>
  );
}

interface RepositoryCardProps {
  repoConfig: GitHubRepoConfig;
  isDefault: boolean;
  syncStatus?: GitHubRepoSyncStatus;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (config: GitHubRepoConfig) => void;
  onRemove: () => void;
  onSetDefault: () => void;
}

function RepositoryCard({
  repoConfig,
  isDefault,
  syncStatus,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  onSetDefault
}: RepositoryCardProps) {
  const { t } = useTranslation(['settings']);

  const handleToggle = (field: keyof GitHubRepoConfig) => (checked: boolean) => {
    onUpdate({ ...repoConfig, [field]: checked });
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <GitFork className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{repoConfig.repo}</span>
              {isDefault && (
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                  {t('settings:projectSections.github.multiRepo.default')}
                </span>
              )}
              {!repoConfig.enabled && (
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  {t('settings:projectSections.github.multiRepo.disabled')}
                </span>
              )}
            </div>
            {/* Connection status */}
            <div className="flex items-center gap-2 mt-0.5">
              {syncStatus === undefined ? (
                <span className="text-xs text-muted-foreground">
                  {t('settings:projectSections.github.multiRepo.checkingConnection')}
                </span>
              ) : syncStatus.connected ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span className="text-xs text-success">
                    {t('settings:projectSections.github.multiRepo.connected')}
                  </span>
                  {syncStatus.issueCount !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      • {t('settings:projectSections.github.multiRepo.issueCount', { count: syncStatus.issueCount })}
                    </span>
                  )}
                  {syncStatus.prCount !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      • {t('settings:projectSections.github.multiRepo.prCount', { count: syncStatus.prCount })}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 text-warning" />
                  <span className="text-xs text-warning">
                    {syncStatus.error || t('settings:projectSections.github.multiRepo.disconnected')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={repoConfig.enabled}
            onCheckedChange={handleToggle('enabled')}
            onClick={(e) => e.stopPropagation()}
          />
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded settings */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-border">
          {/* Feature toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">
                  {t('settings:projectSections.github.multiRepo.issuesSync')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('settings:projectSections.github.multiRepo.issuesSyncDescription')}
                </p>
              </div>
              <Switch
                checked={repoConfig.issuesSyncEnabled ?? true}
                onCheckedChange={handleToggle('issuesSyncEnabled')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">
                  {t('settings:projectSections.github.multiRepo.prReview')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('settings:projectSections.github.multiRepo.prReviewDescription')}
                </p>
              </div>
              <Switch
                checked={repoConfig.prReviewEnabled ?? true}
                onCheckedChange={handleToggle('prReviewEnabled')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">
                  {t('settings:projectSections.github.multiRepo.autoFix')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('settings:projectSections.github.multiRepo.autoFixDescription')}
                </p>
              </div>
              <Switch
                checked={repoConfig.autoFixEnabled ?? false}
                onCheckedChange={handleToggle('autoFixEnabled')}
              />
            </div>
          </div>

          {/* Path scope */}
          <div className="space-y-2">
            <Label className="text-sm">
              {t('settings:projectSections.github.multiRepo.pathScope')}
            </Label>
            <Input
              placeholder={t('settings:projectSections.github.multiRepo.pathScopePlaceholder')}
              value={repoConfig.pathScope || ''}
              onChange={(e) => onUpdate({ ...repoConfig, pathScope: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings:projectSections.github.multiRepo.pathScopeDescription')}
            </p>
          </div>

          {/* Repository relationship */}
          <div className="space-y-2">
            <Label className="text-sm">
              {t('settings:projectSections.github.multiRepo.relationship')}
            </Label>
            <Select
              value={repoConfig.relationship || 'standalone'}
              onValueChange={(value) =>
                onUpdate({
                  ...repoConfig,
                  relationship: value as GitHubRepoConfig['relationship']
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standalone">
                  {t('settings:projectSections.github.multiRepo.relationshipStandalone')}
                </SelectItem>
                <SelectItem value="fork">
                  {t('settings:projectSections.github.multiRepo.relationshipFork')}
                </SelectItem>
                <SelectItem value="upstream">
                  {t('settings:projectSections.github.multiRepo.relationshipUpstream')}
                </SelectItem>
                <SelectItem value="monorepo_package">
                  {t('settings:projectSections.github.multiRepo.relationshipMonorepo')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2 border-t border-border">
            <div>
              {!isDefault && (
                <Button variant="ghost" size="sm" onClick={onSetDefault}>
                  <Star className="h-4 w-4 mr-1" />
                  {t('settings:projectSections.github.multiRepo.setDefault')}
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t('settings:projectSections.github.multiRepo.removeRepository')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
