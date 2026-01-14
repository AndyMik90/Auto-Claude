// Native Node Configuration System for Mind Map
// Defines expansion rules for each entity type when used as the central native node

// Types imported from '../types' are not used directly - entity data flows through the store

// ============================================================================
// Core Types
// ============================================================================

export type NativeNodeType =
  | 'JOB'
  | 'PROGRAM'
  | 'CONTACT'
  | 'LOCATION'
  | 'BD_EVENT'
  | 'PRIME'
  | 'CUSTOMER'
  | 'PTS_CONTRACTOR';

export type NodeDisplayMode = 'full' | 'compact' | 'count_only';

export type RelationshipType =
  | 'mapped_to'
  | 'located_at'
  | 'hiring_manager'
  | 'posted_by'
  | 'works_on'
  | 'employed_by'
  | 'operates_at'
  | 'based_in'
  | 'runs'
  | 'owns'
  | 'attending'
  | 'held_at'
  | 'has_task_orders'
  | 'has_subcontractors'
  | 'program_contacts'
  | 'team_members';

export interface ExpansionNodeConfig {
  nodeType: NativeNodeType;
  relationship: RelationshipType;
  fields: string[];
  displayMode: NodeDisplayMode;
  filter?: string;
  sort?: string;
  limit?: number;
}

export interface ExpansionTier {
  tier: number;
  autoExpand: boolean;
  maxNodes: number;
  nodes: ExpansionNodeConfig[];
}

export interface NotePanelField {
  key: string;
  label: string;
  type: 'text' | 'list' | 'link' | 'priority' | 'date' | 'score';
}

export interface NotePanelSection {
  title: string;
  fields: NotePanelField[];
}

export interface ColorScheme {
  nativeNode: string;
  programNodes: string;
  contactNodes: string;
  locationNodes: string;
  jobNodes: string;
  ptsNodes: string;
  primeNodes: string;
}

export interface NativeNodeConfig {
  type: NativeNodeType;
  label: string;
  icon: string;
  initialDisplayFields: string[];
  expansionTiers: ExpansionTier[];
  notePanel: NotePanelSection[];
  colorScheme: ColorScheme;
}

// ============================================================================
// Node Color Constants
// ============================================================================

export const NODE_COLORS = {
  job: {
    background: 'linear-gradient(135deg, #fff5f5, #fed7d7)',
    border: '#e53e3e',
  },
  program: {
    background: 'linear-gradient(135deg, #ebf8ff, #bee3f8)',
    border: '#3182ce',
  },
  prime: {
    background: 'linear-gradient(135deg, #f0fff4, #c6f6d5)',
    border: '#38a169',
  },
  location: {
    background: 'linear-gradient(135deg, #faf5ff, #e9d8fd)',
    border: '#805ad5',
  },
  event: {
    background: 'linear-gradient(135deg, #fffff0, #fefcbf)',
    border: '#d69e2e',
  },
  contact: {
    background: 'linear-gradient(135deg, #fff5f7, #fed7e2)',
    border: '#d53f8c',
  },
  pts: {
    background: 'linear-gradient(135deg, #e6fffa, #b2f5ea)',
    border: '#319795',
  },
  customer: {
    background: 'linear-gradient(135deg, #edf2f7, #e2e8f0)',
    border: '#4a5568',
  },
} as const;

export const PRIORITY_BORDER_COLORS = {
  critical: '#e53e3e',
  high: '#dd6b20',
  medium: '#d69e2e',
  standard: '#718096',
  low: '#718096',
} as const;

// ============================================================================
// JOB Native Node Configuration
// ============================================================================

