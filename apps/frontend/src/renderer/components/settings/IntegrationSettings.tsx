import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Key,
  Eye,
  EyeOff,
  Info,
  Users,
  Plus,
  Trash2,
  Star,
  Check,
  Pencil,
  X,
  Loader2,
  LogIn,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Activity,
  AlertCircle,
  Globe
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { cn } from '../../lib/utils';
import { SettingsSection } from './SettingsSection';
import { loadClaudeProfiles as loadGlobalClaudeProfiles } from '../../stores/claude-profile-store';
import type { AppSettings, ClaudeProfile, ClaudeAutoSwitchSettings } from '../../../shared/types';

interface IntegrationSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  isOpen: boolean;
}

/**
 * Integration settings for Claude accounts and API keys
 */
export function IntegrationSettings({ settings, onSettingsChange, isOpen }: IntegrationSettingsProps) {
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');
  // Password visibility toggle for global API keys
  const [showGlobalOpenAIKey, setShowGlobalOpenAIKey] = useState(false);

  // Claude Accounts state
  const [claudeProfiles, setClaudeProfiles] = useState<ClaudeProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [authenticatingProfileId, setAuthenticatingProfileId] = useState<string | null>(null);
  const [expandedTokenProfileId, setExpandedTokenProfileId] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [manualTokenEmail, setManualTokenEmail] = useState('');
  const [showManualToken, setShowManualToken] = useState(false);
  const [savingTokenProfileId, setSavingTokenProfileId] = useState<string | null>(null);

  // Auto-swap settings state
  const [autoSwitchSettings, setAutoSwitchSettings] = useState<ClaudeAutoSwitchSettings | null>(null);
  const [isLoadingAutoSwitch, setIsLoadingAutoSwitch] = useState(false);

  // Proxy connection state
  const [isCheckingProxy, setIsCheckingProxy] = useState(false);
  const [proxyStatus, setProxyStatus] = useState<{
    claudeApi: { connected: boolean; message: string } | null;
    http: { connected: boolean; message: string } | null;
    https: { connected: boolean; message: string } | null;
  }>({ claudeApi: null, http: null, https: null });

  // Proxy server state
  const [proxyServerStatus, setProxyServerStatus] = useState<{
    running: boolean;
    url: string;
    port: number;
    host: string;
  } | null>(null);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [isStoppingServer, setIsStoppingServer] = useState(false);

  // Check if proxy is configured
  const isProxyConfigured = !!(settings.globalHttpProxy || settings.globalHttpsProxy || settings.globalAnthropicBaseUrl);
  const isProxyEnabled = settings.proxyEnabled !== false; // Default to true if undefined

  // Load Claude profiles and auto-swap settings when section is shown
  useEffect(() => {
    if (isOpen) {
      loadClaudeProfiles();
      loadAutoSwitchSettings();
      checkProxyServerStatus();
    }
  }, [isOpen]);

  // Listen for OAuth authentication completion
  useEffect(() => {
    const unsubscribe = window.electronAPI.onTerminalOAuthToken(async (info) => {
      if (info.success && info.profileId) {
        // Reload profiles to show updated state
        await loadClaudeProfiles();
        // Show simple success notification
        const accountInfo = info.email ? `${t('integrations.errors.account')} ${info.email}` : t('integrations.errors.authComplete');
        alert(`✅ ${t('integrations.errors.profileAuthSuccess')}\n\n${accountInfo}\n\n${t('integrations.errors.canUseProfile')}`);
      }
    });

    return unsubscribe;
  }, []);

  const loadClaudeProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const result = await window.electronAPI.getClaudeProfiles();
      if (result.success && result.data) {
        setClaudeProfiles(result.data.profiles);
        setActiveProfileId(result.data.activeProfileId);
        // Also update the global store
        await loadGlobalClaudeProfiles();
      }
    } catch (err) {
      console.error('Failed to load Claude profiles:', err);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const handleAddProfile = async () => {
    if (!newProfileName.trim()) return;

    setIsAddingProfile(true);
    try {
      const profileName = newProfileName.trim();
      const profileSlug = profileName.toLowerCase().replace(/\s+/g, '-');

      const result = await window.electronAPI.saveClaudeProfile({
        id: `profile-${Date.now()}`,
        name: profileName,
        configDir: `~/.claude-profiles/${profileSlug}`,
        isDefault: false,
        createdAt: new Date()
      });

      if (result.success && result.data) {
        // Initialize the profile
        const initResult = await window.electronAPI.initializeClaudeProfile(result.data.id);

        if (initResult.success) {
          await loadClaudeProfiles();
          setNewProfileName('');

          alert(
            `${t('integrations.errors.authenticatingNamed', { name: profileName })}\n\n` +
            `${t('integrations.errors.browserWillOpen')}\n\n` +
            `${t('integrations.errors.authSavedAuto')}`
          );
        } else {
          await loadClaudeProfiles();
          alert(`${t('integrations.errors.authFailedStart')} ${initResult.error || t('integrations.errors.tryAgain')}`);
        }
      }
    } catch (err) {
      console.error('Failed to add profile:', err);
      alert(t('integrations.errors.profileAddFailed'));
    } finally {
      setIsAddingProfile(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    setDeletingProfileId(profileId);
    try {
      const result = await window.electronAPI.deleteClaudeProfile(profileId);
      if (result.success) {
        await loadClaudeProfiles();
      }
    } catch (err) {
      console.error('Failed to delete profile:', err);
    } finally {
      setDeletingProfileId(null);
    }
  };

  const startEditingProfile = (profile: ClaudeProfile) => {
    setEditingProfileId(profile.id);
    setEditingProfileName(profile.name);
  };

  const cancelEditingProfile = () => {
    setEditingProfileId(null);
    setEditingProfileName('');
  };

  const handleRenameProfile = async () => {
    if (!editingProfileId || !editingProfileName.trim()) return;

    try {
      const result = await window.electronAPI.renameClaudeProfile(editingProfileId, editingProfileName.trim());
      if (result.success) {
        await loadClaudeProfiles();
      }
    } catch (err) {
      console.error('Failed to rename profile:', err);
    } finally {
      setEditingProfileId(null);
      setEditingProfileName('');
    }
  };

  const handleSetActiveProfile = async (profileId: string) => {
    try {
      const result = await window.electronAPI.setActiveClaudeProfile(profileId);
      if (result.success) {
        setActiveProfileId(profileId);
        await loadGlobalClaudeProfiles();
      }
    } catch (err) {
      console.error('Failed to set active profile:', err);
    }
  };

  const handleAuthenticateProfile = async (profileId: string) => {
    setAuthenticatingProfileId(profileId);
    try {
      const initResult = await window.electronAPI.initializeClaudeProfile(profileId);
      if (initResult.success) {
        alert(
          `${t('integrations.errors.authenticatingProfile')}\n\n` +
          `${t('integrations.errors.browserWillOpen')}\n\n` +
          `${t('integrations.errors.authSavedAuto')}`
        );
      } else {
        alert(`${t('integrations.errors.authFailedStart')} ${initResult.error || t('integrations.errors.tryAgain')}`);
      }
    } catch (err) {
      console.error('Failed to authenticate profile:', err);
      alert(t('integrations.errors.authFailed'));
    } finally {
      setAuthenticatingProfileId(null);
    }
  };

  const toggleTokenEntry = (profileId: string) => {
    if (expandedTokenProfileId === profileId) {
      setExpandedTokenProfileId(null);
      setManualToken('');
      setManualTokenEmail('');
      setShowManualToken(false);
    } else {
      setExpandedTokenProfileId(profileId);
      setManualToken('');
      setManualTokenEmail('');
      setShowManualToken(false);
    }
  };

  const handleSaveManualToken = async (profileId: string) => {
    if (!manualToken.trim()) return;

    setSavingTokenProfileId(profileId);
    try {
      const result = await window.electronAPI.setClaudeProfileToken(
        profileId,
        manualToken.trim(),
        manualTokenEmail.trim() || undefined
      );
      if (result.success) {
        await loadClaudeProfiles();
        setExpandedTokenProfileId(null);
        setManualToken('');
        setManualTokenEmail('');
        setShowManualToken(false);
      } else {
        alert(`${t('integrations.errors.tokenSaveFailed')} ${result.error || t('integrations.errors.tryAgain')}`);
      }
    } catch (err) {
      console.error('Failed to save token:', err);
      alert(t('integrations.errors.tokenSaveFailedGeneric'));
    } finally {
      setSavingTokenProfileId(null);
    }
  };

  // Load auto-swap settings
  const loadAutoSwitchSettings = async () => {
    setIsLoadingAutoSwitch(true);
    try {
      const result = await window.electronAPI.getAutoSwitchSettings();
      if (result.success && result.data) {
        setAutoSwitchSettings(result.data);
      }
    } catch (err) {
      console.error('Failed to load auto-switch settings:', err);
    } finally {
      setIsLoadingAutoSwitch(false);
    }
  };

  // Update auto-swap settings
  const handleUpdateAutoSwitch = async (updates: Partial<ClaudeAutoSwitchSettings>) => {
    setIsLoadingAutoSwitch(true);
    try {
      const result = await window.electronAPI.updateAutoSwitchSettings(updates);
      if (result.success) {
        await loadAutoSwitchSettings();
      } else {
        alert(`${t('integrations.errors.settingsUpdateFailed')} ${result.error || t('integrations.errors.tryAgain')}`);
      }
    } catch (err) {
      console.error('Failed to update auto-switch settings:', err);
      alert(t('integrations.errors.settingsUpdateFailedGeneric'));
    } finally {
      setIsLoadingAutoSwitch(false);
    }
  };

  // Proxy server management
  const checkProxyServerStatus = async () => {
    try {
      const response = await window.electronAPI.getProxyServerStatus();
      console.log('[IntegrationSettings] Proxy status response:', response);
      
      if (response && response.success && response.data) {
        setProxyServerStatus(response.data);
      } else {
        // Set default status if call failed
        setProxyServerStatus({
          running: false,
          url: 'http://localhost:8889',
          port: 8889,
          host: '127.0.0.1'
        });
      }
    } catch (err) {
      console.error('[IntegrationSettings] Failed to check proxy server status:', err);
      setProxyServerStatus({
        running: false,
        url: 'http://localhost:8889',
        port: 8889,
        host: '127.0.0.1'
      });
    }
  };

  const handleStartProxyServer = async () => {
    setIsStartingServer(true);
    try {
      const response = await window.electronAPI.startProxyServer();
      console.log('[IntegrationSettings] Proxy server start response:', response);
      
      if (response && response.success && response.data) {
        // Extract the actual result from response.data
        const serverResult = response.data;
        
        if (serverResult.success) {
          // Success - update status
          await checkProxyServerStatus();
          console.log('[IntegrationSettings] ✅ Proxy server started successfully');
        } else {
          // Server returned an error
          const errorMsg = serverResult.error || t('integrations.errors.proxyServerStartFailed');
          console.error('[IntegrationSettings] ❌ Proxy server failed:', errorMsg);
          alert(`❌ ${t('integrations.errors.proxyServerStartFailed')}\n\n${errorMsg}`);
        }
      } else {
        // IPC call failed
        const errorMsg = response?.error || t('integrations.errors.proxyServerStartFailed');
        console.error('[IntegrationSettings] ❌ IPC call failed:', errorMsg);
        alert(`❌ ${t('integrations.errors.proxyServerStartFailed')}\n\n${errorMsg}`);
      }
    } catch (err) {
      console.error('[IntegrationSettings] ❌ Exception:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`❌ ${t('integrations.errors.proxyServerStartFailed')}\n\n${errorMsg}`);
    } finally {
      setIsStartingServer(false);
    }
  };

  const handleStopProxyServer = async () => {
    setIsStoppingServer(true);
    try {
      await window.electronAPI.stopProxyServer();
      await checkProxyServerStatus();
    } catch (err) {
      console.error('Failed to stop proxy server:', err);
      alert(t('integrations.errors.proxyServerStopFailed'));
    } finally {
      setIsStoppingServer(false);
    }
  };

  // Check proxy connection
  const handleCheckProxyConnection = async () => {
    if (!isProxyEnabled) {
      return; // Don't test if disabled
    }

    setIsCheckingProxy(true);
    setProxyStatus({ claudeApi: null, http: null, https: null });

    try {
      const results: typeof proxyStatus = {
        claudeApi: null,
        http: null,
        https: null
      };

      // Check Claude API Proxy - try to actually connect through it
      if (settings.globalAnthropicBaseUrl) {
        try {
          const url = new URL(settings.globalAnthropicBaseUrl);
          // Try to reach Claude API through the proxy
          const testUrl = `${settings.globalAnthropicBaseUrl}/v1/messages`;
          const response = await fetch(testUrl, { 
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01',
              'x-api-key': 'test-key' // This will fail auth but prove connectivity
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'test' }]
            }),
            signal: AbortSignal.timeout(10000)
          });
          
          // 401 = proxy works, API key invalid (expected)
          // 2xx/4xx = proxy responding
          // Network error = proxy not working
          const isConnected = response.status === 401 || (response.status >= 200 && response.status < 500);
          results.claudeApi = {
        xxxxxxxxxcted: isConnected,
            message: isConnected
              ? response.status === 401 
                ? t('proxy.proxyWorking', `Proxy working! (Auth required)`)
                : t('proxy.connected', `Connected to ${url.host}`)
              : t('proxy.connectionFailed', `Connection failed: ${response.statusText}`)
          };
        } catch (err) {
          results.claudeApi = {
     xxxxxxxxxxxxcted: false,
            message: err instanceof Error 
              ? t('proxy.connectionFailed', `Connection failed: ${err.message}`)
              : t('proxy.connectionFailedGeneric', 'Connection failed')
          };
        }
      }

      // Check HTTP Proxy
      if (settings.globalHttpProxy) {
        try {
          const url = new URL(settings.globalHttpProxy);
          results.http = {
            connected: true,
            message: t('proxy.proxyConfigured', { host: url.host })
          };
        } catch (err) {
          results.http = {
            connected: false,
            message: t('proxy.invalidUrl', 'Invalid URL format')
          };
        }
      }

      // Check HTTPS Proxy
      if (settings.globalHttpsProxy) {
        try {
          const url = new URL(settings.globalHttpsProxy);
          results.https = {
            connected: true,
            message: t('proxy.proxyConfigured', { host: url.host })
          };
        } catch (err) {
          results.https = {
            connected: false,
            message: t('proxy.invalidUrl', 'Invalid URL format')
          };
        }
      }

      setProxyStatus(results);
    } catch (err) {
      console.error('Failed to check proxy:', err);
    } finally {
      setIsCheckingProxy(false);
    }
  };

  return (
    <SettingsSection
      title={t('integrations.title')}
      description={t('integrations.description')}
    >
      <div className="space-y-6">
        {/* Claude Accounts Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-foreground">{t('integrations.claudeAccounts')}</h4>
          </div>

          <div className="rounded-lg bg-muted/30 border border-border p-4">
            <p className="text-sm text-muted-foreground mb-4">
              {t('integrations.claudeAccountsDescription')}
            </p>

            {/* Accounts list */}
            {isLoadingProfiles ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : claudeProfiles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center mb-4">
                <p className="text-sm text-muted-foreground">{t('integrations.noAccountsYet')}</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {claudeProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className={cn(
                      "rounded-lg border transition-colors",
                      profile.id === activeProfileId
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-between p-3",
                      expandedTokenProfileId !== profile.id && "hover:bg-muted/50"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                          profile.id === activeProfileId
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {(editingProfileId === profile.id ? editingProfileName : profile.name).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          {editingProfileId === profile.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editingProfileName}
                                onChange={(e) => setEditingProfileName(e.target.value)}
                                className="h-7 text-sm w-40"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameProfile();
                                  if (e.key === 'Escape') cancelEditingProfile();
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleRenameProfile}
                                className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={cancelEditingProfile}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">{profile.name}</span>
                                {profile.isDefault && (
                                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{t('integrations.default')}</span>
                                )}
                                {profile.id === activeProfileId && (
                                  <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Star className="h-3 w-3" />
                                    {t('integrations.active')}
                                  </span>
                                )}
                                {(profile.oauthToken || (profile.isDefault && profile.configDir)) ? (
                                  <span className="text-xs bg-success/20 text-success px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Check className="h-3 w-3" />
                                    {t('integrations.authenticated')}
                                  </span>
                                ) : (
                                  <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">
                                    {t('integrations.needsAuth')}
                                  </span>
                                )}
                              </div>
                              {profile.email && (
                                <span className="text-xs text-muted-foreground">{profile.email}</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {editingProfileId !== profile.id && (
                        <div className="flex items-center gap-1">
                          {/* Authenticate button - show only if NOT authenticated */}
                          {/* A profile is authenticated if: has OAuth token OR (is default AND has configDir) */}
                          {!(profile.oauthToken || (profile.isDefault && profile.configDir)) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAuthenticateProfile(profile.id)}
                              disabled={authenticatingProfileId === profile.id}
                              className="gap-1 h-7 text-xs"
                            >
                              {authenticatingProfileId === profile.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <LogIn className="h-3 w-3" />
                              )}
                              {t('integrations.authenticate')}
                            </Button>
                          ) : (
                            /* Re-authenticate button for already authenticated profiles */
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAuthenticateProfile(profile.id)}
                              disabled={authenticatingProfileId === profile.id}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title={t('integrations.tooltips.reauth')}
                            >
                              {authenticatingProfileId === profile.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                          {profile.id !== activeProfileId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetActiveProfile(profile.id)}
                              className="gap-1 h-7 text-xs"
                            >
                              <Check className="h-3 w-3" />
                              {t('integrations.setActive')}
                            </Button>
                          )}
                          {/* Toggle token entry button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleTokenEntry(profile.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title={expandedTokenProfileId === profile.id ? t('integrations.tooltips.hideTokenEntry') : t('integrations.tooltips.enterTokenManually')}
                          >
                            {expandedTokenProfileId === profile.id ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEditingProfile(profile)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title={t('integrations.tooltips.renameProfile')}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {!profile.isDefault && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteProfile(profile.id)}
                              disabled={deletingProfileId === profile.id}
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title={t('integrations.tooltips.deleteProfile')}
                            >
                              {deletingProfileId === profile.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expanded token entry section */}
                    {expandedTokenProfileId === profile.id && (
                      <div className="px-3 pb-3 pt-0 border-t border-border/50 mt-0">
                        <div className="bg-muted/30 rounded-lg p-3 mt-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-muted-foreground">
                              {t('integrations.manualTokenEntry')}
                            </Label>
                            <span className="text-xs text-muted-foreground">
                              {t('integrations.runSetupToken')}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="relative">
                              <Input
                                type={showManualToken ? 'text' : 'password'}
                                placeholder={t('integrations.tokenPlaceholder')}
                                value={manualToken}
                                onChange={(e) => setManualToken(e.target.value)}
                                className="pr-10 font-mono text-xs h-8"
                              />
                              <button
                                type="button"
                                onClick={() => setShowManualToken(!showManualToken)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showManualToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                            </div>

                            <Input
                              type="email"
                              placeholder={t('integrations.emailPlaceholder')}
                              value={manualTokenEmail}
                              onChange={(e) => setManualTokenEmail(e.target.value)}
                              className="text-xs h-8"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleTokenEntry(profile.id)}
                              className="h-7 text-xs"
                            >
                              {tCommon('buttons.cancel')}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveManualToken(profile.id)}
                              disabled={!manualToken.trim() || savingTokenProfileId === profile.id}
                              className="h-7 text-xs gap-1"
                            >
                              {savingTokenProfileId === profile.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              {t('integrations.saveToken')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add new account */}
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('integrations.accountNamePlaceholder')}
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="flex-1 h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProfileName.trim()) {
                    handleAddProfile();
                  }
                }}
              />
              <Button
                onClick={handleAddProfile}
                disabled={!newProfileName.trim() || isAddingProfile}
                size="sm"
                className="gap-1 shrink-0"
              >
                {isAddingProfile ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                {tCommon('buttons.add')}
              </Button>
            </div>
          </div>
        </div>

        {/* Auto-Switch Settings Section */}
        {claudeProfiles.length > 1 && (
          <div className="space-y-4 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">{t('integrations.autoSwitching')}</h4>
            </div>

            <div className="rounded-lg bg-muted/30 border border-border p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('integrations.autoSwitchingDescription')}
              </p>

              {/* Master toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">{t('integrations.enableAutoSwitching')}</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('integrations.masterSwitch')}
                  </p>
                </div>
                <Switch
                  checked={autoSwitchSettings?.enabled ?? false}
                  onCheckedChange={(enabled) => handleUpdateAutoSwitch({ enabled })}
                  disabled={isLoadingAutoSwitch}
                />
              </div>

              {autoSwitchSettings?.enabled && (
                <>
                  {/* Proactive Monitoring Section */}
                  <div className="pl-6 space-y-4 pt-2 border-l-2 border-primary/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5" />
                          {t('integrations.proactiveMonitoring')}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('integrations.proactiveDescription')}
                        </p>
                      </div>
                      <Switch
                        checked={autoSwitchSettings?.proactiveSwapEnabled ?? true}
                        onCheckedChange={(value) => handleUpdateAutoSwitch({ proactiveSwapEnabled: value })}
                        disabled={isLoadingAutoSwitch}
                      />
                    </div>

                    {autoSwitchSettings?.proactiveSwapEnabled && (
                      <>
                        {/* Check interval */}
                        <div className="space-y-2">
                          <Label className="text-sm">{t('integrations.checkUsageEvery')}</Label>
                          <select
                            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
                            value={autoSwitchSettings?.usageCheckInterval ?? 30000}
                            onChange={(e) => handleUpdateAutoSwitch({ usageCheckInterval: parseInt(e.target.value) })}
                            disabled={isLoadingAutoSwitch}
                          >
                            <option value={15000}>{t('integrations.seconds15')}</option>
                            <option value={30000}>{t('integrations.seconds30')}</option>
                            <option value={60000}>{t('integrations.minute1')}</option>
                            <option value={0}>{t('integrations.disabled')}</option>
                          </select>
                        </div>

                        {/* Session threshold */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">{t('integrations.sessionThreshold')}</Label>
                            <span className="text-sm font-mono">{autoSwitchSettings?.sessionThreshold ?? 95}%</span>
                          </div>
                          <input
                            type="range"
                            min="70"
                            max="99"
                            step="1"
                            value={autoSwitchSettings?.sessionThreshold ?? 95}
                            onChange={(e) => handleUpdateAutoSwitch({ sessionThreshold: parseInt(e.target.value) })}
                            disabled={isLoadingAutoSwitch}
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground">
                            {t('integrations.sessionThresholdDescription')}
                          </p>
                        </div>

                        {/* Weekly threshold */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">{t('integrations.weeklyThreshold')}</Label>
                            <span className="text-sm font-mono">{autoSwitchSettings?.weeklyThreshold ?? 99}%</span>
                          </div>
                          <input
                            type="range"
                            min="70"
                            max="99"
                            step="1"
                            value={autoSwitchSettings?.weeklyThreshold ?? 99}
                            onChange={(e) => handleUpdateAutoSwitch({ weeklyThreshold: parseInt(e.target.value) })}
                            disabled={isLoadingAutoSwitch}
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground">
                            {t('integrations.weeklyThresholdDescription')}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Reactive Recovery Section */}
                  <div className="pl-6 space-y-4 pt-2 border-l-2 border-orange-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {t('integrations.reactiveRecovery')}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('integrations.reactiveDescription')}
                        </p>
                      </div>
                      <Switch
                        checked={autoSwitchSettings?.autoSwitchOnRateLimit ?? false}
                        onCheckedChange={(value) => handleUpdateAutoSwitch({ autoSwitchOnRateLimit: value })}
                        disabled={isLoadingAutoSwitch}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* API Keys Section */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-foreground">{t('integrations.apiKeys')}</h4>
          </div>

          <div className="rounded-lg bg-info/10 border border-info/30 p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {t('integrations.apiKeysInfo')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="globalOpenAIKey" className="text-sm font-medium text-foreground">
                {t('integrations.openaiKey')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('integrations.openaiKeyDescription')}
              </p>
              <div className="relative max-w-lg">
                <Input
                  id="globalOpenAIKey"
                  type={showGlobalOpenAIKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={settings.globalOpenAIApiKey || ''}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, globalOpenAIApiKey: e.target.value || undefined })
                  }
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowGlobalOpenAIKey(!showGlobalOpenAIKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showGlobalOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Proxy Settings - styled like GitHub Integration */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">{t('proxy.title')}</h4>
              {isProxyConfigured && (
                <span className={cn(
                  "px-2 py-0.5 text-xs rounded-full",
                  isProxyEnabled 
                    ? "bg-success/10 text-success" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {isProxyEnabled ? t('proxy.enabled') : t('proxy.disabled', 'Disabled')}
                </span>
              )}
            </div>
            {isProxyConfigured && (
              <Switch
                checked={isProxyEnabled}
                onCheckedChange={(checked: boolean) => 
                  onSettingsChange({ ...settings, proxyEnabled: checked })
                }
              />
            )}
          </div>

          <div className="rounded-lg bg-info/10 border border-info/30 p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {t('proxy.globalDescription')}
              </p>
            </div>
          </div>

          {/* Proxy Sections */}
          <div className="space-y-6">
            {/* Claude API Proxy (Primary) */}
            <div className="space-y-3 p-4 rounded-lg border border-warning/20 bg-warning/5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-warning" />
                <Label htmlFor="globalAnthropicBaseUrl" className="text-sm font-medium text-foreground">
                  {t('proxy.claudeApiProxy')} <span className="text-warning">★</span>
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('proxy.claudeApiProxyHelp')}
              </p>
              <Input
                id="globalAnthropicBaseUrl"
                type="text"
                placeholder="http://localhost:8889"
                value={settings.globalAnthropicBaseUrl || ''}
                onChange={(e) =>
                  onSettingsChange({ ...settings, globalAnthropicBaseUrl: e.target.value || undefined })
                }
                className="font-mono text-sm"
              />
              {settings.globalAnthropicBaseUrl && (
                <div className="rounded-md bg-success/10 border border-success/30 p-2">
                  <div className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                    <p className="text-xs text-success">
                      {t('proxy.proxyForBackendHelp')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* HTTP/HTTPS Proxies (Secondary) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-sm font-medium text-foreground">
                  {t('proxy.proxyForElectron')}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {t('proxy.proxyForElectronHelp')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="globalHttpProxy" className="text-xs font-medium text-muted-foreground">
                    {t('proxy.httpProxy')}
                  </Label>
                  <Input
                    id="globalHttpProxy"
                    type="text"
                    placeholder="http://localhost:8888"
                    value={settings.globalHttpProxy || ''}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, globalHttpProxy: e.target.value || undefined })
                    }
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="globalHttpsProxy" className="text-xs font-medium text-muted-foreground">
                    {t('proxy.httpsProxy')}
                  </Label>
                  <Input
                    id="globalHttpsProxy"
                    type="text"
                    placeholder="http://localhost:8888"
                    value={settings.globalHttpsProxy || ''}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, globalHttpsProxy: e.target.value || undefined })
                    }
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* No Proxy List */}
            <div className="space-y-2">
              <Label htmlFor="globalNoProxy" className="text-sm font-medium text-foreground">
                {t('proxy.noProxy')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('proxy.noProxyHelp')}
              </p>
              <Input
                id="globalNoProxy"
                type="text"
                placeholder="localhost,127.0.0.1,.local"
                value={settings.globalNoProxy || ''}
                onChange={(e) =>
                  onSettingsChange({ ...settings, globalNoProxy: e.target.value || undefined })
                }
                className="font-mono text-sm"
              />
            </div>

            {/* Test Connection Button */}
            {(settings.globalHttpProxy || settings.globalHttpsProxy || settings.globalAnthropicBaseUrl) && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckProxyConnection}
                  disabled={isCheckingProxy}
                  className="gap-2"
                >
                  {isCheckingProxy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t('proxy.checking', 'Checking...')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      {t('proxy.testConnection', 'Test Connection')}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Proxy Server Control */}
            <div className="border-t pt-4 space-y-4">
              {/* Status Header with Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Label className="text-sm font-medium text-foreground">
                      {t('proxy.localProxyServer', 'שרת Proxy מקומי')}
                    </Label>
                    {/* Always show status badge */}
                    <div className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1",
                      proxyServerStatus?.running 
                        ? "bg-success/20 text-success border border-success/30" 
                        : "bg-muted text-muted-foreground border border-border"
                    )}>
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        proxyServerStatus?.running ? "bg-success animate-pulse" : "bg-muted-foreground"
                      )} />
                      {proxyServerStatus?.running ? '🟢 Running' : '⚫ Stopped'}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('proxy.localProxyServerHelp', 'הפעל שרת proxy מקומי לניתוב בקשות Claude API')}
                  </p>
                </div>
              </div>
              
              {/* Server URL Display - Only when running */}
              {proxyServerStatus?.running && (
                <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-lg border border-success/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-success">
                    <Activity className="h-3.5 w-3.5 animate-pulse" />
                    {t('proxy.serverActive', 'שרת פעיל')}
                  </div>
                  <div className="bg-background/50 rounded-md p-2 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('proxy.serverUrl', 'URL של השרת')}:
                    </p>
                    <code className="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded block">
                      {proxyServerStatus.url}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 {t('proxy.serverUrlHelp', 'השתמש ב-URL זה כ-Anthropic Base URL למעלה')}
                  </p>
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex gap-2">
                {!proxyServerStatus?.running ? (
                  <Button
                    variant="default"
                    size="default"
                    onClick={handleStartProxyServer}
                    disabled={isStartingServer}
                    className="gap-2 w-full bg-success hover:bg-success/90"
                  >
                    {isStartingServer ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('proxy.starting', 'מפעיל...')}
                      </>
                    ) : (
                      <>
                        <Activity className="h-4 w-4" />
                        {t('proxy.startServer', '▶️ הפעל שרת')}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="default"
                    onClick={handleStopProxyServer}
                    disabled={isStoppingServer}
                    className="gap-2 w-full"
                  >
                    {isStoppingServer ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('proxy.stopping', 'עוצר...')}
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4" />
                        {t('proxy.stopServer', '⏹️ עצור שרת')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Connection Status */}
            {(proxyStatus.claudeApi || proxyStatus.http || proxyStatus.https) && (
              <div className="space-y-2">
                {proxyStatus.claudeApi && (
                  <div className={cn(
                    "rounded-lg border p-3",
                    proxyStatus.claudeApi.connected
                      ? "bg-success/10 border-success/30"
                      : "bg-destructive/10 border-destructive/30"
                  )}>
                    <div className="flex items-start gap-2">
                      {proxyStatus.claudeApi.connected ? (
                        <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-xs font-medium">
                          {t('proxy.claudeApiProxyLabel')}
                        </p>
                        <p className={cn(
                          "text-xs mt-0.5",
                          proxyStatus.claudeApi.connected ? "text-success" : "text-destructive"
                        )}>
                          {proxyStatus.claudeApi.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {proxyStatus.http && (
                  <div className={cn(
                    "rounded-lg border p-2",
                    proxyStatus.http.connected
                      ? "bg-success/10 border-success/30"
                      : "bg-destructive/10 border-destructive/30"
                  )}>
                    <div className="flex items-center gap-2">
                      {proxyStatus.http.connected ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <p className="text-xs font-medium">{t('proxy.httpProxy')}:</p>
                      <p className={cn(
                        "text-xs",
                        proxyStatus.http.connected ? "text-success" : "text-destructive"
                      )}>
                        {proxyStatus.http.message}
                      </p>
                    </div>
                  </div>
                )}

                {proxyStatus.https && (
                  <div className={cn(
                    "rounded-lg border p-2",
                    proxyStatus.https.connected
                      ? "bg-success/10 border-success/30"
                      : "bg-destructive/10 border-destructive/30"
                  )}>
                    <div className="flex items-center gap-2">
                      {proxyStatus.https.connected ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <p className="text-xs font-medium">{t('proxy.httpsProxy')}:</p>
                      <p className={cn(
                        "text-xs",
                        proxyStatus.https.connected ? "text-success" : "text-destructive"
                      )}>
                        {proxyStatus.https.message}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Success Banner */}
            {(settings.globalHttpProxy || settings.globalHttpsProxy || settings.globalAnthropicBaseUrl) && (
              <div className="rounded-lg bg-success/10 border border-success/30 p-3">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-success">{t('proxy.proxySuccess')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('proxy.restartNote')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
