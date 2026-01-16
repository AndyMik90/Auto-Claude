/**
 * BD Enrichment Engine
 *
 * This engine takes raw job data and enriches it by:
 * 1. Matching jobs to programs based on keywords, agencies, locations, and context clues
 * 2. Finding relevant contacts for matched programs
 * 3. Scoring and prioritizing opportunities
 * 4. Generating actionable BD tasks
 */

import type { NotionJob, NotionProgram, NotionContact } from './notionApi';

// Enriched job with matched program and contacts
export interface EnrichedJob {
  job: NotionJob;
  matchedProgram: NotionProgram | null;
  matchScore: number;
  matchReasons: string[];
  relatedContacts: NotionContact[];
  bdPriority: 'critical' | 'high' | 'medium' | 'low';
  suggestedActions: string[];
}

// Match result for program matching
interface MatchResult {
  program: NotionProgram;
  score: number;
  reasons: string[];
}

// Keywords/signals that indicate program matches
const PROGRAM_KEYWORDS: Record<string, string[]> = {
  'DCGS': ['dcgs', 'distributed common ground', 'ground system', 'isr', 'sigint', 'geoint', 'imint'],
  'DCGS-A': ['dcgs-a', 'army dcgs', 'army distributed common ground'],
  'AF DCGS': ['af dcgs', 'air force dcgs', 'langley', 'distributed ground system'],
  'Defense Enclave Services': ['des', 'defense enclave', 'enclave services', 'disa enclave'],
  'Enterprise IT': ['enterprise it', 'enterprise services', 'eit', 'it modernization'],
  'Cyber': ['cyber', 'cybersecurity', 'information security', 'network security', 'soc', 'noc'],
  'C4ISR': ['c4isr', 'c5isr', 'command control', 'communications', 'surveillance', 'reconnaissance'],
  'Space': ['space', 'satellite', 'orbital', 'launch', 'spacecraft'],
  'Missile Defense': ['missile defense', 'mda', 'thaad', 'patriot', 'aegis', 'interceptor'],
};

// Agency mappings
const AGENCY_MAPPINGS: Record<string, string[]> = {
  'Army': ['army', 'usa', 'us army', 'department of army'],
  'Air Force': ['air force', 'usaf', 'af', 'department of air force'],
  'Navy': ['navy', 'usn', 'department of navy', 'navsea', 'navair'],
  'Marines': ['marine', 'usmc', 'marine corps'],
  'DISA': ['disa', 'defense information systems'],
  'DIA': ['dia', 'defense intelligence agency'],
  'NSA': ['nsa', 'national security agency'],
  'NGA': ['nga', 'national geospatial'],
  'NRO': ['nro', 'national reconnaissance'],
  'DoD': ['dod', 'osd', 'department of defense', 'pentagon'],
  'IC': ['ic', 'intelligence community', 'intel community'],
};

// Location-based program associations
const LOCATION_PROGRAM_HINTS: Record<string, string[]> = {
  'langley': ['AF DCGS', 'CIA'],
  'wright-patterson': ['AF DCGS', 'Air Force'],
  'fort bragg': ['SOCOM', 'Army'],
  'fort meade': ['NSA', 'Cyber'],
  'san diego': ['Navy', 'SPAWAR'],
  'norfolk': ['Navy', 'DCGS-N'],
  'hawaii': ['PACOM', 'Indo-Pacific'],
  'colorado springs': ['Space', 'NORAD', 'Space Force'],
  'huntsville': ['MDA', 'Army', 'Space'],
  'tampa': ['CENTCOM', 'SOCOM'],
};

/**
 * Calculate match score between a job and a program
 */