export const JOB_NATIVE_CONFIG: NativeNodeConfig = {
  type: 'JOB',
  label: 'Job',
  icon: 'Target',
  initialDisplayFields: ['title', 'location', 'clearance', 'bd_priority', 'bd_score'],
  expansionTiers: [
    {
      tier: 1,
      autoExpand: true,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'PROGRAM',
          relationship: 'mapped_to',
          fields: ['name', 'prime_contractor', 'contract_value'],
          displayMode: 'full',
        },
        {
          nodeType: 'LOCATION',
          relationship: 'located_at',
          fields: ['name', 'city', 'state'],
          displayMode: 'full',
        },
        {
          nodeType: 'CONTACT',
          relationship: 'hiring_manager',
          fields: ['name', 'title', 'tier', 'bd_priority'],
          displayMode: 'full',
        },
      ],
    },
    {
      tier: 2,
      autoExpand: false,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'PRIME',
          relationship: 'posted_by',
          fields: ['name', 'program_count'],
          displayMode: 'compact',
        },
        {
          nodeType: 'CUSTOMER',
          relationship: 'owns',
          fields: ['name', 'agency'],
          displayMode: 'compact',
        },
        {
          nodeType: 'CONTACT',
          relationship: 'team_members',
          fields: ['name', 'title', 'tier'],
          displayMode: 'compact',
          filter: 'same_program_or_site',
          limit: 10,
        },
      ],
    },
    {
      tier: 3,
      autoExpand: false,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'PTS_CONTRACTOR',
          relationship: 'mapped_to',
          fields: ['name', 'clearance', 'skills', 'availability'],
          displayMode: 'compact',
          filter: 'skills_match_and_clearance_match',
          limit: 5,
        },
        {
          nodeType: 'JOB',
          relationship: 'located_at',
          fields: ['title', 'clearance', 'bd_priority'],
          displayMode: 'count_only',
          filter: 'same_program',
          limit: 5,
        },
      ],
    },
  ],
  notePanel: [
    {
      title: 'Job Details',
      fields: [
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'skills_required', label: 'Skills Required', type: 'list' },
        { key: 'clearance', label: 'Clearance', type: 'text' },
        { key: 'pay_rate', label: 'Pay Rate', type: 'text' },
        { key: 'posted_date', label: 'Posted', type: 'date' },
        { key: 'source_url', label: 'Source', type: 'link' },
      ],
    },
    {
      title: 'BD Formula',
      fields: [
        { key: 'bd_score', label: 'BD Score', type: 'score' },
        { key: 'bd_priority', label: 'Priority', type: 'priority' },
        { key: 'matched_programs', label: 'Matched Programs', type: 'list' },
        { key: 'matched_contacts', label: 'Matched Contacts', type: 'list' },
      ],
    },
  ],
  colorScheme: {
    nativeNode: NODE_COLORS.job.border,
    programNodes: NODE_COLORS.program.border,
    contactNodes: NODE_COLORS.contact.border,
    locationNodes: NODE_COLORS.location.border,
    jobNodes: NODE_COLORS.job.border,
    ptsNodes: NODE_COLORS.pts.border,
    primeNodes: NODE_COLORS.prime.border,
  },
};

// ============================================================================
// PROGRAM Native Node Configuration
// ============================================================================

export const PROGRAM_NATIVE_CONFIG: NativeNodeConfig = {
  type: 'PROGRAM',
  label: 'Program',
  icon: 'FileText',
  initialDisplayFields: ['name', 'prime_contractor', 'contract_value', 'status'],
  expansionTiers: [
    {
      tier: 1,
      autoExpand: true,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'PRIME',
          relationship: 'runs',
          fields: ['name', 'program_count'],
          displayMode: 'full',
        },
        {
          nodeType: 'CUSTOMER',
          relationship: 'owns',
          fields: ['name', 'agency'],
          displayMode: 'full',
        },
        {
          nodeType: 'LOCATION',
          relationship: 'operates_at',
          fields: ['name', 'city', 'state'],
          displayMode: 'full',
        },
      ],
    },
    {
      tier: 2,
      autoExpand: false,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'JOB',
          relationship: 'mapped_to',
          fields: ['title', 'clearance', 'bd_priority', 'bd_score'],
          displayMode: 'compact',
          sort: 'bd_score_desc',
          limit: 10,
        },
        {
          nodeType: 'CONTACT',
          relationship: 'program_contacts',
          fields: ['name', 'title', 'tier', 'bd_priority'],
          displayMode: 'compact',
          filter: 'tier_1_2_3',
          limit: 10,
        },
      ],
    },
    {
      tier: 3,
      autoExpand: false,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'CONTACT',
          relationship: 'team_members',
          fields: ['name', 'title', 'tier'],
          displayMode: 'compact',
          limit: 15,
        },
        {
          nodeType: 'PTS_CONTRACTOR',
          relationship: 'mapped_to',
          fields: ['name', 'clearance', 'availability'],
          displayMode: 'count_only',
          filter: 'can_fill_roles',
          limit: 5,
        },
      ],
    },
  ],
  notePanel: [
    {
      title: 'Program Details',
      fields: [
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'agency', label: 'Agency', type: 'text' },
        { key: 'contract_vehicle', label: 'Contract Vehicle', type: 'text' },
        { key: 'contract_value', label: 'Contract Value', type: 'text' },
        { key: 'status', label: 'Status', type: 'text' },
      ],
    },
    {
      title: 'Statistics',
      fields: [
        { key: 'job_count', label: 'Open Jobs', type: 'score' },
        { key: 'contact_count', label: 'Known Contacts', type: 'score' },
        { key: 'priority', label: 'Priority', type: 'priority' },
      ],
    },
  ],
  colorScheme: {
    nativeNode: NODE_COLORS.program.border,
    programNodes: NODE_COLORS.program.border,
    contactNodes: NODE_COLORS.contact.border,
    locationNodes: NODE_COLORS.location.border,
    jobNodes: NODE_COLORS.job.border,
    ptsNodes: NODE_COLORS.pts.border,
    primeNodes: NODE_COLORS.prime.border,
  },
};

