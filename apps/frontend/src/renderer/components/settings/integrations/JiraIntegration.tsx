import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, ClipboardList, ExternalLink } from 'lucide-react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import type { ProjectEnvConfig } from '../../../../shared/types';
import { useSettingsStore } from '../../../stores/settings-store';

interface JiraIntegrationProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
}

/**
 * JIRA integration settings for per-project configuration.
 * Global JIRA credentials (host, email, token) are configured in Settings → Account → JIRA.
 * This component allows setting a project-specific JIRA project key.
 */
export function JiraIntegration({
  envConfig,
  updateEnvConfig
}: JiraIntegrationProps) {
  const { t } = useTranslation('settings');
  const settings = useSettingsStore((state) => state.settings);

  // Check if global JIRA is configured
  const isJiraConfigured = !!(
    settings?.globalJiraHost &&
    settings?.globalJiraEmail &&
    settings?.globalJiraToken
  );

  const globalDefaultProject = settings?.globalJiraDefaultProject;

  if (!envConfig) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* JIRA Configuration Status */}
      {isJiraConfigured ? (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-medium text-success">
                {t('projectSections.jira.configured')}
              </p>
              <p className="text-xs text-success/80 mt-0.5">
                {settings?.globalJiraHost}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {t('projectSections.jira.notConfigured')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('projectSections.jira.configureInGlobal')}
              </p>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // Navigate to global JIRA settings
                  window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: 'jira' }));
                }}
                className="text-xs text-info hover:underline flex items-center gap-1 mt-2"
              >
                {t('projectSections.jira.goToSettings')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Project Key Override */}
      {isJiraConfigured && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium text-foreground">
              {t('projectSections.jira.projectKey')}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('projectSections.jira.projectKeyDescription')}
            {globalDefaultProject && (
              <span className="block mt-1">
                {t('projectSections.jira.globalDefault')}: <code className="px-1 bg-muted rounded">{globalDefaultProject}</code>
              </span>
            )}
          </p>
          <Input
            placeholder={globalDefaultProject || 'CAP'}
            value={envConfig.jiraProjectKey || ''}
            onChange={(e) => updateEnvConfig({ jiraProjectKey: e.target.value || undefined })}
          />
          {envConfig.jiraProjectKey && (
            <p className="text-xs text-success flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {t('projectSections.jira.overrideActive')}: <code className="px-1 bg-muted rounded">{envConfig.jiraProjectKey}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
