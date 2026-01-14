import { useState } from 'react';
import {
  Database,
  RefreshCw,
  Bell,
  Shield,
  Globe,
  Check,
  ExternalLink,
} from 'lucide-react';

interface SettingsProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: Date | null;
}

function SettingSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-start gap-4 mb-4">
        <div className="p-2 rounded-lg bg-slate-100">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-blue-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

export function Settings({ onRefresh, isRefreshing, lastUpdated }: SettingsProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Data source status (demo)
  const dataSources = [
    { name: 'Notion - Jobs Database', status: 'connected', lastSync: lastUpdated },
    { name: 'Notion - Programs Database', status: 'connected', lastSync: lastUpdated },
    { name: 'Notion - DCGS Contacts', status: 'connected', lastSync: lastUpdated },
    { name: 'Notion - GDIT Contacts', status: 'connected', lastSync: lastUpdated },
    { name: 'Notion - Contractors', status: 'connected', lastSync: lastUpdated },
  ];

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Configure your BD Intelligence Dashboard</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Data Sources */}
        <SettingSection
          title="Data Sources"
          description="Connected Notion databases and sync status"
          icon={Database}
        >
          <div className="space-y-3">
            {dataSources.map((source, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      source.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm text-slate-700">{source.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {source.lastSync ? `Synced ${source.lastSync.toLocaleTimeString()}` : 'Not synced'}
                  </span>
                  <Check className="h-4 w-4 text-green-500" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isRefreshing
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Syncing...' : 'Sync All Data'}
            </button>
            {lastUpdated && (
              <span className="text-sm text-slate-500">
                Last full sync: {lastUpdated.toLocaleString()}
              </span>
            )}
          </div>
        </SettingSection>

        {/* Auto Refresh */}
        <SettingSection
          title="Data Refresh"
          description="Configure automatic data updates"
          icon={RefreshCw}
        >
          <div className="space-y-4">
            <Toggle
              enabled={autoRefresh}
              onChange={setAutoRefresh}
              label="Enable auto-refresh (every 30 minutes)"
            />
            <p className="text-xs text-slate-500">
              When enabled, the dashboard will automatically fetch new data from Notion every 30 minutes.
            </p>
          </div>
        </SettingSection>

        {/* Notifications */}
        <SettingSection
          title="Notifications"
          description="Configure alert preferences"
          icon={Bell}
        >
          <div className="space-y-4">
            <Toggle
              enabled={notifications}
              onChange={setNotifications}
              label="Enable browser notifications"
            />
            <div className="text-xs text-slate-500 space-y-1">
              <p>Receive notifications for:</p>
              <ul className="list-disc list-inside ml-2">
                <li>New critical-priority jobs</li>
                <li>New executive contacts added</li>
                <li>Daily playbook reminders</li>
              </ul>
            </div>
          </div>
        </SettingSection>

        {/* Display */}
        <SettingSection
          title="Display"
          description="Customize the dashboard appearance"
          icon={Globe}
        >
          <div className="space-y-4">
            <Toggle
              enabled={darkMode}
              onChange={setDarkMode}
              label="Dark mode (coming soon)"
            />
          </div>
        </SettingSection>

        {/* About */}
        <SettingSection
          title="About"
          description="BD Intelligence Dashboard"
          icon={Shield}
        >
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              <strong>Version:</strong> 1.0.0
            </p>
            <p>
              <strong>Data Engine:</strong> BD Correlation Engine v1.0
            </p>
            <p>
              Part of the BD Automation Engine suite for federal business development.
            </p>
            <div className="pt-3">
              <a
                href="https://github.com/your-repo/bd-automation-engine"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View Documentation
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </SettingSection>
      </div>
    </div>
  );
}
