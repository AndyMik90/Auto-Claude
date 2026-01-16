/**
 * useCorrelation Hook
 *
 * React hook for accessing the BD Intelligence Correlation Engine.
 * Provides correlated data (Jobs → Programs → Contacts → Related Jobs)
 * with caching and performance optimization.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  correlateJob,
  correlateAllJobs,
  type JobCorrelation,
  type CorrelationStats,
  type ProgramMatch,
  type ContactMatch,
  type RelatedJob,
} from '../services/correlationEngine';
import type { Job, Program, Contact } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface UseCorrelationOptions {
  /** Auto-correlate all jobs on mount */
  autoCorrelate?: boolean;
  /** Limit number of jobs to correlate (for performance) */
  limit?: number;
  /** Filter jobs before correlation */
  filter?: (job: Job) => boolean;
}

export interface UseCorrelationReturn {
  /** All job correlations */
  correlations: JobCorrelation[];
  /** Correlation statistics */
  stats: CorrelationStats;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Get correlation for a specific job */
  getCorrelation: (jobId: string) => JobCorrelation | null;
  /** Manually trigger correlation refresh */
  refresh: () => void;
  /** Get top matches for a job */
  getTopMatches: (jobId: string) => {
    program: ProgramMatch | null;
    contacts: ContactMatch[];
    relatedJobs: RelatedJob[];
  };
  /** Search correlations by query */
  searchCorrelations: (query: string) => JobCorrelation[];
}

// =============================================================================
// CACHE
// =============================================================================

// Simple in-memory cache for correlations
const correlationCache = new Map<string, JobCorrelation>();
let cacheTimestamp: number | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(jobId: string): string {
  return `correlation_${jobId}`;
}

function isCacheValid(): boolean {
  if (!cacheTimestamp) return false;
  return Date.now() - cacheTimestamp < CACHE_TTL;
}