function calculateMatchScore(job: NotionJob, program: NotionProgram): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  const jobText = `${job.title} ${job.company} ${job.location} ${job.city} ${job.agency} ${job.functional_area}`.toLowerCase();
  const programText = `${program.name} ${program.acronym} ${program.agency_owner} ${program.key_locations}`.toLowerCase();

  // Direct program name match (highest priority)
  if (job.program && program.name) {
    const jobProgram = job.program.toLowerCase();
    const progName = program.name.toLowerCase();
    const progAcronym = (program.acronym || '').toLowerCase();

    if (jobProgram === progName || jobProgram === progAcronym) {
      score += 100;
      reasons.push('Direct program name match');
    } else if (jobProgram.includes(progName) || progName.includes(jobProgram)) {
      score += 75;
      reasons.push('Partial program name match');
    }
  }

  // Agency match
  if (job.agency && program.agency_owner) {
    const jobAgency = job.agency.toLowerCase();
    const progAgency = program.agency_owner.toLowerCase();

    if (jobAgency === progAgency) {
      score += 30;
      reasons.push(`Agency match: ${program.agency_owner}`);
    } else {
      // Check agency mappings
      for (const [agency, variants] of Object.entries(AGENCY_MAPPINGS)) {
        if (variants.some(v => jobAgency.includes(v)) &&
            variants.some(v => progAgency.includes(v))) {
          score += 20;
          reasons.push(`Agency family match: ${agency}`);
          break;
        }
      }
    }
  }

  // Keyword matching
  for (const [keyword, signals] of Object.entries(PROGRAM_KEYWORDS)) {
    const keywordInProgram = programText.includes(keyword.toLowerCase()) ||
                             signals.some(s => programText.includes(s));
    const keywordInJob = signals.some(s => jobText.includes(s));

    if (keywordInProgram && keywordInJob) {
      score += 25;
      reasons.push(`Keyword match: ${keyword}`);
    }
  }

  // Location matching
  const jobLocation = `${job.location} ${job.city}`.toLowerCase();

  for (const [location, hints] of Object.entries(LOCATION_PROGRAM_HINTS)) {
    if (jobLocation.includes(location)) {
      if (hints.some(h => programText.includes(h.toLowerCase()))) {
        score += 15;
        reasons.push(`Location hint: ${location}`);
      }
    }
  }

  // Clearance alignment
  if (job.clearance && program.clearance_requirements?.length > 0) {
    const jobClearance = job.clearance.toLowerCase();
    const progClearances = program.clearance_requirements.map(c => c.toLowerCase());

    if (progClearances.some(c => jobClearance.includes(c) || c.includes(jobClearance))) {
      score += 10;
      reasons.push('Clearance alignment');
    }
  }

  // Functional area matching
  if (job.functional_area) {
    const funcArea = job.functional_area.toLowerCase();
    const progType = (program.program_type || '').toLowerCase();

    if (funcArea.includes(progType) || progType.includes(funcArea)) {
      score += 10;
      reasons.push('Functional area match');
    }
  }

  // DCGS relevance boost
  if (job.dcgs_relevance) {
    if (programText.includes('dcgs')) {
      score += 40;
      reasons.push('DCGS relevance flag matched');
    }
  }

  return { program, score, reasons };
}

/**
 * Match a job to the best program
 */
export function matchJobToProgram(job: NotionJob, programs: NotionProgram[]): MatchResult | null {
  const matches = programs
    .map(program => calculateMatchScore(job, program))
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches.length > 0 ? matches[0] : null;
}

/**
 * Find contacts relevant to a program
 */
export function findContactsForProgram(
  program: NotionProgram,
  contacts: NotionContact[],
  maxContacts: number = 5
): NotionContact[] {
  const programName = program.name.toLowerCase();
  const programAcronym = (program.acronym || '').toLowerCase();
  const agencyOwner = (program.agency_owner || '').toLowerCase();

  const scoredContacts = contacts.map(contact => {
    let score = 0;
    const contactProgram = (contact.program || '').toLowerCase();

    // Direct program match
    if (contactProgram.includes(programName) || contactProgram.includes(programAcronym)) {
      score += 100;
    }

    // Agency match (for contacts at prime contractors)
    if (agencyOwner && contact.company) {
      const company = contact.company.toLowerCase();
      // GDIT is often on DoD/Army/Navy programs
      if (company.includes('gdit') && ['dod', 'army', 'navy', 'disa'].some(a => agencyOwner.includes(a))) {
        score += 20;
      }
    }

    // Tier bonus - prioritize senior contacts
    score += (7 - contact.tier) * 10; // Tier 1 = +60, Tier 6 = +10

    // BD Priority bonus
    if (contact.bdPriority.includes('Critical')) score += 30;
    else if (contact.bdPriority.includes('High')) score += 20;
    else if (contact.bdPriority.includes('Medium')) score += 10;

    // Relationship strength bonus
    if (contact.relationshipStrength === 'Strong') score += 25;
    else if (contact.relationshipStrength === 'Developing') score += 15;

    // Has recent outreach scheduled
    if (contact.nextOutreachDate) {
      const outreachDate = new Date(contact.nextOutreachDate);
      const now = new Date();
      const daysUntil = (outreachDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntil >= 0 && daysUntil <= 14) {
        score += 15; // Upcoming outreach
      }
    }

    return { contact, score };
  });

  return scoredContacts
    .filter(sc => sc.score > 20) // Minimum relevance threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, maxContacts)
    .map(sc => sc.contact);
}

/**
 * Calculate BD priority for an enriched job
 */
function calculateBDPriority(
  job: NotionJob,
  matchScore: number,
  program: NotionProgram | null,
  contacts: NotionContact[]
): 'critical' | 'high' | 'medium' | 'low' {
  let priorityScore = 0;

  // Job's own BD priority
  if (typeof job.bd_priority === 'number') {
    priorityScore += job.bd_priority;
  }

  // Match quality
  priorityScore += matchScore / 2;

  // Program priority
  if (program?.bd_priority) {
    if (program.bd_priority.includes('Critical')) priorityScore += 40;
    else if (program.bd_priority.includes('High')) priorityScore += 25;
    else if (program.bd_priority.includes('Medium')) priorityScore += 10;
  }

  // DCGS relevance boost
  if (job.dcgs_relevance) priorityScore += 20;

  // Contact availability
  if (contacts.length > 0) {
    priorityScore += Math.min(contacts.length * 5, 25);
    // Executive contacts bonus
    if (contacts.some(c => c.tier <= 2)) priorityScore += 15;
  }

  // Clearance value
  if (job.clearance) {
    const clearance = job.clearance.toLowerCase();
    if (clearance.includes('poly')) priorityScore += 15;
    else if (clearance.includes('sci')) priorityScore += 12;
    else if (clearance.includes('top secret') || clearance.includes('ts')) priorityScore += 10;
    else if (clearance.includes('secret')) priorityScore += 5;
  }

  // Priority thresholds
  if (priorityScore >= 100) return 'critical';
  if (priorityScore >= 60) return 'high';
  if (priorityScore >= 30) return 'medium';
  return 'low';
}

