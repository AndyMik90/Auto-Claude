import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch, ClipboardList } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SourceControlSettings } from './SourceControlSettings';
import { IssueTrackerSettings } from './IssueTrackerSettings';
import { SettingsSection } from '../SettingsSection';
import { InitializationGuard } from '../common/InitializationGuard';
import type {
  Project,
  ProjectSettings as ProjectSettingsType,
  ProjectEnvConfig,
  GitHubSyncStatus,
  GitLabSyncStatus,
  LinearSyncStatus
} from '../../../../shared/types';

type IntegrationsTab = 'source-control' | 'issue-tracker';

interface TabConfig {
  id: IntegrationsTab;
  icon: React.ElementType;
  labelKey: string;
}

const tabs: TabConfig[] = [
  { id: 'source-control', icon: GitBranch, labelKey: 'projectSections.integrations.tabs.sourceControl' },
  { id: 'issue-tracker', icon: ClipboardList, labelKey: 'projectSections.integrations.tabs.issueTracker' }
];

interface IntegrationsSectionProps {
  project: Project;
  settings: ProjectSettingsType;
  setSettings: React.Dispatch<React.SetStateAction<ProjectSettingsType>>;
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
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
  // Linear state
  showLinearKey: boolean;
  setShowLinearKey: React.Dispatch<React.SetStateAction<boolean>>;
  linearConnectionStatus: LinearSyncStatus | null;
  isCheckingLinear: boolean;
  // JIRA state (passed through for future use)
  showJiraToken?: boolean;
  setShowJiraToken?: React.Dispatch<React.SetStateAction<boolean>>;
  // Callbacks
  onOpenLinearImport: () => void;
}

/**
 * Consolidated integrations settings section with vertical tabs.
 * Organizes integrations into three categories:
 * 1. Source Control - GitHub/GitLab repository configuration
 * 2. Issue Tracker - JIRA/Linear/GitLab Issues
 * 3. MCP Servers - Agent MCP access toggles
 */
export function IntegrationsSection({
  project,
  settings,
  setSettings,
  envConfig,
  updateEnvConfig,
  showGitHubToken,
  setShowGitHubToken,
  gitHubConnectionStatus,
  isCheckingGitHub,
  showGitLabToken,
  setShowGitLabToken,
  gitLabConnectionStatus,
  isCheckingGitLab,
  showLinearKey,
  setShowLinearKey,
  linearConnectionStatus,
  isCheckingLinear,
  onOpenLinearImport
}: IntegrationsSectionProps) {
  const { t } = useTranslation('settings');
  const [activeTab, setActiveTab] = useState<IntegrationsTab>('source-control');

  return (
    <SettingsSection
      title={t('projectSections.integrations.title')}
      description={t('projectSections.integrations.description')}
    >
      <InitializationGuard
        initialized={!!project.autoBuildPath}
        title={t('projectSections.integrations.title')}
        description={t('projectSections.integrations.description')}
      >
        <div className="flex gap-6">
          {/* Vertical Tab Navigation */}
          <nav className="flex flex-col gap-1 min-w-[180px] border-r border-border pr-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </nav>

          {/* Tab Content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'source-control' && (
              <SourceControlSettings
                envConfig={envConfig}
                updateEnvConfig={updateEnvConfig}
                settings={settings}
                setSettings={setSettings}
                projectPath={project.path}
                // GitHub props
                showGitHubToken={showGitHubToken}
                setShowGitHubToken={setShowGitHubToken}
                gitHubConnectionStatus={gitHubConnectionStatus}
                isCheckingGitHub={isCheckingGitHub}
                // GitLab props
                showGitLabToken={showGitLabToken}
                setShowGitLabToken={setShowGitLabToken}
                gitLabConnectionStatus={gitLabConnectionStatus}
                isCheckingGitLab={isCheckingGitLab}
              />
            )}

            {activeTab === 'issue-tracker' && (
              <IssueTrackerSettings
                envConfig={envConfig}
                updateEnvConfig={updateEnvConfig}
                // Linear props
                showLinearKey={showLinearKey}
                setShowLinearKey={setShowLinearKey}
                linearConnectionStatus={linearConnectionStatus}
                isCheckingLinear={isCheckingLinear}
                onOpenLinearImport={onOpenLinearImport}
                // GitLab Issues (uses same connection status as source control)
                gitLabConnectionStatus={gitLabConnectionStatus}
                isCheckingGitLab={isCheckingGitLab}
              />
            )}
          </div>
        </div>
      </InitializationGuard>
    </SettingsSection>
  );
}
