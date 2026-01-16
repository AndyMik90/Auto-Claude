/**
 * Data Provider
 *
 * React Context provider for unified data access across Notion and Local sources.
 * Automatically detects available data sources and provides seamless switching.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Job, Program, Contact, CorrelationSummary } from '../types';
import type {
  DataSourceType,
  DataSourceStatus,
  SyncResult,
  DataContextValue,
  DashboardDataState,
} from './types';
import { notionAdapter } from './adapters/notionAdapter';
import { localAdapter } from './adapters/localAdapter';

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const defaultDataState: DashboardDataState = {
  jobs: [],
  programs: [],
  contacts: [],
  contactsByTier: {},
  contractors: [],
  summary: null,
};

const defaultStatus: DataSourceStatus = {
  type: 'local',
  configured: false,
  connected: false,
  lastSync: null,
  error: null,
};

const defaultContextValue: DataContextValue = {
  data: defaultDataState,
  loading: true,
  error: null,
  dataSource: 'local',
  sourceStatus: defaultStatus,
  isConfigured: false,
  lastUpdated: null,
  switchDataSource: () => {},
  refresh: async () => {},
  sync: async () => ({
    success: false,
    recordsUpdated: 0,
    errors: ['Not initialized'],
    timestamp: new Date(),
  }),
};

// =============================================================================
// CONTEXT
// =============================================================================

const DataContext = createContext<DataContextValue>(defaultContextValue);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateSummary(
  jobs: Job[],
  programs: Program[],
  contacts: Contact[]
): CorrelationSummary {
  // Count jobs by priority
  const priorityDist: Record<string, number> = {};
  jobs.forEach((job) => {
    const priority = job.bd_priority;
    let label = 'Unrated';
    if (typeof priority === 'number') {
      if (priority >= 80) label = 'Critical';
      else if (priority >= 60) label = 'High';
      else if (priority >= 40) label = 'Medium';
      else if (priority >= 0) label = 'Low';
    }
    priorityDist[label] = (priorityDist[label] || 0) + 1;
  });

  // Count contacts by tier
  const tierDist: Record<string, number> = {};
  contacts.forEach((contact) => {
    const tier = contact.tier || 6;
    tierDist[`Tier ${tier}`] = (tierDist[`Tier ${tier}`] || 0) + 1;
  });

  // Count jobs per program
  const programJobCounts: Record<string, number> = {};
  jobs.forEach((job) => {
    const programName = job.program || job.program_name || 'Unknown';
    programJobCounts[programName] = (programJobCounts[programName] || 0) + 1;
  });

  // Top programs by job count
  const topPrograms = Object.entries(programJobCounts)
    .filter(([name]) => name !== 'Unknown' && name)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, jobCount]) => ({
      name,
      job_count: jobCount,
      contact_count: contacts.filter(c => c.program === name).length,
    }));

  // Calculate match rates
  const jobsWithProgram = jobs.filter(j => j.program || j.program_name).length;
  const contactsWithProgram = contacts.filter(c => c.program || c.matched_programs?.length).length;

  return {
    generated_at: new Date().toISOString(),
    statistics: {
      total_jobs: jobs.length,
      total_programs: programs.length,
      total_contacts: contacts.length,
      total_contractors: 0,
      jobs_matched_to_programs: jobsWithProgram,
      jobs_matched_to_contacts: 0,
      contacts_matched_to_programs: contactsWithProgram,
      contacts_with_relevant_jobs: 0,
      match_rates: {
        jobs_to_programs: jobs.length > 0 ? jobsWithProgram / jobs.length : 0,
        jobs_to_contacts: 0,
        contacts_to_programs: contacts.length > 0 ? contactsWithProgram / contacts.length : 0,
      },
    },
    priority_distribution: priorityDist,
    top_programs_by_jobs: topPrograms,
    contacts_by_tier: tierDist,
  };
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface DataProviderProps {
  children: React.ReactNode;
  initialSource?: DataSourceType;
}

export function DataProvider({ children, initialSource }: DataProviderProps) {
  // Determine initial source: prefer Notion if configured, fallback to local
  const [dataSource, setDataSource] = useState<DataSourceType>(() => {
    if (initialSource) return initialSource;
    return notionAdapter.isConfigured() ? 'notion' : 'local';
  });

  const [data, setData] = useState<DashboardDataState>(defaultDataState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceStatus, setSourceStatus] = useState<DataSourceStatus>(defaultStatus);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Get the current adapter
  const adapter = useMemo(() => {
    return dataSource === 'notion' ? notionAdapter : localAdapter;
  }, [dataSource]);

  // Load data from current adapter
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [jobs, programs, contacts, contactsByTier, contractors] = await Promise.all([
        adapter.fetchJobs(),
        adapter.fetchPrograms(),
        adapter.fetchContacts(),
        adapter.fetchContactsByTier(),
        adapter.fetchContractors().catch(() => []), // Contractors optional
      ]);

      // Generate summary
      const summary = generateSummary(jobs, programs, contacts);

      setData({
        jobs,
        programs,
        contacts,
        contactsByTier,
        contractors,
        summary,
      });

      setSourceStatus(adapter.getStatus());
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
      setSourceStatus({
        ...adapter.getStatus(),
        error: message,
      });

      // If Notion fails, try falling back to local
      if (dataSource === 'notion') {
        console.warn('Notion failed, falling back to local data');
        try {
          const [jobs, programs, contacts, contactsByTier] = await Promise.all([
            localAdapter.fetchJobs(),
            localAdapter.fetchPrograms(),
            localAdapter.fetchContacts(),
            localAdapter.fetchContactsByTier(),
          ]);

          const summary = generateSummary(jobs, programs, contacts);

          setData({
            jobs,
            programs,
            contacts,
            contactsByTier,
            contractors: [],
            summary,
          });

          setError(`${message} (using local data as fallback)`);
        } catch (localErr) {
          // Both failed
          console.error('Both Notion and local data failed:', localErr);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [adapter, dataSource]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Switch data source
  const switchDataSource = useCallback((source: DataSourceType) => {
    if (source === dataSource) return;

    // Validate source is available
    if (source === 'notion' && !notionAdapter.isConfigured()) {
      setError('Notion is not configured. Please add your API token in Settings.');
      return;
    }

    setDataSource(source);
  }, [dataSource]);

  // Refresh data
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Sync data
  const sync = useCallback(async (): Promise<SyncResult> => {
    setLoading(true);
    try {
      const result = await adapter.sync();
      await loadData();
      return result;
    } catch (err) {
      return {
        success: false,
        recordsUpdated: 0,
        errors: [err instanceof Error ? err.message : 'Sync failed'],
        timestamp: new Date(),
      };
    }
  }, [adapter, loadData]);

  // Context value
  const contextValue: DataContextValue = useMemo(() => ({
    data,
    loading,
    error,
    dataSource,
    sourceStatus,
    isConfigured: adapter.isConfigured(),
    lastUpdated,
    switchDataSource,
    refresh,
    sync,
  }), [data, loading, error, dataSource, sourceStatus, adapter, lastUpdated, switchDataSource, refresh, sync]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Main hook for accessing data context
 */
