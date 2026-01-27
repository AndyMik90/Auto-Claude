import { useTranslation } from 'react-i18next';
import { Github, CheckCircle2 } from 'lucide-react';
import { Label } from '../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { GitHubIntegration } from './GitHubIntegration';
import { GitLabIntegration } from './GitLabIntegration';
import type {
  ProjectEnvConfig,
  ProjectSettings as ProjectSettingsType,
  GitHubSyncStatus,
  GitLabSyncStatus
} from '../../../../shared/types';

// GitLab icon component
function GitLabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" role="img" aria-labelledby="gitlab-icon-title">
      <title id="gitlab-icon-title">GitLab</title>
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
    </svg>
  );
}

interface SourceControlSettingsProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  settings: ProjectSettingsType;
  setSettings: React.Dispatch<React.SetStateAction<ProjectSettingsType>>;
  projectPath: string;
  // GitHub state
  showGitHubToken: boolean;
  setShowGitHubToken: React.Dispatch<React.SetStateAction<boolean>>;
  gitHubConnectionStatus: GitHubSyncStatus | null;
  isCheckingGitHub: boolean;
  // GitLab state
  showGitLabToken: boolean;
  setShowGitLabToken: React.Dispatch<React.SetStateAction<boolean>>;
  gitLabConnectionStatus: GitLabSyncStatus | null;
  isCheckingGitLab: boolean;
}

/**
 * Source Control settings tab.
 * Allows selection between GitHub and GitLab for repository management.
 */
export function SourceControlSettings({
  envConfig,
  updateEnvConfig,
  settings,
  setSettings,
  projectPath,
  showGitHubToken,
  setShowGitHubToken,
  gitHubConnectionStatus,
  isCheckingGitHub,
  showGitLabToken,
  setShowGitLabToken,
  gitLabConnectionStatus,
  isCheckingGitLab
}: SourceControlSettingsProps) {
  const { t } = useTranslation('settings');

  if (!envConfig) return null;

  // Determine current provider based on what's enabled
  const currentProvider = envConfig.sourceControlProvider ||
    (envConfig.gitlabEnabled ? 'gitlab' : envConfig.githubEnabled ? 'github' : undefined);

  const handleProviderChange = (provider: 'github' | 'gitlab') => {
    updateEnvConfig({
      sourceControlProvider: provider,
      // Enable the selected provider
      githubEnabled: provider === 'github',
      gitlabEnabled: provider === 'gitlab'
    });
  };

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">
            {t('projectSections.integrations.sourceControl.provider')}
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            {t('projectSections.integrations.sourceControl.providerDescription')}
          </p>
        </div>

        <RadioGroup
          value={currentProvider || ''}
          onValueChange={(value) => handleProviderChange(value as 'github' | 'gitlab')}
          className="grid grid-cols-2 gap-4"
        >
          {/* GitHub Option */}
          <div className="relative">
            <RadioGroupItem value="github" id="github" className="peer sr-only" />
            <Label
              htmlFor="github"
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <Github className="h-8 w-8" />
              <span className="font-medium">GitHub</span>
              {gitHubConnectionStatus?.connected && (
                <CheckCircle2 className="h-4 w-4 text-success absolute top-2 right-2" />
              )}
            </Label>
          </div>

          {/* GitLab Option */}
          <div className="relative">
            <RadioGroupItem value="gitlab" id="gitlab" className="peer sr-only" />
            <Label
              htmlFor="gitlab"
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <GitLabIcon className="h-8 w-8" />
              <span className="font-medium">GitLab</span>
              {gitLabConnectionStatus?.connected && (
                <CheckCircle2 className="h-4 w-4 text-success absolute top-2 right-2" />
              )}
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Provider-specific Configuration */}
      {currentProvider === 'github' && (
        <div className="border-t border-border pt-6">
          <GitHubIntegration
            envConfig={envConfig}
            updateEnvConfig={updateEnvConfig}
            showGitHubToken={showGitHubToken}
            setShowGitHubToken={setShowGitHubToken}
            gitHubConnectionStatus={gitHubConnectionStatus}
            isCheckingGitHub={isCheckingGitHub}
            projectPath={projectPath}
            settings={settings}
            setSettings={setSettings}
          />
        </div>
      )}

      {currentProvider === 'gitlab' && (
        <div className="border-t border-border pt-6">
          <GitLabIntegration
            envConfig={envConfig}
            updateEnvConfig={updateEnvConfig}
            showGitLabToken={showGitLabToken}
            setShowGitLabToken={setShowGitLabToken}
            gitLabConnectionStatus={gitLabConnectionStatus}
            isCheckingGitLab={isCheckingGitLab}
            projectPath={projectPath}
            settings={settings}
            setSettings={setSettings}
          />
        </div>
      )}

      {!currentProvider && (
        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('projectSections.integrations.sourceControl.selectProvider')}
          </p>
        </div>
      )}
    </div>
  );
}