// ============================================================================
// CONTACT Native Node Configuration
// ============================================================================

export const CONTACT_NATIVE_CONFIG: NativeNodeConfig = {
  type: 'CONTACT',
  label: 'Contact',
  icon: 'User',
  initialDisplayFields: ['name', 'title', 'tier', 'bd_priority', 'company'],
  expansionTiers: [
    {
      tier: 1,
      autoExpand: true,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'PROGRAM',
          relationship: 'works_on',
          fields: ['name', 'prime_contractor', 'contract_value'],
          displayMode: 'full',
        },
        {
          nodeType: 'PRIME',
          relationship: 'employed_by',
          fields: ['name', 'program_count'],
          displayMode: 'full',
        },
        {
          nodeType: 'LOCATION',
          relationship: 'based_in',
          fields: ['name', 'city', 'state'],
          displayMode: 'full',
        },
      ],
    },
    {
      tier: 2,
      autoExpand: false,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'CONTACT',
          relationship: 'team_members',
          fields: ['name', 'title', 'tier'],
          displayMode: 'compact',
          filter: 'same_program',
          limit: 10,
        },
        {
          nodeType: 'JOB',
          relationship: 'hiring_manager',
          fields: ['title', 'clearance', 'bd_priority'],
          displayMode: 'compact',
          limit: 5,
        },
      ],
    },
    {
      tier: 3,
      autoExpand: false,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'PTS_CONTRACTOR',
          relationship: 'mapped_to',
          fields: ['name', 'clearance', 'skills'],
          displayMode: 'count_only',
          filter: 'could_work_with',
          limit: 5,
        },
      ],
    },
  ],
  notePanel: [
    {
      title: 'Contact Details',
      fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'email', label: 'Email', type: 'link' },
        { key: 'phone', label: 'Phone', type: 'text' },
        { key: 'linkedin', label: 'LinkedIn', type: 'link' },
        { key: 'company', label: 'Company', type: 'text' },
      ],
    },
    {
      title: 'BD Intelligence',
      fields: [
        { key: 'tier', label: 'Tier', type: 'score' },
        { key: 'bd_priority', label: 'BD Priority', type: 'priority' },
        { key: 'relationship_status', label: 'Relationship', type: 'text' },
        { key: 'matched_programs', label: 'Programs', type: 'list' },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
    },
  ],
  colorScheme: {
    nativeNode: NODE_COLORS.contact.border,
    programNodes: NODE_COLORS.program.border,
    contactNodes: NODE_COLORS.contact.border,
    locationNodes: NODE_COLORS.location.border,
    jobNodes: NODE_COLORS.job.border,
    ptsNodes: NODE_COLORS.pts.border,
    primeNodes: NODE_COLORS.prime.border,
  },
};

// ============================================================================
// LOCATION Native Node Configuration
// ============================================================================

