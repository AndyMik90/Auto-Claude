// BD Dashboard Type Definitions
// Aligned with Notion database schemas

// Job interface aligned with Insight Global Jobs database
export interface Job {
  id: string;
  title: string;
  program: string;
  agency: string;
  bd_priority: number | null;
  clearance: string;
  functional_area: string;
  status: string;
  location: string;
  city: string;
  company: string;
  task_order: string;
  source_url: string;
  scraped_at: string;
  dcgs_relevance: boolean;
  // Legacy fields for backward compatibility
  source?: string;
  program_name?: string;
  contract_naics?: string;
  bd_score?: number;
  matched_programs?: string[];
  matched_contacts?: string[];
  created_at?: string;
}

// Program interface aligned with Federal Programs database
export interface Program {
  id: string;
  name: string;
  acronym: string;
  agency: string;
  prime_contractor: string;
  prime_contractor_ids: string[];
  bd_priority: string;
  program_type: string;
  contract_vehicle: string;
  contract_value: string;
  location: string;
  clearance_requirements: string[];
  period_of_performance: string;
  recompete_date: string;
  hiring_velocity: string;
  pts_involvement: string;
  notes: string;
  // Legacy/computed fields
  description?: string;
  status?: string;
  priority?: string;
  naics_code?: string;
  job_count?: number;
  contact_count?: number;
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
  // Legacy fields for backwards compatibility
  last_name?: string;
  linkedin_url?: string;
  influence_tier?: number;
  location?: string;
  programs?: string[];
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
  | 'intelligence'
  | 'jobs'
  | 'programs'
  | 'contacts'
  | 'contractors'
  | 'locations'
  | 'events'
  | 'opportunities'
  | 'enrichment'
  | 'playbook'
  | 'mindmap'
  | 'dataquality'
  | 'pastperformance'
  | 'primeorgchart'
  | 'contactorgchart'
  | 'placements'
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

// Contacts grouped by tier
export type ContactsByTier = Record<number, Contact[]>;

// =============================================================================
// BULLHORN ETL TYPES
// =============================================================================

// Past Performance (from Bullhorn)
export interface PastPerformance {
  id: string;
  prime_contractor: string;
  total_jobs: number;
  filled_jobs: number;
  total_placements: number;
  avg_bill_rate: number;
  avg_pay_rate: number;
  avg_margin: number;
  fill_rate: number;
  first_job_date: string | null;
  last_job_date: string | null;
  estimated_annual_revenue: number;
  relationship_strength: 'Strategic' | 'Key Account' | 'Established' | 'Growing' | 'Emerging';
  is_defense_prime: boolean;
}

// Prime Contractor Org Chart
export interface PrimeOrgChartItem {
  id: string;
  name: string;
  normalized_name: string;
  category: string;
  total_jobs: number;
  total_placements: number;
  total_contacts: number;
  top_contacts: Array<{
    name: string;
    score: number;
    tier: string;
  }>;
  programs: string[];
  program_count: number;
  is_defense_prime: boolean;
  relationship_tier: 'Strategic' | 'Key Account' | 'Established' | 'Growing' | 'Emerging';
}

// Contact Org Chart (enhanced with scoring)
export interface ContactOrgChartTier {
  description: string;
  contacts: ContactOrgChartItem[];
  count: number;
}

export interface ContactOrgChartItem {
  id: string;
  name: string;
  score: number;
  tier: string;
  tier_level: number;
  placements: number;
  activities: number;
  primes: string[];
  prime_count: number;
  last_activity: string | null;
  scoring_factors: string[];
}

export interface ContactOrgChart {
  tiers: Record<string, ContactOrgChartTier>;
  summary: {
    total_contacts: number;
    tier_distribution: Record<string, number>;
  };
}

// Program Org Chart (enriched with placements)
export interface ProgramOrgChartItem {
  id: string;
  name: string;
  acronym: string;
  agency: string;
  prime_contractor: string;
  program_type: string;
  priority_level: string;
  contract_value: string;
  period_start: string;
  period_end: string;
  locations: string;
  clearance: string;
  typical_roles: string;
  naics_code: string;
  placement_count: number;
  has_pts_history: boolean;
  subcontractors: string;
}

// Placement (from Bullhorn)
export interface Placement {
  id: string;
  prime_contractor: string;
  job_title: string;
  candidate: string;
  status: string;
  owner: string;
  start_date: string | null;
  end_date: string | null;
  salary: number;
  pay_rate: number;
  bill_rate: number;
  spread: number;
  margin_percent: number;
}

// Enriched Correlation Summary
export interface EnrichedCorrelationSummary {
  generated_at: string;
  data_sources: {
    dashboard: {
      jobs: number;
      contacts: number;
      programs: number;
    };
    bullhorn: {
      placements: number;
      contacts: number;
      primes: number;
      activities: number;
    };
    federal_programs: number;
  };
  financial_metrics: {
    total_estimated_revenue: number;
    defense_primes_revenue: number;
    defense_share_percent: number;
    avg_bill_rate: number;
  };
  contact_metrics: {
    total_scored_contacts: number;
    tier_distribution: Record<string, number>;
    avg_score: number;
  };
  program_metrics: {
    total_programs: number;
    programs_with_placements: number;
    total_program_links: number;
  };
  prime_metrics: {
    total_primes: number;
    defense_primes: number;
    top_primes: Array<{
      name: string;
      placements: number;
    }>;
  };
}
