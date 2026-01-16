/**
 * Auto-Enrichment Service for BD Pipeline
 *
 * Implements cross-database field population:
 * - Jobs → Programs (by location)
 * - Contacts → Tier (by title)
 * - BD Priority calculation
 * - BD Score (0-100)
 */

import type { NotionJob, NotionProgram, NotionContact } from './notionApi';

// =============================================================================
// LOCATION → PROGRAM MAPPING RULES
// =============================================================================

export const LOCATION_TO_PROGRAM: Record<string, { program: string; emoji: string }> = {
  // San Diego / La Mesa → AF DCGS - PACAF
  'san diego': { program: 'AF DCGS - PACAF', emoji: '🔥' },
  'la mesa': { program: 'AF DCGS - PACAF', emoji: '🔥' },

  // Hampton / Langley → AF DCGS - Langley
  'hampton': { program: 'AF DCGS - Langley', emoji: '' },
  'langley': { program: 'AF DCGS - Langley', emoji: '' },

  // Dayton / Beavercreek → AF DCGS - Wright-Patt
  'dayton': { program: 'AF DCGS - Wright-Patt', emoji: '' },
  'beavercreek': { program: 'AF DCGS - Wright-Patt', emoji: '' },
  'wright-patterson': { program: 'AF DCGS - Wright-Patt', emoji: '' },

  // Norfolk / Suffolk → Navy DCGS-N
  'norfolk': { program: 'Navy DCGS-N', emoji: '' },
  'suffolk': { program: 'Navy DCGS-N', emoji: '' },

  // Herndon / Falls Church → Corporate HQ
  'herndon': { program: 'Corporate HQ', emoji: '' },
  'falls church': { program: 'Corporate HQ', emoji: '' },
};

// =============================================================================
// TITLE → TIER MAPPING RULES
// =============================================================================

export const TITLE_TO_TIER: Array<{ patterns: string[]; tier: number; label: string }> = [
  // Tier 1 - Executive Leadership
  { patterns: ['vp', 'vice president', 'president', 'chief', 'ceo', 'cto', 'cio', 'coo', 'cfo', 'svp', 'evp'], tier: 1, label: 'Tier 1 - Executive' },

  // Tier 2 - Director Level
  { patterns: ['director', 'managing director', 'senior director'], tier: 2, label: 'Tier 2 - Director' },

  // Tier 3 - Program Leadership
  { patterns: ['program manager', 'project manager', 'site lead', 'site manager', 'deputy program', 'assistant program'], tier: 3, label: 'Tier 3 - Program Lead' },

  // Tier 4 - Manager Level
  { patterns: ['manager', 'team lead', 'supervisor', 'lead'], tier: 4, label: 'Tier 4 - Manager' },

  // Tier 5 - Senior Individual
  { patterns: ['senior', 'principal', 'staff', 'lead engineer', 'lead analyst'], tier: 5, label: 'Tier 5 - Senior IC' },

  // Tier 6 - Default
  { patterns: [], tier: 6, label: 'Tier 6 - Individual' },
];

// =============================================================================
// BD PRIORITY RULES
// =============================================================================

export type BDPriorityLevel = 'critical' | 'high' | 'medium' | 'standard';

export interface BDPriorityResult {
  level: BDPriorityLevel;
  emoji: string;
  label: string;
  reasons: string[];
}

// =============================================================================
// ENRICHMENT FUNCTIONS
// =============================================================================

/**
 * Match job location to program
 */
export function matchLocationToProgram(location: string, city?: string): { program: string; emoji: string } | null {
  const searchText = `${location || ''} ${city || ''}`.toLowerCase();

  for (const [loc, mapping] of Object.entries(LOCATION_TO_PROGRAM)) {
    if (searchText.includes(loc)) {
      return mapping;
    }
  }

  return null;
}

/**
 * Classify contact tier by title
 */
export function classifyTierByTitle(title: string): { tier: number; label: string } {
  const titleLower = (title || '').toLowerCase();

  for (const tierRule of TITLE_TO_TIER) {
    if (tierRule.patterns.length === 0) continue; // Skip default

    for (const pattern of tierRule.patterns) {
      if (titleLower.includes(pattern)) {
        return { tier: tierRule.tier, label: tierRule.label };
      }
    }
  }

  // Default to Tier 6
  return { tier: 6, label: 'Tier 6 - Individual' };
}

/**
 * Calculate BD Priority based on tier and program
 */