export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

/**
 * Hook for jobs data only
 */
export function useJobs(): { jobs: Job[]; loading: boolean; error: string | null } {
  const { data, loading, error } = useData();
  return { jobs: data.jobs, loading, error };
}

/**
 * Hook for programs data only
 */
export function usePrograms(): { programs: Program[]; loading: boolean; error: string | null } {
  const { data, loading, error } = useData();
  return { programs: data.programs, loading, error };
}

/**
 * Hook for contacts data only
 */
export function useContacts(): {
  contacts: Contact[];
  contactsByTier: Record<number, Contact[]>;
  loading: boolean;
  error: string | null;
} {
  const { data, loading, error } = useData();
  return {
    contacts: data.contacts,
    contactsByTier: data.contactsByTier,
    loading,
    error,
  };
}

/**
 * Hook for data source management
 */
export function useDataSource(): {
  dataSource: DataSourceType;
  sourceStatus: DataSourceStatus;
  isNotionConfigured: boolean;
  switchToNotion: () => void;
  switchToLocal: () => void;
  setNotionToken: (token: string) => void;
} {
  const { dataSource, sourceStatus, switchDataSource, refresh } = useData();

  const switchToNotion = useCallback(() => {
    switchDataSource('notion');
  }, [switchDataSource]);

  const switchToLocal = useCallback(() => {
    switchDataSource('local');
  }, [switchDataSource]);

  const setNotionToken = useCallback((token: string) => {
    notionAdapter.setToken(token);
    switchDataSource('notion');
    refresh();
  }, [switchDataSource, refresh]);

  return {
    dataSource,
    sourceStatus,
    isNotionConfigured: notionAdapter.isConfigured(),
    switchToNotion,
    switchToLocal,
    setNotionToken,
  };
}

export default DataProvider;
