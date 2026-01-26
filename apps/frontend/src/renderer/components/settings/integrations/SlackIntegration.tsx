import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import type { ProjectEnvConfig } from '../../../../shared/types';

interface SlackIntegrationProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
}

/**
 * Slack integration settings component.
 * Manages Slack Webhook URL for build notifications.
 */
export function SlackIntegration({
  envConfig,
  updateEnvConfig,
}: SlackIntegrationProps) {
  const { t } = useTranslation('settings');
  const [showWebhookUrl, setShowWebhookUrl] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  if (!envConfig) return null;

  const handleTestNotification = async () => {
    if (!envConfig.slackWebhookUrl) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      // Send test notification via IPC (main process handles the fetch to avoid CSP issues)
      const result = await window.electronAPI.testSlackWebhook(envConfig.slackWebhookUrl);
      setTestResult(result.success ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  const isValidWebhookUrl = (url: string) => {
    return url.startsWith('https://hooks.slack.com/');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">{t('projectSections.slack.enableNotifications')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('projectSections.slack.enableNotificationsDescription')}
          </p>
        </div>
        <Switch
          checked={envConfig.slackEnabled}
          onCheckedChange={(checked) => updateEnvConfig({ slackEnabled: checked })}
        />
      </div>

      {envConfig.slackEnabled && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">{t('projectSections.slack.webhookUrl')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('projectSections.slack.webhookUrlDescription')}{' '}
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                {t('projectSections.slack.slackDocs')}
              </a>
            </p>
            <div className="relative">
              <Input
                type={showWebhookUrl ? 'text' : 'password'}
                placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
                value={envConfig.slackWebhookUrl || ''}
                onChange={(e) => {
                  updateEnvConfig({ slackWebhookUrl: e.target.value });
                  setTestResult(null);
                }}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowWebhookUrl(!showWebhookUrl)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showWebhookUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {envConfig.slackWebhookUrl && isValidWebhookUrl(envConfig.slackWebhookUrl) && (
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestNotification}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {t('projectSections.slack.sendTestNotification')}
              </Button>
              {testResult === 'success' && (
                <div className="flex items-center gap-1 text-success text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('projectSections.slack.testSuccess')}
                </div>
              )}
              {testResult === 'error' && (
                <div className="flex items-center gap-1 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {t('projectSections.slack.testError')}
                </div>
              )}
            </div>
          )}

          <NotificationEventsInfo />
        </>
      )}
    </div>
  );
}

function NotificationEventsInfo() {
  const { t } = useTranslation('settings');

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-sm font-medium text-foreground mb-2">
        {t('projectSections.slack.notificationEvents')}
      </p>
      <ul className="text-xs text-muted-foreground space-y-1">
        <li>• {t('projectSections.slack.eventBuildStarted')}</li>
        <li>• {t('projectSections.slack.eventBuildComplete')}</li>
        <li>• {t('projectSections.slack.eventQaApproved')}</li>
        <li>• {t('projectSections.slack.eventQaRejected')}</li>
        <li>• {t('projectSections.slack.eventTaskStuck')}</li>
        <li>• {t('projectSections.slack.eventPrCreated')}</li>
      </ul>
    </div>
  );
}