export function calculateBDPriority(
  tier: number,
  program?: string,
  clearance?: string
): BDPriorityResult {
  const reasons: string[] = [];
  const isPACAF = program?.includes('PACAF');

  // Rule: Tier 1-2 OR PACAF = Critical
  if (tier <= 2) {
    reasons.push(`Tier ${tier} executive contact`);
    return {
      level: 'critical',
      emoji: '🔴',
      label: 'Critical',
      reasons,
    };
  }

  if (isPACAF) {
    reasons.push('PACAF program - hot opportunity');
    return {
      level: 'critical',
      emoji: '🔴',
      label: 'Critical',
      reasons,
    };
  }

  // Rule: Tier 3 = High
  if (tier === 3) {
    reasons.push('Program leadership tier');
    return {
      level: 'high',
      emoji: '🟠',
      label: 'High',
      reasons,
    };
  }

  // Rule: Tier 4 = Medium
  if (tier === 4) {
    reasons.push('Manager tier');
    return {
      level: 'medium',
      emoji: '🟡',
      label: 'Medium',
      reasons,
    };
  }

  // Rule: Tier 5-6 = Standard
  reasons.push('Individual contributor');
  return {
    level: 'standard',
    emoji: '⚪',
    label: 'Standard',
    reasons,
  };
}

/**
 * Calculate BD Score (0-100)
 *
 * Scoring breakdown:
 * - Location match: +40
 * - TS/SCI clearance: +25
 * - DCGS keyword: +20
 * - GDIT prime: +10
 * - Base: +5
 */
export function calculateBDScore(
  job: NotionJob,
  matchedProgram?: string
): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {
    base: 5,
    location: 0,
    clearance: 0,
    dcgsKeyword: 0,
    gditPrime: 0,
  };

  // Location match (+40)
  const locationMatch = matchLocationToProgram(job.location, job.city);
  if (locationMatch && matchedProgram === locationMatch.program) {
    breakdown.location = 40;
  }

  // Clearance scoring (+25 for TS/SCI)
  const clearance = (job.clearance || '').toLowerCase();
  if (clearance.includes('ts/sci') || clearance.includes('ts-sci') ||
      (clearance.includes('top secret') && clearance.includes('sci'))) {
    breakdown.clearance = 25;
  } else if (clearance.includes('top secret') || clearance.includes('ts')) {
    breakdown.clearance = 15;
  } else if (clearance.includes('secret')) {
    breakdown.clearance = 10;
  }

  // DCGS keyword (+20)
  const jobText = `${job.title} ${job.functional_area} ${job.company}`.toLowerCase();
  if (jobText.includes('dcgs') || jobText.includes('distributed common ground') ||
      job.dcgs_relevance) {
    breakdown.dcgsKeyword = 20;
  }

  // GDIT prime (+10)
  const company = (job.company || '').toLowerCase();
  if (company.includes('gdit') || company.includes('general dynamics')) {
    breakdown.gditPrime = 10;
  }

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return { score: Math.min(score, 100), breakdown };
}

// =============================================================================
// FULL ENRICHMENT PIPELINE
// =============================================================================

export interface EnrichedRecord {
  originalId: string;
  type: 'job' | 'contact';
  enrichments: {
    program?: string;
    programEmoji?: string;
    tier?: number;
    tierLabel?: string;
    bdPriority: BDPriorityResult;
    bdScore?: number;
    bdScoreBreakdown?: Record<string, number>;
  };
  isEnriched: boolean;
  enrichmentDate: string;
}

/**
 * Enrich a job record with cross-database lookups
 */
export function enrichJobRecord(job: NotionJob): EnrichedRecord {
  // Match location to program
  const locationMatch = matchLocationToProgram(job.location, job.city);
  const matchedProgram = locationMatch?.program || job.program;

  // Calculate BD score
  const { score, breakdown } = calculateBDScore(job, matchedProgram);

  // Calculate priority (jobs use score-based priority)
  let priorityLevel: BDPriorityLevel = 'standard';
  if (score >= 80) priorityLevel = 'critical';
  else if (score >= 60) priorityLevel = 'high';
  else if (score >= 40) priorityLevel = 'medium';

  return {
    originalId: job.id,
    type: 'job',
    enrichments: {
      program: matchedProgram,
      programEmoji: locationMatch?.emoji,
      bdPriority: {
        level: priorityLevel,
        emoji: priorityLevel === 'critical' ? '🔴' : priorityLevel === 'high' ? '🟠' : priorityLevel === 'medium' ? '🟡' : '⚪',
        label: priorityLevel.charAt(0).toUpperCase() + priorityLevel.slice(1),
        reasons: [`BD Score: ${score}/100`],
      },
      bdScore: score,
      bdScoreBreakdown: breakdown,
    },
    isEnriched: true,
    enrichmentDate: new Date().toISOString(),
  };
}

/**
 * Enrich a contact record with tier classification
 */
export function enrichContactRecord(contact: NotionContact): EnrichedRecord {
  // Classify tier by title
  const tierResult = classifyTierByTitle(contact.title);

  // Calculate BD priority based on tier and program
  const bdPriority = calculateBDPriority(tierResult.tier, contact.program);

  return {
    originalId: contact.id,
    type: 'contact',
    enrichments: {
      program: contact.program,
      tier: tierResult.tier,
      tierLabel: tierResult.label,
      bdPriority,
    },
    isEnriched: true,
    enrichmentDate: new Date().toISOString(),
  };
}

/**
 * Batch enrich all records
 */
