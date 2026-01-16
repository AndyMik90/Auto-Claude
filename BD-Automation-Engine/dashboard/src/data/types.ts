/**
 * Data Layer Types
 *
 * Type definitions for the unified data abstraction layer.
 * Supports both Notion API and Local file data sources.
 */

import type { Job, Program, Contact, Contractor, CorrelationSummary } from '../types';

// =============================================================================
// DATA SOURCE TYPES
// =============================================================================

export type DataSourceType = 'notion' | 'local';

export interface DataSourceStatus {
  type: DataSourceType;
  configured: boolean;
  connected: boolean;
  lastSync: Date | null;
  error: string | null;
}

// =============================================================================
// DATA ADAPTER INTERFACE
// =============================================================================

export interface SyncResult {
  success: boolean;
  recordsUpdated: number;
  errors: string[];
  timestamp: Date;
}

export interface DataAdapter {
  /** Adapter type identifier */
  type: DataSourceType;

  /** Check if this data source is properly configured */
  isConfigured(): boolean;

  /** Test connection to data source */
  testConnection(): Promise<boolean>;

  /** Fetch all jobs */
  fetchJobs(): Promise<Job[]>;

  /** Fetch all programs */
  fetchPrograms(): Promise<Program[]>;

  /** Fetch all contacts (flattened) */
  fetchContacts(): Promise<Contact[]>;

  /** Fetch contacts grouped by tier */
  fetchContactsByTier(): Promise<Record<number, Contact[]>>;

  /** Fetch all contractors */
  fetchContractors(): Promise<Contractor[]>;

  /** Sync data (for sources that support it) */
  sync(): Promise<SyncResult>;

  /** Get current status */
  getStatus(): DataSourceStatus;
}

// =============================================================================
// DATA CONTEXT TYPES
// =============================================================================

export interface DashboardDataState {
  jobs: Job[];
  programs: Program[];
  contacts: Contact[];
  contactsByTier: Record<number, Contact[]>;
  contractors: Contractor[];
  summary: CorrelationSummary | null;
}

export interface DataContextValue {
  /** Current data state */
  data: DashboardDataState;

  /** Loading state */
  loading: boolean;

  /** Error message if any */
  error: string | null;

  /** Current data source */
  dataSource: DataSourceType;

  /** Data source status */
  sourceStatus: DataSourceStatus;

  /** Is data source configured */
  isConfigured: boolean;

  /** Last update timestamp */
  lastUpdated: Date | null;

  /** Switch data source */
  switchDataSource: (source: DataSourceType) => void;

  /** Refresh data */
  refresh: () => Promise<void>;

  /** Sync data (if supported by source) */
  sync: () => Promise<SyncResult>;
}

// =============================================================================
// DATA QUALITY TYPES
// =============================================================================

export interface DataQualityMetrics {
  totalJobs: number;
  totalPrograms: number;
  totalContacts: number;

  // Completeness metrics
  jobsWithProgram: number;
  jobsWithLocation: number;
  jobsWithClearance: number;
  jobsWithCompany: number;

  contactsWithEmail: number;
  contactsWithPhone: number;
  contactsWithLinkedIn: number;
  contactsWithTier: number;

  programsWithPrime: number;
  programsWithAgency: number;
  programsWithValue: number;

  // Match coverage
  jobsMatchedToPrograms: number;
  jobsMatchedToContacts: number;
  contactsMatchedToPrograms: number;

  // Calculated rates
  jobProgramMatchRate: number;
  jobContactMatchRate: number;
  contactProgramMatchRate: number;
  overallDataQuality: number; // 0-100
}

export interface UnmatchedItem {
  id: string;
  type: 'job' | 'contact' | 'program';
  title: string;
  reason: string;
  fields: Record<string, string | null>;
}

// =============================================================================
// FILTER TYPES
// =============================================================================

export interface JobFilters {
  search?: string;
  company?: string;
  location?: string;
  clearance?: string;
  program?: string;
  minScore?: number;
  status?: string;
}

export interface ContactFilters {
  search?: string;
  company?: string;
  tier?: number;
  program?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
}

export interface ProgramFilters {
  search?: string;
  agency?: string;
  prime?: string;
  priority?: string;
  hasJobs?: boolean;
}
