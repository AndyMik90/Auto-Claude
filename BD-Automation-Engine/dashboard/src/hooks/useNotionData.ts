import { useState, useEffect, useCallback } from 'react';
import type { Job, Program, DashboardData, CorrelationSummary, Contact, ContactsByTier } from '../types';

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

// Local JSON data types
interface LocalJob {
  id: string;
  title: string;
  location: string;
  datePosted: string;
  description: string;
  securityClearance: string;
  employmentType: string;
  payRate: string;
  duration: string;
  url: string;
  source: string;
  status: string;
  program: string | null;
  company: string;
  clientBillRate?: string;
  owner?: string;
}

interface LocalProgram {
  id: string;
  name: string;
  acronym: string;
  agency: string;
  budget: string;
  contractValue: string;
  clearanceRequirements: string;
  primeContractor: string;
  keyLocations: string;
  keySubcontractors: string;
  programType: string;
  priorityLevel: string;
  periodOfPerformance: string;
  popStart: string;
  popEnd: string;
  contractVehicle: string;
  notes: string;
  typicalRoles: string;
  confidenceLevel: string;
}

interface LocalContact {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
  linkedIn: string;
  city: string;
  state: string;
  company: string;
  source: string;
  tier: number;
}

interface LocalSummary {
  totalJobs: number;
  openJobs: number;
  totalPrograms: number;
  highPriorityPrograms: number;
  totalContacts: number;
  tier1Contacts: number;
  tier2Contacts: number;
  tier3Contacts: number;
  jobsBySource: Record<string, number>;
  jobsByLocation: Record<string, number>;
  programsByAgency: Record<string, number>;
  contactsByTier: Record<number, number>;
}

// Transform local job to Job type
function transformLocalJob(localJob: LocalJob): Job {
  // Map priority from status/source
  let bdPriority = 50;
  if (localJob.status === 'Open') bdPriority = 70;
  if (localJob.securityClearance?.includes('TS/SCI')) bdPriority = 85;
  if (localJob.securityClearance?.includes('Top Secret')) bdPriority = 80;

  return {
    id: localJob.id,
    title: localJob.title,
    program: localJob.program ?? '',
    agency: '',
    bd_priority: bdPriority,
    clearance: localJob.securityClearance || '',
    functional_area: '',
    status: localJob.status || '',
    location: localJob.location || '',
    city: localJob.location?.split(',')[0]?.trim() || '',
    company: localJob.company || '',
    task_order: '',
    source_url: localJob.url || '',
    scraped_at: localJob.datePosted || '',
    dcgs_relevance: false,
    program_name: localJob.program || undefined,
    source: localJob.source,
  };
}

// Transform local program to Program type
function transformLocalProgram(localProgram: LocalProgram): Program {
  // Map priority level to number
  let bdPriority = 50;
  if (localProgram.priorityLevel === 'High') bdPriority = 80;
  else if (localProgram.priorityLevel === 'Medium') bdPriority = 50;
  else if (localProgram.priorityLevel === 'Low') bdPriority = 30;

  return {
    id: localProgram.id,
    name: localProgram.name || '',
    acronym: localProgram.acronym || '',
    agency: localProgram.agency || '',
    prime_contractor: localProgram.primeContractor || '',
    prime_contractor_ids: [],
    bd_priority: String(bdPriority),
    program_type: localProgram.programType || '',
    contract_vehicle: localProgram.contractVehicle || '',
    contract_value: localProgram.contractValue || '',
    location: localProgram.keyLocations || '',
    clearance_requirements: localProgram.clearanceRequirements ? [localProgram.clearanceRequirements] : [],
    period_of_performance: localProgram.periodOfPerformance || '',
    recompete_date: localProgram.popEnd || '',
    hiring_velocity: '',
    pts_involvement: '',
    notes: localProgram.notes || '',
  };
}

// Transform local contact to Contact type
function transformLocalContact(localContact: LocalContact): Contact {
  return {
    id: localContact.id,
    name: localContact.name || '',
    first_name: localContact.firstName || '',
    title: localContact.jobTitle || '',
    email: localContact.email || '',
    phone: localContact.phone || '',
    linkedin: localContact.linkedIn || '',
    company: localContact.company || '',
    program: '',
    tier: localContact.tier || 6,
    bd_priority: '',
    relationship_status: '',
    notes: '',
    source_db: localContact.source || 'local',
    matched_programs: [],
    // Legacy fields
    last_name: localContact.lastName,
    linkedin_url: localContact.linkedIn,
    programs: [],
    influence_tier: localContact.tier,
    location: localContact.city && localContact.state ? `${localContact.city}, ${localContact.state}` : localContact.city || localContact.state || '',
  };
}

// Fetch local JSON data
async function fetchLocalData<T>(filename: string): Promise<T> {
  const response = await fetch(`/data/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${filename}: ${response.statusText}`);
  }
  return response.json();
}

export function useNotionData(): UseNotionDataReturn {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [localJobs, localPrograms] = await Promise.all([
        fetchLocalData<LocalJob[]>('jobs.json'),
        fetchLocalData<LocalProgram[]>('programs.json'),
      ]);

      setJobs(localJobs.map(transformLocalJob));
      setPrograms(localPrograms.map(transformLocalProgram));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
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
    isConfigured: true, // Local data is always "configured"
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

// Generate summary from local summary data and computed data
function generateSummaryFromLocal(
  localSummary: LocalSummary,
  jobs: Job[],
  _programs: Program[]
): CorrelationSummary {
  void _programs; // Available for future program-based calculations
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
    .filter(([name]) => name !== 'Unknown' && name)
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
      total_jobs: localSummary.totalJobs,
      total_programs: localSummary.totalPrograms,
      total_contacts: localSummary.totalContacts,
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
    contacts_by_tier: localSummary.contactsByTier,
  };
}

// Hook that returns data in the same format as useData for full compatibility
export function useNotionDashboard(): UseNotionDashboardReturn {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [localJobs, localPrograms, localContacts, localSummary] = await Promise.all([
        fetchLocalData<LocalJob[]>('jobs.json'),
        fetchLocalData<LocalProgram[]>('programs.json'),
        fetchLocalData<LocalContact[]>('contacts.json'),
        fetchLocalData<LocalSummary>('summary.json'),
      ]);

      const jobs = localJobs.map(transformLocalJob);
      const programs = localPrograms.map(transformLocalProgram);
      const contacts = localContacts.map(transformLocalContact);
      const summary = generateSummaryFromLocal(localSummary, jobs, programs);

      // Group contacts by tier
      const contactsByTier: ContactsByTier = {};
      contacts.forEach((contact) => {
        const tier = contact.influence_tier || 6;
        if (!contactsByTier[tier]) {
          contactsByTier[tier] = [];
        }
        contactsByTier[tier].push(contact);
      });

      setData({
        jobs,
        programs,
        contacts: contactsByTier,
        contractors: [], // Not loaded from local data yet
        summary,
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
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
    isConfigured: true, // Local data is always configured
  };
}
