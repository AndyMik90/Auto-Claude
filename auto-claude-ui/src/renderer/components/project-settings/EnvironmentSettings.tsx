import {
  Key,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Loader2,
  Globe
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { ProjectEnvConfig } from '../../../shared/types';

interface EnvironmentSettingsProps {
  envConfig: ProjectEnvConfig | null;
  isLoadingEnv: boolean;
  envError: string | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;

  // Claude auth state
  isCheckingClaudeAuth: boolean;
  claudeAuthStatus: 'checking' | 'authenticated' | 'not_authenticated' | 'error';
  handleClaudeSetup: () => Promise<void>;

  // Password visibility
  showClaudeToken: boolean;
  setShowClaudeToken: React.Dispatch<React.SetStateAction<boolean>>;

  // Collapsible section
  expanded: boolean;
  onToggle: () => void;
}

export function EnvironmentSettings({
  envConfig,
  isLoadingEnv,
  envError,
  updateEnvConfig,
  isCheckingClaudeAuth,
  claudeAuthStatus,
  handleClaudeSetup,
  showClaudeToken,
  setShowClaudeToken,
  expanded,
  onToggle
}: EnvironmentSettingsProps) {
  return (
    <section className="space-y-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-foreground/80"
      >
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4" />
          Claude Authentication
          {claudeAuthStatus === 'authenticated' && (
            <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
              Connected
            </span>
          )}
          {claudeAuthStatus === 'not_authenticated' && (
            <span className="px-2 py-0.5 text-xs bg-warning/10 text-warning rounded-full">
              Not Connected
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4 pl-6 pt-2">
          {isLoadingEnv ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading configuration...
            </div>
          ) : envConfig ? (
            <>
              {/* Claude CLI Status */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Claude CLI</p>
                    <p className="text-xs text-muted-foreground">
                      {isCheckingClaudeAuth ? 'Checking...' :
                        claudeAuthStatus === 'authenticated' ? 'Authenticated via OAuth' :
                        claudeAuthStatus === 'not_authenticated' ? 'Not authenticated' :
                        'Status unknown'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClaudeSetup}
                    disabled={isCheckingClaudeAuth}
                  >
                    {isCheckingClaudeAuth ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {claudeAuthStatus === 'authenticated' ? 'Re-authenticate' : 'Setup OAuth'}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Manual OAuth Token */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">
                    OAuth Token {envConfig.claudeTokenIsGlobal ? '(Override)' : ''}
                  </Label>
                  {envConfig.claudeTokenIsGlobal && (
                    <span className="flex items-center gap-1 text-xs text-info">
                      <Globe className="h-3 w-3" />
                      Using global token
                    </span>
                  )}
                </div>
                {envConfig.claudeTokenIsGlobal ? (
                  <p className="text-xs text-muted-foreground">
                    Using token from App Settings. Enter a project-specific token below to override.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Paste a token from <code className="px-1 bg-muted rounded">claude setup-token</code>
                  </p>
                )}
                <div className="relative">
                  <Input
                    type={showClaudeToken ? 'text' : 'password'}
                    placeholder={envConfig.claudeTokenIsGlobal ? 'Enter to override global token...' : 'your-oauth-token-here'}
                    value={envConfig.claudeTokenIsGlobal ? '' : (envConfig.claudeOAuthToken || '')}
                    onChange={(e) => updateEnvConfig({
                      claudeOAuthToken: e.target.value || undefined,
                    })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClaudeToken(!showClaudeToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showClaudeToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : envError ? (
            <p className="text-sm text-destructive">{envError}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
