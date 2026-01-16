/**
 * Notion Data Adapter
 *
 * Wraps the existing notionApi service to implement the DataAdapter interface.
 * Provides access to Notion databases with caching and rate limiting.
 */

import type { Job, Program, Contact, Contractor } from '../../types';
import type { DataAdapter, DataSourceStatus, SyncResult } from '../types';
import {
  isNotionConfigured,
  fetchJobs as notionFetchJobs,
  fetchPrograms as notionFetchPrograms,
  fetchAllContacts,
  fetchContractors as notionFetchContractors,
  setNotionToken,
  clearNotionToken,
  type NotionJob,
  type NotionProgram,
  type NotionContact,
  type NotionContractor,
} from '../../services/notionApi';

// =============================================================================
// TRANSFORM FUNCTIONS
// =============================================================================

function transformNotionJob(notionJob: NotionJob): Job {
  return {
    id: notionJob.id,
    title: notionJob.title || '',
    program: notionJob.program || '',
    agency: notionJob.agency || '',
    bd_priority: notionJob.bd_priority,
    clearance: notionJob.clearance || '',
    functional_area: notionJob.functional_area || '',
    status: notionJob.status || 'Open',
    location: notionJob.location || '',
    city: notionJob.city || '',
    company: notionJob.company || '',
    task_order: notionJob.task_order || '',
    source_url: notionJob.source_url || '',
    scraped_at: notionJob.scraped_at || '',
    dcgs_relevance: notionJob.dcgs_relevance || false,
    source: 'notion',
  };
}

function transformNotionProgram(notionProgram: NotionProgram): Program {
  return {
    id: notionProgram.id,
    name: notionProgram.name || '',
    acronym: notionProgram.acronym || '',
    agency: notionProgram.agency_owner || '',
    prime_contractor: '', // Need to resolve from relation
    prime_contractor_ids: notionProgram.prime_contractor_ids || [],
    bd_priority: notionProgram.bd_priority || 'Medium',
    program_type: notionProgram.program_type || '',
    contract_vehicle: notionProgram.contract_vehicle || '',
    contract_value: notionProgram.contract_value || '',
    location: notionProgram.key_locations || '',
    clearance_requirements: notionProgram.clearance_requirements || [],
    period_of_performance: notionProgram.period_of_performance || '',
    recompete_date: notionProgram.recompete_date || '',
    hiring_velocity: notionProgram.hiring_velocity || '',
    pts_involvement: notionProgram.pts_involvement || '',
    notes: notionProgram.notes || '',
  };
}

function transformNotionContact(notionContact: NotionContact): Contact {
  return {
    id: notionContact.id,
    name: notionContact.name || '',
    first_name: notionContact.firstName || '',
    title: notionContact.title || '',
    email: notionContact.email || '',
    phone: notionContact.phone || '',
    linkedin: notionContact.linkedin || '',
    company: notionContact.company || '',
    program: notionContact.program || '',
    tier: notionContact.tier || 6,
    bd_priority: notionContact.bdPriority || '',
    relationship_status: notionContact.relationshipStrength || '',
    notes: `${notionContact.locationHub || ''} ${notionContact.outreachHistory || ''}`.trim(),
    source_db: notionContact.sourceDb || 'Notion',
    matched_programs: notionContact.functionalArea || [],
  };
}

function transformNotionContractor(notionContractor: NotionContractor): Contractor {
  return {
    id: notionContractor.id,
    name: notionContractor.name || '',
    description: '',
    website: '',
    programs: [],
    contract_vehicles: notionContractor.contractVehicles || [],
    locations: [],
    capabilities: notionContractor.capabilities || [],
    job_count: notionContractor.activePlacements || 0,
    contact_count: 0,
  };
}

// =============================================================================
// NOTION ADAPTER IMPLEMENTATION
// =============================================================================

