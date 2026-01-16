import { useState, useEffect, useCallback } from 'react';
import {
  fetchJobs,
  fetchPrograms,
  isNotionConfigured,
} from '../services/notionApi';
import type { NotionJob, NotionProgram } from '../services/notionApi';
import type { Job, Program, DashboardData, CorrelationSummary } from '../types';

interface UseNotionDataReturn {
  jobs: Job[];
  programs: Program[];
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  refresh: () => Promise<void>;
}

// Combined return type matching useData interface
interface UseNotionDashboardReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
  isConfigured: boolean;
}

// Transform NotionJob to Job type
function transformJob(notionJob: NotionJob): Job {
  return {
    id: notionJob.id,
    title: notionJob.title,
    program: notionJob.program,
    agency: notionJob.agency,
    bd_priority: notionJob.bd_priority,
    clearance: notionJob.clearance,
    functional_area: notionJob.functional_area,
    status: notionJob.status,
    location: notionJob.location,
    city: notionJob.city,
    company: notionJob.company,
    task_order: notionJob.task_order,
    source_url: notionJob.source_url,
    scraped_at: notionJob.scraped_at,
    dcgs_relevance: notionJob.dcgs_relevance,
    // Legacy fields
    program_name: notionJob.program,
    source: 'Insight Global',
  };
}

// Transform NotionProgram to Program type
function transformProgram(notionProgram: NotionProgram): Program {
  return {
    id: notionProgram.id,
    name: notionProgram.name,
    acronym: notionProgram.acronym,
    agency: notionProgram.agency_owner,
    prime_contractor: '', // Will be resolved separately if needed
    prime_contractor_ids: notionProgram.prime_contractor_ids,
    bd_priority: notionProgram.bd_priority,
    program_type: notionProgram.program_type,
    contract_vehicle: notionProgram.contract_vehicle,
    contract_value: notionProgram.contract_value,
    location: notionProgram.key_locations,
    clearance_requirements: notionProgram.clearance_requirements,
    period_of_performance: notionProgram.period_of_performance,
    recompete_date: notionProgram.recompete_date,
    hiring_velocity: notionProgram.hiring_velocity,
    pts_involvement: notionProgram.pts_involvement,
    notes: notionProgram.notes,
  };
}

export function useNotionData(): UseNotionDataReturn {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  const loadData = useCallback(async () => {
    const configured = isNotionConfigured();
    setIsConfigured(configured);

    if (!configured) {
      setLoading(false);
      setError('Notion not configured. Please add your Notion token in Settings.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [notionJobs, notionPrograms] = await Promise.all([
        fetchJobs(),
        fetchPrograms(),
      ]);

      setJobs(notionJobs.map(transformJob));
      setPrograms(notionPrograms.map(transformProgram));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data from Notion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    jobs,
    programs,
    loading,
    error,
    isConfigured,
    refresh: loadData,
  };
}

export function useNotionJobs(): { jobs: Job[]; loading: boolean; error: string | null } {
  const { jobs, loading, error } = useNotionData();
  return { jobs, loading, error };
}

export function useNotionPrograms(): { programs: Program[]; loading: boolean; error: string | null } {
  const { programs, loading, error } = useNotionData();
  return { programs, loading, error };
}

// Generate summary from jobs and programs data
function generateSummary(jobs: Job[], programs: Program[]): CorrelationSummary {
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

  // Count jobs per program
  const programJobCounts: Record<string, number> = {};
  jobs.forEach((job) => {
    const programName = job.program || job.program_name || 'Unknown';
    programJobCounts[programName] = (programJobCounts[programName] || 0) + 1;
  });

  // Top programs by job count
  const topPrograms = Object.entries(programJobCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, jobCount]) => ({
      name,
      job_count: jobCount,
      contact_count: 0,
    }));

  return {
    generated_at: new Date().toISOString(),
    statistics: {
      total_jobs: jobs.length,
      total_programs: programs.length,
      total_contacts: 0,
      total_contractors: 0,
      jobs_matched_to_programs: jobs.filter((j) => j.program).length,
      jobs_matched_to_contacts: 0,
      contacts_matched_to_programs: 0,
      contacts_with_relevant_jobs: 0,
      match_rates: {
        jobs_to_programs: jobs.length > 0 ? jobs.filter((j) => j.program).length / jobs.length : 0,
        jobs_to_contacts: 0,
        contacts_to_programs: 0,
      },
    },
    priority_distribution: priorityDist,
    top_programs_by_jobs: topPrograms,
    contacts_by_tier: {},
  };
}

// Hook that returns data in the same format as useData for full compatibility
export function useNotionDashboard(): UseNotionDashboardReturn {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    const configured = isNotionConfigured();
    setIsConfigured(configured);

    if (!configured) {
      setLoading(false);
      setError('Notion not configured. Please add your Notion token in Settings.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [notionJobs, notionPrograms] = await Promise.all([
        fetchJobs(),
        fetchPrograms(),
      ]);

      const jobs = notionJobs.map(transformJob);
      const programs = notionPrograms.map(transformProgram);
      const summary = generateSummary(jobs, programs);

      setData({
        jobs,
        programs,
        contacts: {}, // Will be loaded separately when contacts database is added
        contractors: [], // Will be loaded separately when contractors database is added
        summary,
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data from Notion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    refresh: loadData,
    lastUpdated,
    isConfigured,
  };
}
