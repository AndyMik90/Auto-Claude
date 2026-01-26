import { Key, ExternalLink, Loader2, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CollapsibleSection } from './CollapsibleSection';
import { StatusBadge } from './StatusBadge';
import { PasswordInput } from './PasswordInput';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import type { ProjectEnvConfig } from '../../../shared/types';

interface ClaudeAuthSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  envConfig: ProjectEnvConfig | null;
  isLoadingEnv: boolean;
  envError: string | null;
  isCheckingAuth: boolean;
  authStatus: 'checking' | 'authenticated' | 'not_authenticated' | 'error';
  onClaudeSetup: () => void;
  onUpdateConfig: (updates: Partial<ProjectEnvConfig>) => void;
}

export function ClaudeAuthSection({
  isExpanded,
  onToggle,
  envConfig,
  isLoadingEnv,
  envError,
  isCheckingAuth,
  authStatus,
  onClaudeSetup,
  onUpdateConfig,
}: ClaudeAuthSectionProps) {
  const { t } = useTranslation(['settings']);
  const badge = authStatus === 'authenticated' ? (
    <StatusBadge status="success" label={t('projectSections.claude.connected')} />
  ) : authStatus === 'not_authenticated' ? (
    <StatusBadge status="warning" label={t('projectSections.claude.notConnected')} />
  ) : null;

  return (
    <CollapsibleSection
      title={t('projectSections.claude.claudeAuthentication')}
      icon={<Key className="h-4 w-4" />}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={badge}
    >
      {isLoadingEnv ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('projectSections.claude.loadingConfiguration')}
        </div>
      ) : envConfig ? (
        <>
          {/* Claude CLI Status */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t('projectSections.claude.claudeCLI')}</p>
                <p className="text-xs text-muted-foreground">
                  {isCheckingAuth ? t('projectSections.claude.checking') :
                    authStatus === 'authenticated' ? t('projectSections.claude.authenticatedViaOAuth') :
                    authStatus === 'not_authenticated' ? t('projectSections.claude.notAuthenticated') :
                    t('projectSections.claude.statusUnknown')}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={onClaudeSetup}
                disabled={isCheckingAuth}
              >
                {isCheckingAuth ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {authStatus === 'authenticated' ? t('projectSections.claude.reAuthenticate') : t('projectSections.claude.setupOAuth')}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Manual OAuth Token */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">
                {envConfig.claudeTokenIsGlobal ? t('projectSections.claude.oauthTokenOverride') : t('projectSections.claude.oauthToken')}
              </Label>
              {envConfig.claudeTokenIsGlobal && (
                <span className="flex items-center gap-1 text-xs text-info">
                  <Globe className="h-3 w-3" />
                  {t('projectSections.claude.usingGlobalToken')}
                </span>
              )}
            </div>
            {envConfig.claudeTokenIsGlobal ? (
              <p className="text-xs text-muted-foreground">
                {t('projectSections.claude.usingGlobalTokenDescription')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('projectSections.claude.pasteTokenFrom')} <code className="px-1 bg-muted rounded">claude setup-token</code>
              </p>
            )}
            <PasswordInput
              value={envConfig.claudeTokenIsGlobal ? '' : (envConfig.claudeOAuthToken || '')}
              onChange={(value) => onUpdateConfig({
                claudeOAuthToken: value || undefined,
              })}
              placeholder={envConfig.claudeTokenIsGlobal ? 'Enter to override global token...' : 'your-oauth-token-here'}
            />
          </div>
        </>
      ) : envError ? (
        <p className="text-sm text-destructive">{envError}</p>
      ) : null}
    </CollapsibleSection>
  );
}
