/**
 * useAutoEnrichment Hook
 *
 * React hook for cross-database auto-enrichment with Notion integration.
 * Provides real-time enrichment calculations and call sheet generation.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  fetchJobs,
  fetchPrograms,
  fetchAllContacts,
  isNotionConfigured,
} from '../services/notionApi';
import type { NotionJob, NotionProgram, NotionContact } from '../services/notionApi';
import {
  batchEnrich,
  generateCallSheet,
  type EnrichedRecord,
  type EnrichmentStats,
  type CallSheetEntry,
} from '../services/autoEnrichment';

export interface UseAutoEnrichmentResult {
  // Data
  jobs: NotionJob[];
  programs: NotionProgram[];
  contacts: NotionContact[];

  // Enriched data
  enrichedJobs: EnrichedRecord[];
  enrichedContacts: EnrichedRecord[];

  // Stats
  stats: EnrichmentStats | null;

  // Call sheet
  callSheet: CallSheetEntry[];

  // State
  isLoading: boolean;
  isEnriching: boolean;
  error: string | null;
  lastEnrichmentDate: string | null;

  // Actions
  fetchData: () => Promise<void>;
  runEnrichment: () => void;
  exportCallSheet: () => void;
  refreshAll: () => Promise<void>;
}

const initialStats: EnrichmentStats = {
  totalJobs: 0,
  totalContacts: 0,
  jobsByProgram: {},
  contactsByTier: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  jobsByPriority: { critical: 0, high: 0, medium: 0, standard: 0 },
  contactsByPriority: { critical: 0, high: 0, medium: 0, standard: 0 },
  avgBDScore: 0,
  highValueJobs: 0,
  criticalContacts: 0,
};

export function useAutoEnrichment(): UseAutoEnrichmentResult {
  // Raw data from Notion
  const [jobs, setJobs] = useState<NotionJob[]>([]);
  const [programs, setPrograms] = useState<NotionProgram[]>([]);
  const [contacts, setContacts] = useState<NotionContact[]>([]);

  // Enriched data
  const [enrichedJobs, setEnrichedJobs] = useState<EnrichedRecord[]>([]);
  const [enrichedContacts, setEnrichedContacts] = useState<EnrichedRecord[]>([]);

  // Stats and call sheet
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [callSheet, setCallSheet] = useState<CallSheetEntry[]>([]);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEnrichmentDate, setLastEnrichmentDate] = useState<string | null>(null);

  /**
   * Fetch all data from Notion databases
   */
  const fetchData = useCallback(async () => {
    if (!isNotionConfigured()) {
      setError('Notion is not configured. Please add your token in Settings.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [fetchedJobs, fetchedPrograms, fetchedContacts] = await Promise.all([
        fetchJobs(),
        fetchPrograms(),
        fetchAllContacts(),
      ]);

      setJobs(fetchedJobs);
      setPrograms(fetchedPrograms);
      setContacts(fetchedContacts);

      console.log(
        `Fetched: ${fetchedJobs.length} jobs, ${fetchedPrograms.length} programs, ${fetchedContacts.length} contacts`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data from Notion';
      setError(message);
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Run enrichment on all data
   */
  const runEnrichment = useCallback(() => {
    if (jobs.length === 0 && contacts.length === 0) {
      setError('No data to enrich. Fetch data first.');
      return;
    }

    setIsEnriching(true);

    try {
      const result = batchEnrich(jobs, contacts);

      setEnrichedJobs(result.enrichedJobs);
      setEnrichedContacts(result.enrichedContacts);
      setStats(result.stats);

      // Generate call sheet
      const sheet = generateCallSheet(contacts, result.enrichedContacts);
      setCallSheet(sheet);

      setLastEnrichmentDate(new Date().toISOString());
      setError(null);

      console.log('Enrichment complete:', result.stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enrichment failed';
      setError(message);
      console.error('Enrichment error:', err);
    } finally {
      setIsEnriching(false);
    }
  }, [jobs, contacts]);

  /**
   * Export call sheet as CSV (downloadable)
   */
  const exportCallSheet = useCallback(() => {
    if (callSheet.length === 0) {
      setError('No call sheet data to export. Run enrichment first.');
      return;
    }

    // Create CSV content
    const headers = [
      'Name',
      'Title',
      'Company',
      'Program',
      'Tier',
      'Tier Label',
      'Priority',
      'Email',
      'Phone',
      'LinkedIn',
      'Suggested Action',
    ];

    const rows = callSheet.map((entry) => [
      entry.name,
      entry.title,
      entry.company,
      entry.program,
      entry.tier.toString(),
      entry.tierLabel,
      `${entry.priorityEmoji} ${entry.priority}`,
      entry.email,
      entry.phone,
      entry.linkedin,
      entry.suggestedAction,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `call_sheet_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`Exported ${callSheet.length} entries to CSV`);
  }, [callSheet]);

  /**
   * Refresh all data and run enrichment
   */
  const refreshAll = useCallback(async () => {
    await fetchData();
    // Enrichment will run after data is fetched via useEffect
  }, [fetchData]);

  // Auto-run enrichment when data changes
  useEffect(() => {
    if (jobs.length > 0 || contacts.length > 0) {
      runEnrichment();
    }
  }, [jobs, contacts, runEnrichment]);

  return {
    // Data
    jobs,
    programs,
    contacts,

    // Enriched data
    enrichedJobs,
    enrichedContacts,

    // Stats
    stats,

    // Call sheet
    callSheet,

    // State
    isLoading,
    isEnriching,
    error,
    lastEnrichmentDate,

    // Actions
    fetchData,
    runEnrichment,
    exportCallSheet,
    refreshAll,
  };
}

export default useAutoEnrichment;
