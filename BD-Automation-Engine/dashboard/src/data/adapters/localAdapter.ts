/**
 * Local Data Adapter
 *
 * Loads data from local JSON files in the public/data directory.
 * Provides offline-first capability and fast loading for development.
 */

import type { Job, Program, Contact, Contractor } from '../../types';
import type { DataAdapter, DataSourceStatus, SyncResult } from '../types';

// =============================================================================
// LOCAL FILE TYPES
// =============================================================================

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

// =============================================================================
// TRANSFORM FUNCTIONS
// =============================================================================

function transformLocalJob(localJob: LocalJob): Job {
  let bdPriority = 50;
  if (localJob.status === 'Open') bdPriority = 70;
  if (localJob.securityClearance?.includes('TS/SCI')) bdPriority = 85;
  else if (localJob.securityClearance?.includes('Top Secret')) bdPriority = 80;
  else if (localJob.securityClearance?.includes('Secret')) bdPriority = 65;

  return {
    id: localJob.id,
    title: localJob.title,
    program: localJob.program || '',
    agency: '',
    bd_priority: bdPriority,
    clearance: localJob.securityClearance || '',
    functional_area: '',
    status: localJob.status || 'Open',
    location: localJob.location || '',
    city: localJob.location?.split(',')[0]?.trim() || '',
    company: localJob.company || '',
    task_order: '',
    source_url: localJob.url || '',
    scraped_at: localJob.datePosted || '',
    dcgs_relevance: false,
    program_name: localJob.program || '',
    source: localJob.source || 'local',
  };
}

function transformLocalProgram(localProgram: LocalProgram): Program {
  let bdPriority = 'Medium';
  if (localProgram.priorityLevel === 'High' || localProgram.priorityLevel === 'Critical') {
    bdPriority = localProgram.priorityLevel;
  } else if (localProgram.priorityLevel === 'Low') {
    bdPriority = 'Low';
  }

  return {
    id: localProgram.id,
    name: localProgram.name || '',
    acronym: localProgram.acronym || '',
    agency: localProgram.agency || '',
    prime_contractor: localProgram.primeContractor || '',
    prime_contractor_ids: [],
    bd_priority: bdPriority,
    program_type: localProgram.programType || '',
    contract_vehicle: localProgram.contractVehicle || '',
    contract_value: localProgram.contractValue || '',
    location: localProgram.keyLocations || '',
    clearance_requirements: localProgram.clearanceRequirements
      ? [localProgram.clearanceRequirements]
      : [],
    period_of_performance: localProgram.periodOfPerformance || '',
    recompete_date: localProgram.popEnd || '',
    hiring_velocity: '',
    pts_involvement: '',
    notes: localProgram.notes || '',
  };
}

function transformLocalContact(localContact: LocalContact): Contact {
  const location = [localContact.city, localContact.state]
    .filter(Boolean)
    .join(', ');

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
    notes: location,
    source_db: localContact.source || 'local',
    matched_programs: [],
  };
}

// =============================================================================
// FETCH FUNCTIONS
// =============================================================================

async function fetchLocalData<T>(filename: string): Promise<T> {
  const response = await fetch(`/data/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${filename}: ${response.statusText}`);
  }
  return response.json();
}

// =============================================================================
// LOCAL ADAPTER IMPLEMENTATION
// =============================================================================

export class LocalAdapter implements DataAdapter {
  type: 'local' = 'local';
  private lastFetchTime: Date | null = null;
  private cachedJobs: Job[] | null = null;
  private cachedPrograms: Program[] | null = null;
  private cachedContacts: Contact[] | null = null;
  private error: string | null = null;

  isConfigured(): boolean {
    // Local data is always "configured" - files exist in public/data
    return true;
  }

  async testConnection(): Promise<boolean> {
    try {
      // Try to fetch a small file to test
      await fetch('/data/summary.json');
      return true;
    } catch {
      return false;
    }
  }

  async fetchJobs(): Promise<Job[]> {
    try {
      if (this.cachedJobs && this.isCacheValid()) {
        return this.cachedJobs;
      }

      const localJobs = await fetchLocalData<LocalJob[]>('jobs.json');
      this.cachedJobs = localJobs.map(transformLocalJob);
      this.lastFetchTime = new Date();
      this.error = null;
      return this.cachedJobs;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch jobs';
      throw err;
    }
  }

  async fetchPrograms(): Promise<Program[]> {
    try {
      if (this.cachedPrograms && this.isCacheValid()) {
        return this.cachedPrograms;
      }

      const localPrograms = await fetchLocalData<LocalProgram[]>('programs.json');
      this.cachedPrograms = localPrograms.map(transformLocalProgram);
      this.lastFetchTime = new Date();
      this.error = null;
      return this.cachedPrograms;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch programs';
      throw err;
    }
  }

  async fetchContacts(): Promise<Contact[]> {
    try {
      if (this.cachedContacts && this.isCacheValid()) {
        return this.cachedContacts;
      }

      const localContacts = await fetchLocalData<LocalContact[]>('contacts.json');
      this.cachedContacts = localContacts.map(transformLocalContact);
      this.lastFetchTime = new Date();
      this.error = null;
      return this.cachedContacts;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch contacts';
      throw err;
    }
  }

  async fetchContactsByTier(): Promise<Record<number, Contact[]>> {
    const contacts = await this.fetchContacts();
    const byTier: Record<number, Contact[]> = {};

    for (const contact of contacts) {
      const tier = contact.tier || 6;
      if (!byTier[tier]) {
        byTier[tier] = [];
      }
      byTier[tier].push(contact);
    }

    return byTier;
  }

  async fetchContractors(): Promise<Contractor[]> {
    // Local adapter doesn't have contractor data by default
    // Return empty array or load from contractors.json if it exists
    try {
      const response = await fetch('/data/contractors.json');
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  }

  async sync(): Promise<SyncResult> {
    // Local adapter doesn't sync - just refresh cache
    this.clearCache();

    try {
      await Promise.all([
        this.fetchJobs(),
        this.fetchPrograms(),
        this.fetchContacts(),
      ]);

      return {
        success: true,
        recordsUpdated: (this.cachedJobs?.length || 0) +
                       (this.cachedPrograms?.length || 0) +
                       (this.cachedContacts?.length || 0),
        errors: [],
        timestamp: new Date(),
      };
    } catch (err) {
      return {
        success: false,
        recordsUpdated: 0,
        errors: [err instanceof Error ? err.message : 'Sync failed'],
        timestamp: new Date(),
      };
    }
  }

  getStatus(): DataSourceStatus {
    return {
      type: 'local',
      configured: true,
      connected: this.cachedJobs !== null || this.cachedPrograms !== null,
      lastSync: this.lastFetchTime,
      error: this.error,
    };
  }

  private isCacheValid(): boolean {
    if (!this.lastFetchTime) return false;
    // Cache valid for 5 minutes
    return Date.now() - this.lastFetchTime.getTime() < 5 * 60 * 1000;
  }

  private clearCache(): void {
    this.cachedJobs = null;
    this.cachedPrograms = null;
    this.cachedContacts = null;
  }
}

// Export singleton instance
export const localAdapter = new LocalAdapter();

export default localAdapter;
