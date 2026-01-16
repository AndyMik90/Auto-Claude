import { useState, useEffect } from 'react';
import {
  Zap,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Users,
  Briefcase,
  TrendingUp,
  Database,
} from 'lucide-react';
import { useAutoEnrichment } from '../hooks/useAutoEnrichment';
import type { BDPriorityLevel } from '../services/autoEnrichment';

const PRIORITY_STYLES: Record<BDPriorityLevel, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  standard: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
};

interface EnrichmentDashboardProps {
  loading?: boolean;
}

export function EnrichmentDashboard({ loading: externalLoading }: EnrichmentDashboardProps) {
  const {
    jobs,
    contacts,
    enrichedJobs: _enrichedJobs,
    enrichedContacts: _enrichedContacts,
    stats,
    callSheet,
    isLoading,
    isEnriching,
    error,
    lastEnrichmentDate,
    fetchData,
    runEnrichment,
    exportCallSheet,
    refreshAll,
  } = useAutoEnrichment();
  void _enrichedJobs; // Suppress unused warning - available for future use
  void _enrichedContacts; // Suppress unused warning - available for future use

  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto-refresh every 5 minutes if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshAll();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  const combinedLoading = externalLoading || isLoading || isEnriching;

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            Auto-Enrichment Engine
          </h1>
          <p className="text-slate-500">
            Cross-database field population with BD scoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchData}
            disabled={combinedLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Database className="h-4 w-4" />
            Fetch Data
          </button>
          <button
            onClick={runEnrichment}
            disabled={combinedLoading || (jobs.length === 0 && contacts.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isEnriching ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {isEnriching ? 'Enriching...' : 'Run Enrichment'}
          </button>
          <button
            onClick={exportCallSheet}
            disabled={callSheet.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export Call Sheet
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats?.totalJobs ?? jobs.length}</p>
              <p className="text-xs text-slate-500">Total Jobs</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats?.totalContacts ?? contacts.length}</p>
              <p className="text-xs text-slate-500">Total Contacts</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats?.avgBDScore ?? 0}</p>
              <p className="text-xs text-slate-500">Avg BD Score</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats?.highValueJobs ?? 0}</p>
              <p className="text-xs text-slate-500">High Value Jobs</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Users className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats?.criticalContacts ?? 0}</p>
              <p className="text-xs text-slate-500">Critical Contacts</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{callSheet.length}</p>
              <p className="text-xs text-slate-500">Call Sheet Entries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
        {/* Priority Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex flex-col overflow-hidden">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Priority Distribution
          </h2>
          <div className="grid grid-cols-2 gap-4 flex-1">
            {/* Jobs by Priority */}
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3">Jobs</h3>
              <div className="space-y-2">
                {(['critical', 'high', 'medium', 'standard'] as const).map((priority) => {
                  const count = stats?.jobsByPriority[priority] ?? 0;
                  const total = stats?.totalJobs ?? 1;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const style = PRIORITY_STYLES[priority];
                  return (
                    <div key={priority} className="flex items-center gap-2">
                      <span className={`w-20 text-xs font-medium px-2 py-1 rounded ${style.bg} ${style.text}`}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${style.bg.replace('100', '500')}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 w-12 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Contacts by Priority */}
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3">Contacts</h3>
              <div className="space-y-2">
                {(['critical', 'high', 'medium', 'standard'] as const).map((priority) => {
                  const count = stats?.contactsByPriority[priority] ?? 0;
                  const total = stats?.totalContacts ?? 1;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const style = PRIORITY_STYLES[priority];
                  return (
                    <div key={priority} className="flex items-center gap-2">
                      <span className={`w-20 text-xs font-medium px-2 py-1 rounded ${style.bg} ${style.text}`}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${style.bg.replace('100', '500')}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 w-12 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Contacts by Tier */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex flex-col overflow-hidden">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            Contacts by Tier
          </h2>
          <div className="space-y-3 flex-1">
            {[1, 2, 3, 4, 5, 6].map((tier) => {
              const count = stats?.contactsByTier[tier] ?? 0;
              const total = stats?.totalContacts ?? 1;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const labels = [
                'Executive (C-Suite)',
                'Director Level',
                'Program Leadership',
                'Manager Level',
                'Senior IC',
                'Individual',
              ];
              return (
                <div key={tier} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                    {tier}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700">{labels[tier - 1]}</span>
                      <span className="text-sm font-medium text-slate-900">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Jobs by Program */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex flex-col overflow-hidden">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-500" />
            Jobs by Program
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {stats?.jobsByProgram && Object.entries(stats.jobsByProgram)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([program, count]) => (
                <div key={program} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="text-sm text-slate-700">{program}</span>
                  <span className="text-sm font-bold text-slate-900">{count}</span>
                </div>
              ))}
            {(!stats?.jobsByProgram || Object.keys(stats.jobsByProgram).length === 0) && (
              <p className="text-slate-500 text-center py-4">No enrichment data yet</p>
            )}
          </div>
        </div>

        {/* Call Sheet Preview */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Download className="h-5 w-5 text-green-500" />
              Call Sheet Preview
            </h2>
            <span className="text-xs text-slate-500">
              {callSheet.length} entries
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {callSheet.slice(0, 10).map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <span className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700">
                  {entry.tier}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{entry.name}</p>
                  <p className="text-xs text-slate-500 truncate">{entry.title} @ {entry.company}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  PRIORITY_STYLES[entry.priority.toLowerCase() as BDPriorityLevel]?.bg || 'bg-slate-100'
                } ${
                  PRIORITY_STYLES[entry.priority.toLowerCase() as BDPriorityLevel]?.text || 'text-slate-600'
                }`}>
                  {entry.priorityEmoji} {entry.priority}
                </span>
              </div>
            ))}
            {callSheet.length === 0 && (
              <p className="text-slate-500 text-center py-4">Run enrichment to generate call sheet</p>
            )}
            {callSheet.length > 10 && (
              <p className="text-center py-2 text-xs text-slate-500">
                +{callSheet.length - 10} more entries (export to see all)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Last Updated */}
      {lastEnrichmentDate && (
        <div className="mt-4 text-xs text-slate-500 text-center">
          Last enriched: {new Date(lastEnrichmentDate).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default EnrichmentDashboard;