function clearCache(): void {
  correlationCache.clear();
  cacheTimestamp = null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useCorrelation(
  jobs: Job[],
  programs: Program[],
  contacts: Contact[],
  options: UseCorrelationOptions = {}
): UseCorrelationReturn {
  const { autoCorrelate = true, limit, filter } = options;

  const [correlations, setCorrelations] = useState<JobCorrelation[]>([]);
  const [stats, setStats] = useState<CorrelationStats>({
    totalJobs: 0,
    jobsWithPrograms: 0,
    jobsWithContacts: 0,
    jobsWithRelatedJobs: 0,
    averageConfidence: 0,
    programMatchRate: 0,
    contactMatchRate: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flatten contacts from tier-grouped structure if needed
  const flatContacts = useMemo(() => {
    if (Array.isArray(contacts)) {
      return contacts;
    }
    // contacts might be Record<tier, Contact[]>
    const contactMap = contacts as Record<string | number, Contact[]>;
    return Object.values(contactMap).flat();
  }, [contacts]);

  // Filter and limit jobs
  const filteredJobs = useMemo(() => {
    let result = jobs;
    if (filter) {
      result = result.filter(filter);
    }
    if (limit && result.length > limit) {
      result = result.slice(0, limit);
    }
    return result;
  }, [jobs, filter, limit]);

  // Run correlation
  const runCorrelation = useCallback(() => {
    if (filteredJobs.length === 0) {
      setCorrelations([]);
      setStats({
        totalJobs: 0,
        jobsWithPrograms: 0,
        jobsWithContacts: 0,
        jobsWithRelatedJobs: 0,
        averageConfidence: 0,
        programMatchRate: 0,
        contactMatchRate: 0,
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check cache validity
      if (isCacheValid() && correlationCache.size >= filteredJobs.length) {
        // Use cached correlations
        const cachedCorrelations: JobCorrelation[] = [];
        for (const job of filteredJobs) {
          const cached = correlationCache.get(getCacheKey(job.id));
          if (cached) {
            cachedCorrelations.push(cached);
          }
        }

        if (cachedCorrelations.length === filteredJobs.length) {
          // Calculate stats from cache
          const jobsWithPrograms = cachedCorrelations.filter(c => c.programs.length > 0).length;
          const jobsWithContacts = cachedCorrelations.filter(c => c.contacts.length > 0).length;
          const jobsWithRelatedJobs = cachedCorrelations.filter(c => c.relatedJobs.length > 0).length;
          const totalConfidence = cachedCorrelations.reduce((sum, c) => sum + c.overallConfidence, 0);

          setCorrelations(cachedCorrelations);
          setStats({
            totalJobs: cachedCorrelations.length,
            jobsWithPrograms,
            jobsWithContacts,
            jobsWithRelatedJobs,
            averageConfidence: Math.round(totalConfidence / cachedCorrelations.length),
            programMatchRate: Math.round((jobsWithPrograms / cachedCorrelations.length) * 100),
            contactMatchRate: Math.round((jobsWithContacts / cachedCorrelations.length) * 100),
          });
          setLoading(false);
          return;
        }
      }

      // Run full correlation
      const { correlations: newCorrelations, stats: newStats } = correlateAllJobs(
        filteredJobs,
        programs,
        flatContacts
      );

      // Update cache
      clearCache();
      cacheTimestamp = Date.now();
      for (const correlation of newCorrelations) {
        correlationCache.set(getCacheKey(correlation.job.id), correlation);
      }

      setCorrelations(newCorrelations);
      setStats(newStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Correlation failed');
    } finally {
      setLoading(false);
    }
  }, [filteredJobs, programs, flatContacts]);

  // Auto-correlate on data change
  useEffect(() => {
    if (autoCorrelate && filteredJobs.length > 0 && programs.length > 0) {
      runCorrelation();
    }
  }, [autoCorrelate, filteredJobs, programs, flatContacts, runCorrelation]);

  // Get correlation for specific job
  const getCorrelation = useCallback(
    (jobId: string): JobCorrelation | null => {
      // Check cache first
      const cached = correlationCache.get(getCacheKey(jobId));
      if (cached && isCacheValid()) {
        return cached;
      }

      // Calculate on demand
      const job = jobs.find(j => j.id === jobId);
      if (!job) return null;

      const correlation = correlateJob(job, programs, flatContacts, jobs);

      // Cache it
      correlationCache.set(getCacheKey(jobId), correlation);

      return correlation;
    },
    [jobs, programs, flatContacts]
  );

  // Get top matches for a job (quick summary)
  const getTopMatches = useCallback(
    (jobId: string) => {
      const correlation = getCorrelation(jobId);
      if (!correlation) {
        return { program: null, contacts: [], relatedJobs: [] };
      }

      return {
        program: correlation.programs[0] || null,
        contacts: correlation.contacts.slice(0, 5),
        relatedJobs: correlation.relatedJobs.slice(0, 5),
      };
    },
    [getCorrelation]
  );

  // Search correlations
  const searchCorrelations = useCallback(
    (query: string): JobCorrelation[] => {
      if (!query.trim()) return correlations;

      const normalized = query.toLowerCase().trim();

      return correlations.filter(c => {
        // Search in job title
        if (c.job.title?.toLowerCase().includes(normalized)) return true;

        // Search in company
        if (c.job.company?.toLowerCase().includes(normalized)) return true;

        // Search in matched programs
        if (c.programs.some(p => p.program.name?.toLowerCase().includes(normalized))) return true;

        // Search in matched contacts
        if (c.contacts.some(ct => ct.contact.name?.toLowerCase().includes(normalized))) return true;

        return false;
      });
    },
    [correlations]
  );

  return {
    correlations,
    stats,
    loading,
    error,
    getCorrelation,
    refresh: runCorrelation,
    getTopMatches,
    searchCorrelations,
  };
}

// =============================================================================
// SPECIALIZED HOOKS
// =============================================================================

/**
 * Hook for getting correlation for a single job
 */
export function useJobCorrelation(
  jobId: string | null,
  jobs: Job[],
  programs: Program[],
  contacts: Contact[]
): { correlation: JobCorrelation | null; loading: boolean } {
  const [correlation, setCorrelation] = useState<JobCorrelation | null>(null);
  const [loading, setLoading] = useState(false);

  // Flatten contacts
  const flatContacts = useMemo(() => {
    if (Array.isArray(contacts)) return contacts;
    return Object.values(contacts as Record<string | number, Contact[]>).flat();
  }, [contacts]);

  useEffect(() => {
    if (!jobId) {
      setCorrelation(null);
      return;
    }

    setLoading(true);

    // Check cache
    const cached = correlationCache.get(getCacheKey(jobId));
    if (cached && isCacheValid()) {
      setCorrelation(cached);
      setLoading(false);
      return;
    }

    // Calculate correlation
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      setCorrelation(null);
      setLoading(false);
      return;
    }

    const result = correlateJob(job, programs, flatContacts, jobs);
    correlationCache.set(getCacheKey(jobId), result);
    setCorrelation(result);
    setLoading(false);
  }, [jobId, jobs, programs, flatContacts]);

  return { correlation, loading };
}

/**
 * Hook for hot leads (high confidence jobs with program matches)
 */
export function useHotLeads(
  jobs: Job[],
  programs: Program[],
  contacts: Contact[],
  minConfidence: number = 60
): { leads: JobCorrelation[]; loading: boolean } {
  const { correlations, loading } = useCorrelation(jobs, programs, contacts);

  const leads = useMemo(() => {
    return correlations
      .filter(c => c.overallConfidence >= minConfidence && c.programs.length > 0)
      .sort((a, b) => b.overallConfidence - a.overallConfidence)
      .slice(0, 20);
  }, [correlations, minConfidence]);

  return { leads, loading };
}

export default useCorrelation;