export const LOCATION_NATIVE_CONFIG: NativeNodeConfig = {
  type: 'LOCATION',
  label: 'Location',
  icon: 'MapPin',
  initialDisplayFields: ['name', 'city', 'state', 'job_count', 'contact_count'],
  expansionTiers: [
    {
      tier: 1,
      autoExpand: true,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'PROGRAM',
          relationship: 'operates_at',
          fields: ['name', 'prime_contractor'],
          displayMode: 'full',
        },
        {
          nodeType: 'JOB',
          relationship: 'located_at',
          fields: ['title', 'clearance', 'bd_priority', 'bd_score'],
          displayMode: 'compact',
          sort: 'bd_score_desc',
          limit: 10,
        },
        {
          nodeType: 'CONTACT',
          relationship: 'based_in',
          fields: ['name', 'title', 'tier', 'bd_priority'],
          displayMode: 'compact',
          sort: 'tier_asc',
          limit: 15,
        },
      ],
    },
    {
      tier: 2,
      autoExpand: false,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'PRIME',
          relationship: 'runs',
          fields: ['name', 'programs_at_location_count'],
          displayMode: 'compact',
        },
        {
          nodeType: 'CUSTOMER',
          relationship: 'owns',
          fields: ['name', 'agency'],
          displayMode: 'compact',
        },
      ],
    },
    {
      tier: 3,
      autoExpand: false,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'PTS_CONTRACTOR',
          relationship: 'mapped_to',
          fields: ['name', 'clearance', 'availability'],
          displayMode: 'count_only',
          filter: 'can_work_at_or_currently_at',
          limit: 10,
        },
      ],
    },
  ],
  notePanel: [
    {
      title: 'Location Details',
      fields: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'state', label: 'State', type: 'text' },
        { key: 'facility_type', label: 'Facility Type', type: 'text' },
      ],
    },
    {
      title: 'Aggregations',
      fields: [
        { key: 'job_count', label: 'Jobs at Location', type: 'score' },
        { key: 'contact_count', label: 'Contacts at Location', type: 'score' },
        { key: 'program_count', label: 'Programs at Location', type: 'score' },
      ],
    },
  ],
  colorScheme: {
    nativeNode: NODE_COLORS.location.border,
    programNodes: NODE_COLORS.program.border,
    contactNodes: NODE_COLORS.contact.border,
    locationNodes: NODE_COLORS.location.border,
    jobNodes: NODE_COLORS.job.border,
    ptsNodes: NODE_COLORS.pts.border,
    primeNodes: NODE_COLORS.prime.border,
  },
};

// ============================================================================
// BD_EVENT Native Node Configuration
// ============================================================================

export const BD_EVENT_NATIVE_CONFIG: NativeNodeConfig = {
  type: 'BD_EVENT',
  label: 'BD Event',
  icon: 'Calendar',
  initialDisplayFields: ['name', 'dates', 'location', 'focus_areas', 'access_requirements'],
  expansionTiers: [
    {
      tier: 1,
      autoExpand: true,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'PRIME',
          relationship: 'attending',
          fields: ['name', 'program_count'],
          displayMode: 'full',
        },
        {
          nodeType: 'LOCATION',
          relationship: 'held_at',
          fields: ['name', 'city', 'state'],
          displayMode: 'full',
        },
      ],
    },
    {
      tier: 2,
      autoExpand: false,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'PROGRAM',
          relationship: 'mapped_to',
          fields: ['name', 'prime_contractor', 'contract_value'],
          displayMode: 'compact',
          filter: 'focus_area_match',
          limit: 10,
        },
      ],
    },
    {
      tier: 3,
      autoExpand: false,
      maxNodes: 20,
      nodes: [
        {
          nodeType: 'CONTACT',
          relationship: 'program_contacts',
          fields: ['name', 'title', 'tier', 'bd_priority'],
          displayMode: 'compact',
          filter: 'tier_1_2_3',
          limit: 15,
        },
        {
          nodeType: 'JOB',
          relationship: 'mapped_to',
          fields: ['title', 'clearance', 'bd_priority'],
          displayMode: 'count_only',
          limit: 10,
        },
      ],
    },
  ],
  notePanel: [
    {
      title: 'Event Details',
      fields: [
        { key: 'name', label: 'Event Name', type: 'text' },
        { key: 'event_type', label: 'Type', type: 'text' },
        { key: 'dates', label: 'Dates', type: 'date' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'focus_areas', label: 'Focus Areas', type: 'list' },
        { key: 'access_requirements', label: 'Access', type: 'text' },
      ],
    },
    {
      title: 'BD Preparation',
      fields: [
        { key: 'target_contacts', label: 'Target Contacts', type: 'list' },
        { key: 'talking_points', label: 'Talking Points', type: 'list' },
        { key: 'pts_attending', label: 'PTS Attending', type: 'text' },
      ],
    },
  ],
  colorScheme: {
    nativeNode: NODE_COLORS.event.border,
    programNodes: NODE_COLORS.program.border,
    contactNodes: NODE_COLORS.contact.border,
    locationNodes: NODE_COLORS.location.border,
    jobNodes: NODE_COLORS.job.border,
    ptsNodes: NODE_COLORS.pts.border,
    primeNodes: NODE_COLORS.prime.border,
  },
};

