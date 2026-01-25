import { useState } from 'react';
import { MessageCircle, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Bell, BellOff } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Separator } from '../../ui/separator';
import type { ProjectEnvConfig } from '../../../../shared/types';

interface TelegramIntegrationProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
}

interface TelegramConnectionStatus {
  connected: boolean;
  botUsername?: string;
  error?: string;
}

/**
 * Telegram integration settings component.
 * Manages Telegram bot token, chat ID, and notification preferences.
 */
export function TelegramIntegration({
  envConfig,
  updateEnvConfig,
}: TelegramIntegrationProps) {
  const [showBotToken, setShowBotToken] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<TelegramConnectionStatus | null>(null);

  if (!envConfig) return null;

  const testConnection = async () => {
    if (!envConfig.telegramBotToken) return;

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      // Test the bot token by calling getMe
      const response = await fetch(
        `https://api.telegram.org/bot${envConfig.telegramBotToken}/getMe`
      );
      const data = await response.json();

      if (data.ok && data.result) {
        setConnectionStatus({
          connected: true,
          botUsername: data.result.username,
        });
      } else {
        setConnectionStatus({
          connected: false,
          error: data.description || 'Invalid bot token',
        });
      }
    } catch (error) {
      setConnectionStatus({
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-info" />
            <Label className="font-normal text-foreground">Enable Telegram Notifications</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Get notified about task status changes via Telegram
          </p>
        </div>
        <Switch
          checked={envConfig.telegramEnabled}
          onCheckedChange={(checked) => updateEnvConfig({ telegramEnabled: checked })}
        />
      </div>

      {envConfig.telegramEnabled && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Bot Token</Label>
            <p className="text-xs text-muted-foreground">
              Create a bot via{' '}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                @BotFather
              </a>{' '}
              on Telegram
            </p>
            <div className="relative">
              <Input
                type={showBotToken ? 'text' : 'password'}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={envConfig.telegramBotToken || ''}
                onChange={(e) => {
                  updateEnvConfig({ telegramBotToken: e.target.value });
                  setConnectionStatus(null);
                }}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowBotToken(!showBotToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showBotToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Chat ID</Label>
            <p className="text-xs text-muted-foreground">
              Your Telegram user ID or group chat ID. Use{' '}
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                @userinfobot
              </a>{' '}
              to find your ID
            </p>
            <Input
              type="text"
              placeholder="-1001234567890"
              value={envConfig.telegramChatId || ''}
              onChange={(e) => updateEnvConfig({ telegramChatId: e.target.value })}
            />
          </div>

          {envConfig.telegramBotToken && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>

              {connectionStatus && (
                <div className="flex items-center gap-2 text-sm">
                  {connectionStatus.connected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-success">
                        Connected as @{connectionStatus.botUsername}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-destructive">{connectionStatus.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">Notification Preferences</Label>

            <NotificationToggle
              icon={Bell}
              label="Task Started"
              description="Notify when a task begins execution"
              checked={envConfig.telegramNotifyOnStart ?? true}
              onCheckedChange={(checked) => updateEnvConfig({ telegramNotifyOnStart: checked })}
            />

            <NotificationToggle
              icon={CheckCircle2}
              label="Task Completed"
              description="Notify when a task completes successfully"
              checked={envConfig.telegramNotifyOnComplete ?? true}
              onCheckedChange={(checked) => updateEnvConfig({ telegramNotifyOnComplete: checked })}
            />

            <NotificationToggle
              icon={AlertCircle}
              label="Task Failed"
              description="Notify when a task fails or encounters errors"
              checked={envConfig.telegramNotifyOnFail ?? true}
              onCheckedChange={(checked) => updateEnvConfig({ telegramNotifyOnFail: checked })}
            />

            <NotificationToggle
              icon={Eye}
              label="Human Review Needed"
              description="Notify when a task requires human review"
              checked={envConfig.telegramNotifyOnReview ?? true}
              onCheckedChange={(checked) => updateEnvConfig({ telegramNotifyOnReview: checked })}
            />
          </div>
        </>
      )}
    </div>
  );
}

interface NotificationToggleProps {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function NotificationToggle({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: NotificationToggleProps) {
  return (
    <div className="flex items-center justify-between pl-2">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="font-normal text-sm text-foreground">{label}</Label>
        </div>
        <p className="text-xs text-muted-foreground pl-5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