export function batchEnrich(
  jobs: NotionJob[],
  contacts: NotionContact[]
): {
  enrichedJobs: EnrichedRecord[];
  enrichedContacts: EnrichedRecord[];
  stats: EnrichmentStats;
} {
  const enrichedJobs = jobs.map(enrichJobRecord);
  const enrichedContacts = contacts.map(enrichContactRecord);

  const stats = calculateEnrichmentStats(enrichedJobs, enrichedContacts);

  return { enrichedJobs, enrichedContacts, stats };
}

// =============================================================================
// STATISTICS
// =============================================================================

export interface EnrichmentStats {
  totalJobs: number;
  totalContacts: number;
  jobsByProgram: Record<string, number>;
  contactsByTier: Record<number, number>;
  jobsByPriority: Record<BDPriorityLevel, number>;
  contactsByPriority: Record<BDPriorityLevel, number>;
  avgBDScore: number;
  highValueJobs: number; // Score >= 70
  criticalContacts: number; // Tier 1-2
}

export function calculateEnrichmentStats(
  enrichedJobs: EnrichedRecord[],
  enrichedContacts: EnrichedRecord[]
): EnrichmentStats {
  const stats: EnrichmentStats = {
    totalJobs: enrichedJobs.length,
    totalContacts: enrichedContacts.length,
    jobsByProgram: {},
    contactsByTier: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    jobsByPriority: { critical: 0, high: 0, medium: 0, standard: 0 },
    contactsByPriority: { critical: 0, high: 0, medium: 0, standard: 0 },
    avgBDScore: 0,
    highValueJobs: 0,
    criticalContacts: 0,
  };

  let totalScore = 0;

  for (const job of enrichedJobs) {
    const program = job.enrichments.program || 'Unknown';
    stats.jobsByProgram[program] = (stats.jobsByProgram[program] || 0) + 1;
    stats.jobsByPriority[job.enrichments.bdPriority.level]++;

    const score = job.enrichments.bdScore || 0;
    totalScore += score;
    if (score >= 70) stats.highValueJobs++;
  }

  for (const contact of enrichedContacts) {
    const tier = contact.enrichments.tier || 6;
    stats.contactsByTier[tier]++;
    stats.contactsByPriority[contact.enrichments.bdPriority.level]++;

    if (tier <= 2) stats.criticalContacts++;
  }

  stats.avgBDScore = enrichedJobs.length > 0 ? Math.round(totalScore / enrichedJobs.length) : 0;

  return stats;
}

// =============================================================================
// CALL SHEET GENERATION
// =============================================================================

export interface CallSheetEntry {
  name: string;
  title: string;
  company: string;
  program: string;
  tier: number;
  tierLabel: string;
  priority: string;
  priorityEmoji: string;
  email: string;
  phone: string;
  linkedin: string;
  suggestedAction: string;
}

/**
 * Generate call sheet from enriched contacts
 */
export function generateCallSheet(
  contacts: NotionContact[],
  enrichedContacts: EnrichedRecord[]
): CallSheetEntry[] {
  const enrichmentMap = new Map(enrichedContacts.map(e => [e.originalId, e]));

  return contacts
    .map(contact => {
      const enrichment = enrichmentMap.get(contact.id);
      if (!enrichment) return null;

      const tier = enrichment.enrichments.tier || 6;
      const priority = enrichment.enrichments.bdPriority;

      let suggestedAction = 'Schedule intro call';
      if (tier === 1) suggestedAction = 'Executive outreach - prepare value prop';
      else if (tier === 2) suggestedAction = 'Director meeting request';
      else if (tier === 3) suggestedAction = 'Program alignment discussion';
      else if (contact.email) suggestedAction = 'Send personalized email';
      else if (contact.linkedin) suggestedAction = 'LinkedIn connection request';

      return {
        name: contact.name,
        title: contact.title,
        company: contact.company,
        program: contact.program,
        tier,
        tierLabel: enrichment.enrichments.tierLabel || '',
        priority: priority.label,
        priorityEmoji: priority.emoji,
        email: contact.email,
        phone: contact.phone,
        linkedin: contact.linkedin,
        suggestedAction,
      };
    })
    .filter((entry): entry is CallSheetEntry => entry !== null)
    .sort((a, b) => {
      // Sort by tier first, then by priority
      if (a.tier !== b.tier) return a.tier - b.tier;
      const priorityOrder = { critical: 0, high: 1, medium: 2, standard: 3 };
      return (priorityOrder[a.priority.toLowerCase() as BDPriorityLevel] || 3) -
             (priorityOrder[b.priority.toLowerCase() as BDPriorityLevel] || 3);
    });
}

export default {
  matchLocationToProgram,
  classifyTierByTitle,
  calculateBDPriority,
  calculateBDScore,
  enrichJobRecord,
  enrichContactRecord,
  batchEnrich,
  calculateEnrichmentStats,
  generateCallSheet,
  LOCATION_TO_PROGRAM,
  TITLE_TO_TIER,
};