/**
 * Generate suggested actions for an enriched job
 */
function generateSuggestedActions(
  job: NotionJob,
  program: NotionProgram | null,
  contacts: NotionContact[],
  priority: 'critical' | 'high' | 'medium' | 'low'
): string[] {
  const actions: string[] = [];

  // Priority-based urgency
  if (priority === 'critical') {
    actions.push('URGENT: Review and assign within 24 hours');
  }

  // Contact outreach
  if (contacts.length > 0) {
    const topContact = contacts[0];
    if (topContact.email) {
      actions.push(`Email ${topContact.name} (${topContact.title}) about opportunity`);
    } else if (topContact.phone) {
      actions.push(`Call ${topContact.name} (${topContact.title}) to discuss`);
    } else if (topContact.linkedin) {
      actions.push(`Connect with ${topContact.name} on LinkedIn`);
    }

    if (contacts.length > 1) {
      actions.push(`${contacts.length - 1} additional contacts available for outreach`);
    }
  } else {
    actions.push('Research and identify program contacts');
  }

  // Program-specific actions
  if (program) {
    if (program.hiring_velocity === 'High') {
      actions.push('High hiring velocity - prioritize candidate pipeline');
    }
    if (program.recompete_date) {
      const recompete = new Date(program.recompete_date);
      const now = new Date();
      const monthsUntil = (recompete.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsUntil <= 12 && monthsUntil > 0) {
        actions.push(`Recompete in ${Math.round(monthsUntil)} months - position early`);
      }
    }
  } else {
    actions.push('Research program details and prime contractors');
  }

  // Job-specific actions
  if (job.source_url) {
    actions.push('Review full job posting for requirements');
  }

  return actions;
}

/**
 * Enrich a single job with program matching and contacts
 */
export function enrichJob(
  job: NotionJob,
  programs: NotionProgram[],
  contacts: NotionContact[]
): EnrichedJob {
  // Match to program
  const match = matchJobToProgram(job, programs);
  const matchedProgram = match?.program || null;
  const matchScore = match?.score || 0;
  const matchReasons = match?.reasons || [];

  // Find related contacts
  const relatedContacts = matchedProgram
    ? findContactsForProgram(matchedProgram, contacts)
    : [];

  // Calculate BD priority
  const bdPriority = calculateBDPriority(job, matchScore, matchedProgram, relatedContacts);

  // Generate suggested actions
  const suggestedActions = generateSuggestedActions(job, matchedProgram, relatedContacts, bdPriority);

  return {
    job,
    matchedProgram,
    matchScore,
    matchReasons,
    relatedContacts,
    bdPriority,
    suggestedActions,
  };
}

/**
 * Enrich all jobs with program matching and contacts
 */
export function enrichAllJobs(
  jobs: NotionJob[],
  programs: NotionProgram[],
  contacts: NotionContact[]
): EnrichedJob[] {
  return jobs
    .map(job => enrichJob(job, programs, contacts))
    .sort((a, b) => {
      // Sort by priority first
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.bdPriority] - priorityOrder[b.bdPriority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by match score
      return b.matchScore - a.matchScore;
    });
}

/**
 * Get enrichment statistics
 */
export function getEnrichmentStats(enrichedJobs: EnrichedJob[]): {
  totalJobs: number;
  matchedToProgram: number;
  matchRate: number;
  withContacts: number;
  byPriority: Record<string, number>;
  topPrograms: Array<{ name: string; count: number }>;
} {
  const byPriority: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const programCounts: Record<string, number> = {};

  enrichedJobs.forEach(ej => {
    byPriority[ej.bdPriority]++;
    if (ej.matchedProgram) {
      const name = ej.matchedProgram.name;
      programCounts[name] = (programCounts[name] || 0) + 1;
    }
  });

  const topPrograms = Object.entries(programCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const matchedToProgram = enrichedJobs.filter(ej => ej.matchedProgram).length;
  const withContacts = enrichedJobs.filter(ej => ej.relatedContacts.length > 0).length;

  return {
    totalJobs: enrichedJobs.length,
    matchedToProgram,
    matchRate: enrichedJobs.length > 0 ? matchedToProgram / enrichedJobs.length : 0,
    withContacts,
    byPriority,
    topPrograms,
  };
}
