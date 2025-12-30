import type { Project, ProjectSettings as ProjectSettingsType, AutoBuildVersionInfo, ProjectEnvConfig, LinearSyncStatus, GitHubSyncStatus } from '../../../../shared/types';
import { SettingsSection } from '../SettingsSection';
import { GeneralSettings } from '../../project-settings/GeneralSettings';
import { EnvironmentSettings } from '../../project-settings/EnvironmentSettings';
import { SecuritySettings } from '../../project-settings/SecuritySettings';
import { LinearIntegration } from '../integrations/LinearIntegration';
import { GitHubIntegration } from '../integrations/GitHubIntegration';
import { InitializationGuard } from '../common/InitializationGuard';
import type { ProjectSettingsSection } from '../ProjectSettingsContent';
import { useTranslation } from 'react-i18next';

interface SectionRouterProps {
  activeSection: ProjectSettingsSection;
  project: Project;
  settings: ProjectSettingsType;
  setSettings: React.Dispatch<React.SetStateAction<ProjectSettingsType>>;
  versionInfo: AutoBuildVersionInfo | null;
  isCheckingVersion: boolean;
  isUpdating: boolean;
  envConfig: ProjectEnvConfig | null;
  isLoadingEnv: boolean;
  envError: string | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  showClaudeToken: boolean;
  setShowClaudeToken: React.Dispatch<React.SetStateAction<boolean>>;
  showLinearKey: boolean;
  setShowLinearKey: React.Dispatch<React.SetStateAction<boolean>>;
  showOpenAIKey: boolean;
  setShowOpenAIKey: React.Dispatch<React.SetStateAction<boolean>>;
  showGitHubToken: boolean;
  setShowGitHubToken: React.Dispatch<React.SetStateAction<boolean>>;
  gitHubConnectionStatus: GitHubSyncStatus | null;
  isCheckingGitHub: boolean;
  isCheckingClaudeAuth: boolean;
  claudeAuthStatus: 'checking' | 'authenticated' | 'not_authenticated' | 'error';
  linearConnectionStatus: LinearSyncStatus | null;
  isCheckingLinear: boolean;
  handleInitialize: () => Promise<void>;
  handleClaudeSetup: () => Promise<void>;
  onOpenLinearImport: () => void;
}

/**
 * Routes to the appropriate settings section based on activeSection.
 * Handles initialization guards and section-specific configurations.
 */
export function SectionRouter({
  activeSection,
  project,
  settings,
  setSettings,
  versionInfo,
  isCheckingVersion,
  isUpdating,
  envConfig,
  isLoadingEnv,
  envError,
  updateEnvConfig,
  showClaudeToken,
  setShowClaudeToken,
  showLinearKey,
  setShowLinearKey,
  showOpenAIKey,
  setShowOpenAIKey,
  showGitHubToken,
  setShowGitHubToken,
  gitHubConnectionStatus,
  isCheckingGitHub,
  isCheckingClaudeAuth,
  claudeAuthStatus,
  linearConnectionStatus,
  isCheckingLinear,
  handleInitialize,
  handleClaudeSetup,
  onOpenLinearImport
}: SectionRouterProps) {
  const { t } = useTranslation('settings');
  
  switch (activeSection) {
    case 'general':
      return (
        <SettingsSection
          title={t('projectSettings.general')}
          description={t('projectSettings.generalDescription', { projectName: project.name })}
        >
          <GeneralSettings
            project={project}
            settings={settings}
            setSettings={setSettings}
            versionInfo={versionInfo}
            isCheckingVersion={isCheckingVersion}
            isUpdating={isUpdating}
            handleInitialize={handleInitialize}
          />
        </SettingsSection>
      );

    case 'claude':
      return (
        <SettingsSection
          title={t('projectSections.claude.title')}
          description={t('projectSections.claude.description')}
        >
          <InitializationGuard
            initialized={!!project.autoBuildPath}
            title={t('projectSections.claude.guardTitle')}
            description={t('projectSections.claude.guardDescription')}
            initMessage={t('projectSections.claude.initMessage')}
          >
            <EnvironmentSettings
              envConfig={envConfig}
              isLoadingEnv={isLoadingEnv}
              envError={envError}
              updateEnvConfig={updateEnvConfig}
              isCheckingClaudeAuth={isCheckingClaudeAuth}
              claudeAuthStatus={claudeAuthStatus}
              handleClaudeSetup={handleClaudeSetup}
              showClaudeToken={showClaudeToken}
              setShowClaudeToken={setShowClaudeToken}
              expanded={true}
              onToggle={() => {}}
            />
          </InitializationGuard>
        </SettingsSection>
      );

    case 'linear':
      return (
        <SettingsSection
          title={t('projectSections.linear.title')}
          description={t('projectSections.linear.description')}
        >
          <InitializationGuard
            initialized={!!project.autoBuildPath}
            title={t('projectSections.linear.guardTitle')}
            description={t('projectSections.linear.guardDescription')}
            initMessage={t('projectSections.linear.initMessage')}
          >
            <LinearIntegration
              envConfig={envConfig}
              updateEnvConfig={updateEnvConfig}
              showLinearKey={showLinearKey}
              setShowLinearKey={setShowLinearKey}
              linearConnectionStatus={linearConnectionStatus}
              isCheckingLinear={isCheckingLinear}
              onOpenLinearImport={onOpenLinearImport}
            />
          </InitializationGuard>
        </SettingsSection>
      );

    case 'github':
      return (
        <SettingsSection
          title={t('projectSections.github.title')}
          description={t('projectSections.github.description')}
        >
          <InitializationGuard
            initialized={!!project.autoBuildPath}
            title={t('projectSections.github.guardTitle')}
            description={t('projectSections.github.guardDescription')}
            initMessage={t('projectSections.github.initMessage')}
          >
            <GitHubIntegration
              envConfig={envConfig}
              updateEnvConfig={updateEnvConfig}
              showGitHubToken={showGitHubToken}
              setShowGitHubToken={setShowGitHubToken}
              gitHubConnectionStatus={gitHubConnectionStatus}
              isCheckingGitHub={isCheckingGitHub}
              projectPath={project.path}
            />
          </InitializationGuard>
        </SettingsSection>
      );

    case 'memory':
      return (
        <SettingsSection
          title={t('projectSections.memory.title')}
          description={t('projectSections.memory.description')}
        >
          <InitializationGuard
            initialized={!!project.autoBuildPath}
            title={t('projectSections.memory.guardTitle')}
            description={t('projectSections.memory.guardDescription')}
            initMessage={t('projectSections.memory.initMessage')}
          >
            <SecuritySettings
              envConfig={envConfig}
              settings={settings}
              setSettings={setSettings}
              updateEnvConfig={updateEnvConfig}
              showOpenAIKey={showOpenAIKey}
              setShowOpenAIKey={setShowOpenAIKey}
              expanded={true}
              onToggle={() => {}}
            />
          </InitializationGuard>
        </SettingsSection>
      );

    default:
      return null;
  }
}
