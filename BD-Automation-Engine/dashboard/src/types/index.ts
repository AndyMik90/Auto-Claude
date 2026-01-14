// BD Dashboard Type Definitions

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  clearance: string;
  status: string;
  source: string;
  source_url: string;
  program_name: string;
  contract_naics: string;
  bd_priority: number | string;
  bd_score: number;
  matched_programs: string[];
  matched_contacts: string[];
  created_at?: string;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  agency: string;
  prime_contractor: string;
  contract_vehicle: string;
  contract_value: number;
  location: string;
  status: string;
  priority: string;
  naics_code: string;
  job_count: number;
  contact_count: number;
}

export interface Contact {
  id: string;
  name: string;
  first_name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  company: string;
  program: string;
  tier: number;
  bd_priority: string;
  relationship_status: string;
  notes: string;
  source_db: string;
  matched_programs: string[];
}

export interface Contractor {
  id: string;
  name: string;
  description: string;
  website: string;
  programs: string[];
  contract_vehicles: string[];
  locations: string[];
  capabilities: string[];
  job_count: number;
  contact_count: number;
}

export interface CorrelationSummary {
  generated_at: string;
  statistics: {
    total_jobs: number;
    total_programs: number;
    total_contacts: number;
    total_contractors: number;
    jobs_matched_to_programs: number;
    jobs_matched_to_contacts: number;
    contacts_matched_to_programs: number;
    contacts_with_relevant_jobs: number;
    match_rates: {
      jobs_to_programs: number;
      jobs_to_contacts: number;
      contacts_to_programs: number;
    };
  };
  priority_distribution: Record<string, number>;
  top_programs_by_jobs: Array<{
    name: string;
    job_count: number;
    contact_count: number;
  }>;
  contacts_by_tier: Record<string, number>;
}

export interface DashboardData {
  jobs: Job[];
  programs: Program[];
  contacts: Record<string, Contact[]>;
  contractors: Contractor[];
  summary: CorrelationSummary;
}

export type TabId =
  | 'executive'
  | 'jobs'
  | 'programs'
  | 'contacts'
  | 'contractors'
  | 'locations'
  | 'events'
  | 'opportunities'
  | 'playbook'
  | 'mindmap'
  | 'settings';

export interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export type ContactTier = 1 | 2 | 3 | 4 | 5 | 6;

export const TIER_LABELS: Record<ContactTier, string> = {
  1: 'Executive (C-Suite)',
  2: 'Senior Leadership',
  3: 'Director Level',
  4: 'Manager Level',
  5: 'Senior Individual',
  6: 'Individual Contributor',
};

export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export const TIER_COLORS: Record<ContactTier, string> = {
  1: 'bg-purple-600',
  2: 'bg-blue-600',
  3: 'bg-cyan-600',
  4: 'bg-emerald-600',
  5: 'bg-amber-600',
  6: 'bg-gray-500',
};