export class NotionAdapter implements DataAdapter {
  type: 'notion' = 'notion';
  private lastFetchTime: Date | null = null;
  private cachedJobs: Job[] | null = null;
  private cachedPrograms: Program[] | null = null;
  private cachedContacts: Contact[] | null = null;
  private cachedContractors: Contractor[] | null = null;
  private error: string | null = null;
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  isConfigured(): boolean {
    return isNotionConfigured();
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      // Try to fetch a small set of data to test connection
      await notionFetchJobs();
      return true;
    } catch {
      return false;
    }
  }

  async fetchJobs(): Promise<Job[]> {
    if (!this.isConfigured()) {
      throw new Error('Notion is not configured. Please set your API token in Settings.');
    }

    try {
      if (this.cachedJobs && this.isCacheValid()) {
        return this.cachedJobs;
      }

      const notionJobs = await notionFetchJobs();
      this.cachedJobs = notionJobs.map(transformNotionJob);
      this.lastFetchTime = new Date();
      this.error = null;
      return this.cachedJobs;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch jobs from Notion';
      throw err;
    }
  }

  async fetchPrograms(): Promise<Program[]> {
    if (!this.isConfigured()) {
      throw new Error('Notion is not configured. Please set your API token in Settings.');
    }

    try {
      if (this.cachedPrograms && this.isCacheValid()) {
        return this.cachedPrograms;
      }

      const notionPrograms = await notionFetchPrograms();
      this.cachedPrograms = notionPrograms.map(transformNotionProgram);
      this.lastFetchTime = new Date();
      this.error = null;
      return this.cachedPrograms;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch programs from Notion';
      throw err;
    }
  }

  async fetchContacts(): Promise<Contact[]> {
    if (!this.isConfigured()) {
      throw new Error('Notion is not configured. Please set your API token in Settings.');
    }

    try {
      if (this.cachedContacts && this.isCacheValid()) {
        return this.cachedContacts;
      }

      const notionContacts = await fetchAllContacts();
      this.cachedContacts = notionContacts.map(transformNotionContact);
      this.lastFetchTime = new Date();
      this.error = null;
      return this.cachedContacts;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch contacts from Notion';
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
    if (!this.isConfigured()) {
      throw new Error('Notion is not configured. Please set your API token in Settings.');
    }

    try {
      if (this.cachedContractors && this.isCacheValid()) {
        return this.cachedContractors;
      }

      const notionContractors = await notionFetchContractors();
      this.cachedContractors = notionContractors.map(transformNotionContractor);
      this.lastFetchTime = new Date();
      this.error = null;
      return this.cachedContractors;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch contractors from Notion';
      throw err;
    }
  }

  async sync(): Promise<SyncResult> {
    this.clearCache();

    const errors: string[] = [];
    let recordsUpdated = 0;

    try {
      const jobs = await this.fetchJobs();
      recordsUpdated += jobs.length;
    } catch (err) {
      errors.push(`Jobs: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    try {
      const programs = await this.fetchPrograms();
      recordsUpdated += programs.length;
    } catch (err) {
      errors.push(`Programs: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    try {
      const contacts = await this.fetchContacts();
      recordsUpdated += contacts.length;
    } catch (err) {
      errors.push(`Contacts: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    try {
      const contractors = await this.fetchContractors();
      recordsUpdated += contractors.length;
    } catch (err) {
      errors.push(`Contractors: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return {
      success: errors.length === 0,
      recordsUpdated,
      errors,
      timestamp: new Date(),
    };
  }

  getStatus(): DataSourceStatus {
    return {
      type: 'notion',
      configured: this.isConfigured(),
      connected: this.cachedJobs !== null,
      lastSync: this.lastFetchTime,
      error: this.error,
    };
  }

  // Token management
  setToken(token: string): void {
    setNotionToken(token);
    this.clearCache();
  }

  clearToken(): void {
    clearNotionToken();
    this.clearCache();
  }

  private isCacheValid(): boolean {
    if (!this.lastFetchTime) return false;
    return Date.now() - this.lastFetchTime.getTime() < this.cacheTimeout;
  }

  private clearCache(): void {
    this.cachedJobs = null;
    this.cachedPrograms = null;
    this.cachedContacts = null;
    this.cachedContractors = null;
    this.lastFetchTime = null;
  }
}

// Export singleton instance
export const notionAdapter = new NotionAdapter();

export default notionAdapter;
