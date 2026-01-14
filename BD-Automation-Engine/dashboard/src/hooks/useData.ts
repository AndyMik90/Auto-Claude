import { useState, useEffect, useCallback } from 'react';
import type { DashboardData, Job, Program, Contact, Contractor, CorrelationSummary } from '../types';

const DATA_BASE_PATH = '/data';

interface UseDataReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

export function useData(): UseDataReturn {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [jobsRes, programsRes, contactsRes, contractorsRes, summaryRes] = await Promise.all([
        fetch(`${DATA_BASE_PATH}/jobs_enriched.json`),
        fetch(`${DATA_BASE_PATH}/programs_enriched.json`),
        fetch(`${DATA_BASE_PATH}/contacts_classified.json`),
        fetch(`${DATA_BASE_PATH}/contractors_enriched.json`),
        fetch(`${DATA_BASE_PATH}/correlation_summary.json`),
      ]);

      if (!jobsRes.ok) throw new Error('Failed to load jobs data');
      if (!programsRes.ok) throw new Error('Failed to load programs data');
      if (!contactsRes.ok) throw new Error('Failed to load contacts data');
      if (!contractorsRes.ok) throw new Error('Failed to load contractors data');
      if (!summaryRes.ok) throw new Error('Failed to load summary data');

      // Parse wrapper objects from JSON files
      const [jobsData, programsData, contactsData, contractorsData, summaryData] = await Promise.all([
        jobsRes.json() as Promise<{ jobs: Job[]; generated_at: string }>,
        programsRes.json() as Promise<{ programs: Program[]; generated_at: string }>,
        contactsRes.json() as Promise<{ by_tier: Record<string, Contact[]>; generated_at: string }>,
        contractorsRes.json() as Promise<{ contractors: Contractor[]; generated_at: string }>,
        summaryRes.json() as Promise<CorrelationSummary>,
      ]);

      setData({
        jobs: jobsData.jobs ?? [],
        programs: programsData.programs ?? [],
        contacts: contactsData.by_tier ?? {},
        contractors: contractorsData.contractors ?? [],
        summary: summaryData,
      });
      setLastUpdated(new Date(summaryData.generated_at));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, refresh: loadData, lastUpdated };
}

export function useJobs(): { jobs: Job[]; loading: boolean; error: string | null } {
  const { data, loading, error } = useData();
  return { jobs: data?.jobs ?? [], loading, error };
}

export function usePrograms(): { programs: Program[]; loading: boolean; error: string | null } {
  const { data, loading, error } = useData();
  return { programs: data?.programs ?? [], loading, error };
}

export function useContacts(): { contacts: Record<string, Contact[]>; loading: boolean; error: string | null } {
  const { data, loading, error } = useData();
  return { contacts: data?.contacts ?? {}, loading, error };
}

export function useContractors(): { contractors: Contractor[]; loading: boolean; error: string | null } {
  const { data, loading, error } = useData();
  return { contractors: data?.contractors ?? [], loading, error };
}

export function useSummary(): { summary: CorrelationSummary | null; loading: boolean; error: string | null } {
  const { data, loading, error } = useData();
  return { summary: data?.summary ?? null, loading, error };
}