// ============================================================================
// Configuration Registry
// ============================================================================

export const NATIVE_NODE_CONFIGS: Record<NativeNodeType, NativeNodeConfig> = {
  JOB: JOB_NATIVE_CONFIG,
  PROGRAM: PROGRAM_NATIVE_CONFIG,
  CONTACT: CONTACT_NATIVE_CONFIG,
  LOCATION: LOCATION_NATIVE_CONFIG,
  BD_EVENT: BD_EVENT_NATIVE_CONFIG,
  // Placeholder configs for additional node types
  PRIME: {
    ...PROGRAM_NATIVE_CONFIG,
    type: 'PRIME',
    label: 'Prime Contractor',
    icon: 'Building2',
  },
  CUSTOMER: {
    ...PROGRAM_NATIVE_CONFIG,
    type: 'CUSTOMER',
    label: 'Customer Agency',
    icon: 'Landmark',
  },
  PTS_CONTRACTOR: {
    ...CONTACT_NATIVE_CONFIG,
    type: 'PTS_CONTRACTOR',
    label: 'PTS Contractor',
    icon: 'Briefcase',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getNodeConfig(type: NativeNodeType): NativeNodeConfig {
  return NATIVE_NODE_CONFIGS[type] || JOB_NATIVE_CONFIG;
}

export function getExpansionTier(
  config: NativeNodeConfig,
  tier: number
): ExpansionTier | undefined {
  return config.expansionTiers.find((t) => t.tier === tier);
}

export function getMaxNodesForTier(config: NativeNodeConfig, tier: number): number {
  const tierConfig = getExpansionTier(config, tier);
  return tierConfig?.maxNodes ?? 20;
}

export function shouldAutoExpand(config: NativeNodeConfig, tier: number): boolean {
  const tierConfig = getExpansionTier(config, tier);
  return tierConfig?.autoExpand ?? false;
}

export function getNodeColorByType(type: NativeNodeType | string): { background: string; border: string } {
  const typeKey = type.toLowerCase().replace('_', '') as keyof typeof NODE_COLORS;
  return NODE_COLORS[typeKey] || NODE_COLORS.job;
}

export function getPriorityBorderColor(priority: string): string {
  const key = priority.toLowerCase() as keyof typeof PRIORITY_BORDER_COLORS;
  return PRIORITY_BORDER_COLORS[key] || PRIORITY_BORDER_COLORS.standard;
}

// Tab configuration for NativeNodeTabs component
export interface NativeNodeTab {
  type: NativeNodeType;
  label: string;
  icon: string;
  shortLabel: string;
}

export const NATIVE_NODE_TABS: NativeNodeTab[] = [
  { type: 'JOB', label: 'Jobs', icon: 'Target', shortLabel: 'Job' },
  { type: 'PROGRAM', label: 'Programs', icon: 'FileText', shortLabel: 'Prog' },
  { type: 'CONTACT', label: 'Contacts', icon: 'User', shortLabel: 'Cont' },
  { type: 'LOCATION', label: 'Locations', icon: 'MapPin', shortLabel: 'Loc' },
  { type: 'BD_EVENT', label: 'Events', icon: 'Calendar', shortLabel: 'Event' },
];
