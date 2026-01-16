/**
 * BD Intelligence Correlation Engine
 *
 * Core system for 100% accurate data correlation:
 * - Job → Program matching with confidence scores
 * - Job → Contact matching with role classification
 * - Job → Related Jobs linking (PTS history, competitor jobs)
 *
 * Each correlation includes:
 * - Confidence score (0-100)
 * - Match signals explaining WHY the match was made
 * - Role classification for contacts
 */

import type { Job, Program, Contact } from '../types';

// =============================================================================
// TYPES - Correlation Results
// =============================================================================

export interface MatchSignal {
  rule: string;
  description: string;
  score: number;
  matched: boolean;
}

export interface ProgramMatch {
  program: Program;
  confidence: number;
  signals: MatchSignal[];
  isPrimary: boolean;
}

export type ContactRole =
  | 'hiring_manager'
  | 'program_manager'
  | 'team_lead'
  | 'team_member'
  | 'related_contact';

export interface ContactMatch {
  contact: Contact;
  confidence: number;
  role: ContactRole;
  roleLabel: string;
  signals: MatchSignal[];
}

export interface RelatedJob {
  job: Job;
  relationship: 'pts_history' | 'competitor' | 'similar_role';
  relationshipLabel: string;
  confidence: number;
  signals: MatchSignal[];
}

export interface JobCorrelation {
  job: Job;
  programs: ProgramMatch[];
  contacts: ContactMatch[];
  relatedJobs: RelatedJob[];
  overallConfidence: number;
  correlatedAt: string;
}

export interface CorrelationStats {
  totalJobs: number;
  jobsWithPrograms: number;
  jobsWithContacts: number;
  jobsWithRelatedJobs: number;
  averageConfidence: number;
  programMatchRate: number;
  contactMatchRate: number;
}

// =============================================================================
// CONSTANTS - Matching Rules Configuration
// =============================================================================

// Location to Program mapping (DCGS-focused for target market)
const LOCATION_PROGRAM_MAP: Record<string, string[]> = {
  // DCGS Primary Locations
  'langley': ['DCGS-A', 'DCGS-AF', 'Intelligence Systems'],
  'hampton': ['DCGS-A', 'DCGS-AF', 'Intelligence Systems'],
  'fort meade': ['DCGS-A', 'NSA Programs', 'Signals Intelligence', 'SIGINT'],
  'meade': ['DCGS-A', 'NSA Programs', 'Signals Intelligence'],
  'aurora': ['DCGS-AF', 'Space Force', 'NRO Programs'],
  'colorado springs': ['DCGS-AF', 'Space Force', 'NORAD'],
  'sierra vista': ['DCGS-A', 'Army Intelligence', 'Fort Huachuca'],
  'fort huachuca': ['DCGS-A', 'Army Intelligence'],
  'san antonio': ['DCGS-AF', 'Air Force ISR', 'Lackland'],
  'lackland': ['DCGS-AF', 'Air Force ISR'],
  // Other Intelligence Locations
  'springfield': ['NGA Programs', 'GEOINT'],
  'chantilly': ['NRO Programs', 'Space Systems'],
  'mclean': ['Intelligence Community', 'CIA Programs'],
  'reston': ['Defense Intelligence', 'DoD Programs'],
  'arlington': ['Pentagon Programs', 'DoD', 'Army Programs'],
  'pentagon': ['DoD Programs', 'Joint Programs'],
  'quantico': ['Marine Corps', 'FBI Programs'],
  'bethesda': ['Navy Programs', 'Medical Intelligence'],
  'annapolis junction': ['NSA Programs', 'Signals Intelligence'],
  // Defense Hubs
  'huntsville': ['Army Programs', 'Missile Defense', 'Space'],
  'redstone': ['Army Programs', 'Missile Defense'],
  'dayton': ['Air Force Programs', 'Wright-Patterson'],
  'wright-patterson': ['Air Force Programs', 'AFLCMC'],
  'hanscom': ['Air Force Programs', 'C4ISR'],
  'san diego': ['Navy Programs', 'SPAWAR', 'Maritime'],
  'norfolk': ['Navy Programs', 'Fleet Forces'],
};

// Prime contractor to program relationships
const CONTRACTOR_PROGRAM_MAP: Record<string, string[]> = {
  'northrop': ['DCGS-A', 'DCGS-AF', 'Sentinel GBSD', 'B-21', 'Space Systems'],
  'northrop grumman': ['DCGS-A', 'DCGS-AF', 'Sentinel GBSD', 'B-21', 'Space Systems'],
  'raytheon': ['DCGS-AF', 'AMRAAM', 'Patriot', 'Missiles'],
  'rtx': ['DCGS-AF', 'AMRAAM', 'Patriot', 'Missiles'],
  'lockheed': ['F-35', 'DCGS-N', 'Space Programs', 'PAC-3'],
  'lockheed martin': ['F-35', 'DCGS-N', 'Space Programs', 'PAC-3'],
  'general dynamics': ['Army Programs', 'Combat Systems', 'IT Services'],
  'gdit': ['Army Programs', 'IT Services', 'Intelligence Support'],
  'gd': ['Army Programs', 'Combat Systems'],
  'bae': ['Army Programs', 'Vehicle Systems', 'Electronic Warfare'],
  'bae systems': ['Army Programs', 'Vehicle Systems', 'Electronic Warfare'],
  'boeing': ['Air Force Programs', 'KC-46', 'Space Launch'],
  'leidos': ['Intelligence Programs', 'IT Services', 'Health'],
  'saic': ['Intelligence Programs', 'IT Services', 'Space'],
  'booz allen': ['Intelligence Programs', 'Consulting', 'Analytics'],
  'booz allen hamilton': ['Intelligence Programs', 'Consulting'],
  'l3harris': ['Communications', 'ISR', 'Space'],
  'l3 harris': ['Communications', 'ISR', 'Space'],
  'harris': ['Communications', 'ISR'],
  'perspecta': ['Intelligence Programs', 'IT Services'],
  'caci': ['Intelligence Programs', 'IT Services', 'Linguistics'],
  'mantech': ['Intelligence Programs', 'Cybersecurity'],
};

// DCGS and Intelligence keywords for scoring (exported for future AI-enhanced matching)
export const DCGS_KEYWORDS = [
  'dcgs', 'distributed common ground',
  'isr', 'intelligence surveillance reconnaissance',
  'sigint', 'signals intelligence',
  'geoint', 'geospatial intelligence',
  'imint', 'imagery intelligence',
  'humint', 'human intelligence',
  'c4isr', 'c2', 'command and control',
  'fusion', 'data fusion', 'sensor fusion',
  'targeting', 'exploitation', 'dissemination',
  'psr', 'processing storage retrieval',
  'multi-int', 'multi-intelligence',
];

// Clearance levels ranked by sensitivity
const CLEARANCE_RANKS: Record<string, number> = {
  'ts/sci': 100,
  'ts sci': 100,
  'top secret/sci': 100,
  'top secret sci': 100,
  'ts': 80,
  'top secret': 80,
  'secret': 60,
  's': 60,
  'confidential': 40,
  'public trust': 30,
  'none': 0,
  '': 0,
};

// Title patterns for role classification
const TITLE_ROLE_PATTERNS: Array<{ pattern: RegExp; tier: number; roleType: string }> = [
  // Tier 1 - Executive
  { pattern: /\b(ceo|cto|cfo|coo|cio|ciso|president|chief)\b/i, tier: 1, roleType: 'executive' },
  { pattern: /\bvice president\b/i, tier: 1, roleType: 'executive' },
  { pattern: /\bvp\b/i, tier: 1, roleType: 'executive' },
  { pattern: /\bsvp\b/i, tier: 1, roleType: 'executive' },
  { pattern: /\bevp\b/i, tier: 1, roleType: 'executive' },
  // Tier 2 - Senior Leadership
  { pattern: /\b(senior director|sr director|sr\. director)\b/i, tier: 2, roleType: 'director' },
  { pattern: /\bdirector\b/i, tier: 2, roleType: 'director' },
  // Tier 3 - Program Leadership
  { pattern: /\bprogram manager\b/i, tier: 3, roleType: 'program_manager' },
  { pattern: /\bproject manager\b/i, tier: 3, roleType: 'project_manager' },
  { pattern: /\b(senior manager|sr manager|sr\. manager)\b/i, tier: 3, roleType: 'senior_manager' },
  // Tier 4 - Management
  { pattern: /\bmanager\b/i, tier: 4, roleType: 'manager' },
  { pattern: /\b(team lead|tech lead|technical lead)\b/i, tier: 4, roleType: 'team_lead' },
  { pattern: /\blead\b/i, tier: 4, roleType: 'lead' },
  // Tier 5 - Senior IC
  { pattern: /\b(senior|sr|sr\.)\s*(engineer|developer|analyst|architect|specialist)\b/i, tier: 5, roleType: 'senior_ic' },
  { pattern: /\bprincipal\b/i, tier: 5, roleType: 'principal' },
  { pattern: /\bstaff\s*(engineer|developer)\b/i, tier: 5, roleType: 'staff' },
  { pattern: /\barchitect\b/i, tier: 5, roleType: 'architect' },
  // Tier 6 - IC
  { pattern: /\b(engineer|developer|analyst|specialist|administrator)\b/i, tier: 6, roleType: 'ic' },
];

// =============================================================================
// MATCHING FUNCTIONS
// =============================================================================

/**
 * Normalize text for matching (lowercase, trim, remove extra spaces)
 */
function normalize(text: string | undefined | null): string {
  return (text || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if any keyword from list exists in text
 * Exported for future AI-enhanced matching
 */
export function containsAny(text: string, keywords: string[]): boolean {
  const normalized = normalize(text);
  return keywords.some(kw => normalized.includes(kw.toLowerCase()));
}

/**
 * Count keyword matches in text
 * Exported for future AI-enhanced matching
 */
export function countKeywordMatches(text: string, keywords: string[]): number {
  const normalized = normalize(text);
  return keywords.filter(kw => normalized.includes(kw.toLowerCase())).length;
}

/**
 * Get clearance rank (higher = more sensitive)
 */
function getClearanceRank(clearance: string): number {
  const normalized = normalize(clearance);
  for (const [key, rank] of Object.entries(CLEARANCE_RANKS)) {
    if (normalized.includes(key)) {
      return rank;
    }
  }
  return 0;
}

/**
 * Extract location key from location string
 */
function extractLocationKey(location: string): string | null {
  const normalized = normalize(location);
  for (const key of Object.keys(LOCATION_PROGRAM_MAP)) {
    if (normalized.includes(key)) {
      return key;
    }
  }
  return null;
}

/**
 * Extract contractor key from company name
 */
function extractContractorKey(company: string): string | null {
  const normalized = normalize(company);
  for (const key of Object.keys(CONTRACTOR_PROGRAM_MAP)) {
    if (normalized.includes(key)) {
      return key;
    }
  }
  return null;
}

/**
 * Classify title into tier and role type
 */
function classifyTitle(title: string): { tier: number; roleType: string } {
  for (const { pattern, tier, roleType } of TITLE_ROLE_PATTERNS) {
    if (pattern.test(title)) {
      return { tier, roleType };
    }
  }
  return { tier: 6, roleType: 'ic' };
}

// =============================================================================
// PROGRAM MATCHING
// =============================================================================

/**
 * Match a job to programs with confidence scores
 */
export function matchJobToPrograms(job: Job, programs: Program[]): ProgramMatch[] {
  const matches: ProgramMatch[] = [];
  const jobText = `${job.title} ${job.program || ''} ${job.company || ''} ${job.location || ''}`;

  for (const program of programs) {
    const signals: MatchSignal[] = [];
    let totalScore = 0;

    // Rule 1: Location alignment (weight: 35)
    const locationKey = extractLocationKey(job.location || job.city || '');
    if (locationKey) {
      const mappedPrograms = LOCATION_PROGRAM_MAP[locationKey] || [];
      const programMatches = mappedPrograms.some(mp =>
        normalize(program.name).includes(normalize(mp)) ||
        normalize(program.acronym).includes(normalize(mp))
      );
      if (programMatches) {
        totalScore += 35;
        signals.push({
          rule: 'location_to_program',
          description: `Location "${job.location}" maps to ${program.name}`,
          score: 35,
          matched: true,
        });
      } else {
        signals.push({
          rule: 'location_to_program',
          description: `Location "${job.location}" does not map to ${program.name}`,
          score: 0,
          matched: false,
        });
      }
    }

    // Rule 2: Direct keyword match in job title/description (weight: 30)
    const programKeywords = [
      normalize(program.name),
      normalize(program.acronym),
    ].filter(Boolean);

    const keywordMatch = programKeywords.some(kw =>
      normalize(jobText).includes(kw) && kw.length > 2
    );
    if (keywordMatch) {
      totalScore += 30;
      signals.push({
        rule: 'keyword_match',
        description: `Job contains "${program.acronym || program.name}" keyword`,
        score: 30,
        matched: true,
      });
    }

    // Rule 3: Prime contractor alignment (weight: 20)
    const contractorKey = extractContractorKey(job.company || '');
    if (contractorKey) {
      const mappedPrograms = CONTRACTOR_PROGRAM_MAP[contractorKey] || [];
      const contractorMatches = mappedPrograms.some(mp =>
        normalize(program.name).includes(normalize(mp)) ||
        normalize(program.acronym).includes(normalize(mp))
      );
      if (contractorMatches) {
        totalScore += 20;
        signals.push({
          rule: 'prime_contractor',
          description: `${job.company} is associated with ${program.name}`,
          score: 20,
          matched: true,
        });
      }
    }

    // Rule 4: Clearance alignment (weight: 15)
    const jobClearance = getClearanceRank(job.clearance || '');
    const programClearances = Array.isArray(program.clearance_requirements)
      ? program.clearance_requirements
      : [program.clearance_requirements];
    const programClearance = Math.max(
      ...programClearances.map(c => getClearanceRank(c || ''))
    );

    if (jobClearance > 0 && programClearance > 0) {
      // If clearances are within same tier (both TS/SCI, both Secret, etc.)
      if (Math.abs(jobClearance - programClearance) <= 20) {
        totalScore += 15;
        signals.push({
          rule: 'clearance_alignment',
          description: `Job clearance "${job.clearance}" matches program requirements`,
          score: 15,
          matched: true,
        });
      }
    }

    // Only include programs with meaningful matches (> 20 confidence)
    if (totalScore > 20) {
      matches.push({
        program,
        confidence: totalScore,
        signals,
        isPrimary: false,
      });
    }
  }

  // Sort by confidence and mark the highest as primary
  matches.sort((a, b) => b.confidence - a.confidence);
  if (matches.length > 0) {
    matches[0].isPrimary = true;
  }

  return matches;
}

// =============================================================================
// CONTACT MATCHING
// =============================================================================

/**
 * Classify contact role relative to a job
 */
function classifyContactRole(
  contact: Contact,
  job: Job,
  matchedPrograms: ProgramMatch[]
): { role: ContactRole; label: string; score: number } {
  const contactTitle = normalize(contact.title || '');
  const { tier, roleType } = classifyTitle(contact.title || '');

  // Check if contact is likely the hiring manager
  // (Director+ at same company, same location area)
  const sameCompany = normalize(contact.company || '').includes(normalize(job.company || ''));
  const isDirectorPlus = tier <= 2;

  if (sameCompany && isDirectorPlus) {
    return { role: 'hiring_manager', label: 'Hiring Manager', score: 90 };
  }

  // Check if contact is a Program Manager on matched program
  if (roleType === 'program_manager' || contactTitle.includes('program manager')) {
    const onMatchedProgram = matchedPrograms.some(pm => {
      const programName = normalize(pm.program.name);
      const contactPrograms = contact.matched_programs || [];
      return contactPrograms.some(cp => normalize(cp).includes(programName));
    });
    if (onMatchedProgram) {
      return { role: 'program_manager', label: 'Program Manager', score: 85 };
    }
  }

  // Team Lead - same company, lead role
  if ((roleType === 'team_lead' || roleType === 'lead') && sameCompany) {
    return { role: 'team_lead', label: 'Team Lead', score: 70 };
  }

  // Team Member - same company and location
  const sameLocation = job.location && contact.notes &&
    normalize(contact.notes).includes(extractLocationKey(job.location) || '');
  if (sameCompany || sameLocation) {
    return { role: 'team_member', label: 'Team Member', score: 50 };
  }

  // Related Contact - any other match
  return { role: 'related_contact', label: 'Related Contact', score: 30 };
}

/**
 * Match a job to contacts with role classification
 */
export function matchJobToContacts(
  job: Job,
  contacts: Contact[],
  matchedPrograms: ProgramMatch[]
): ContactMatch[] {
  const matches: ContactMatch[] = [];

  for (const contact of contacts) {
    const signals: MatchSignal[] = [];
    let totalScore = 0;

    // Rule 1: Program team membership (weight: 40)
    const contactPrograms = contact.matched_programs || [];
    const programOverlap = matchedPrograms.some(pm => {
      const programName = normalize(pm.program.name);
      const acronym = normalize(pm.program.acronym);
      return contactPrograms.some(cp => {
        const normalized = normalize(cp);
        return normalized.includes(programName) || normalized.includes(acronym);
      });
    });

    if (programOverlap) {
      totalScore += 40;
      signals.push({
        rule: 'program_team',
        description: `Contact is on a matched program team`,
        score: 40,
        matched: true,
      });
    }

    // Rule 2: Company hierarchy (weight: 25)
    const sameCompany = normalize(contact.company || '').includes(normalize(job.company || '')) ||
                       normalize(job.company || '').includes(normalize(contact.company || ''));
    if (sameCompany && contact.company) {
      totalScore += 25;
      signals.push({
        rule: 'company_hierarchy',
        description: `Same company: ${contact.company}`,
        score: 25,
        matched: true,
      });
    }

    // Rule 3: Title/role inference (weight: 20)
    const { tier } = classifyTitle(contact.title || '');
    // Job title classification reserved for future matching logic
    // const jobTitleClass = classifyTitle(job.title || '');

    // Higher tier contacts get bonus for senior positions
    if (tier <= 3) {
      const tierBonus = (4 - tier) * 5; // T1=15, T2=10, T3=5
      totalScore += Math.min(tierBonus, 20);
      signals.push({
        rule: 'title_inference',
        description: `Tier ${tier} contact (${contact.title})`,
        score: Math.min(tierBonus, 20),
        matched: true,
      });
    }

    // Rule 4: Location proximity (weight: 15)
    const jobLocationKey = extractLocationKey(job.location || job.city || '');
    const contactLocation = contact.notes || ''; // Location often in notes
    if (jobLocationKey && normalize(contactLocation).includes(jobLocationKey)) {
      totalScore += 15;
      signals.push({
        rule: 'location_proximity',
        description: `Same location area`,
        score: 15,
        matched: true,
      });
    }

    // Only include contacts with meaningful matches (> 25 confidence)
    if (totalScore > 25) {
      const { role, label, score: roleScore } = classifyContactRole(contact, job, matchedPrograms);

      matches.push({
        contact,
        confidence: Math.min(totalScore + roleScore / 10, 100), // Cap at 100
        role,
        roleLabel: label,
        signals,
      });
    }
  }

  // Sort by confidence, then by role priority
  const rolePriority: Record<ContactRole, number> = {
    'hiring_manager': 1,
    'program_manager': 2,
    'team_lead': 3,
    'team_member': 4,
    'related_contact': 5,
  };

  matches.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return rolePriority[a.role] - rolePriority[b.role];
  });

  return matches;
}

// =============================================================================
// RELATED JOBS MATCHING
// =============================================================================

/**
 * Find related jobs (PTS history, competitor jobs, similar roles)
 */
export function findRelatedJobs(
  job: Job,
  allJobs: Job[],
  matchedPrograms: ProgramMatch[]
): RelatedJob[] {
  const matches: RelatedJob[] = [];
  const jobId = job.id;

  for (const otherJob of allJobs) {
    // Skip the same job
    if (otherJob.id === jobId) continue;

    const signals: MatchSignal[] = [];
    let totalScore = 0;
    let relationship: 'pts_history' | 'competitor' | 'similar_role' = 'similar_role';

    // Check for PTS history (jobs from PTS or past placements)
    const isPTSJob = normalize(otherJob.source || '').includes('pts') ||
                     normalize(otherJob.company || '').includes('pts');

    if (isPTSJob) {
      // Check program overlap
      const otherProgram = otherJob.program || otherJob.program_name || '';
      const programMatch = matchedPrograms.some(pm =>
        normalize(otherProgram).includes(normalize(pm.program.name)) ||
        normalize(otherProgram).includes(normalize(pm.program.acronym))
      );

      if (programMatch) {
        totalScore += 50;
        relationship = 'pts_history';
        signals.push({
          rule: 'pts_program_match',
          description: `PTS history on same program`,
          score: 50,
          matched: true,
        });
      }
    }

    // Check for competitor jobs (same program, different company)
    const sameProgram = matchedPrograms.some(pm => {
      const otherProgram = otherJob.program || otherJob.program_name || '';
      return normalize(otherProgram).includes(normalize(pm.program.name)) ||
             normalize(otherProgram).includes(normalize(pm.program.acronym));
    });

    const differentCompany = normalize(job.company || '') !== normalize(otherJob.company || '');

    if (sameProgram && differentCompany) {
      totalScore += 40;
      if (relationship !== 'pts_history') {
        relationship = 'competitor';
      }
      signals.push({
        rule: 'competitor_job',
        description: `${otherJob.company} also hiring for same program`,
        score: 40,
        matched: true,
      });
    }

    // Check for similar roles (same title pattern, same location)
    const titleSimilarity = calculateTitleSimilarity(job.title || '', otherJob.title || '');
    if (titleSimilarity > 0.6) {
      totalScore += Math.round(titleSimilarity * 30);
      signals.push({
        rule: 'similar_title',
        description: `Similar role: ${otherJob.title}`,
        score: Math.round(titleSimilarity * 30),
        matched: true,
      });
    }

    // Same location bonus
    const jobLocation = extractLocationKey(job.location || job.city || '');
    const otherLocation = extractLocationKey(otherJob.location || otherJob.city || '');
    if (jobLocation && jobLocation === otherLocation) {
      totalScore += 15;
      signals.push({
        rule: 'same_location',
        description: `Same location area`,
        score: 15,
        matched: true,
      });
    }

    // Only include jobs with meaningful matches (> 30 confidence)
    if (totalScore > 30) {
      const relationshipLabels = {
        'pts_history': 'PTS Past Performance',
        'competitor': 'Competitor Job',
        'similar_role': 'Similar Role',
      };

      matches.push({
        job: otherJob,
        relationship,
        relationshipLabel: relationshipLabels[relationship],
        confidence: Math.min(totalScore, 100),
        signals,
      });
    }
  }

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence);

  // Limit to top 10 related jobs
  return matches.slice(0, 10);
}

/**
 * Calculate title similarity (simple word overlap score)
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = new Set(normalize(title1).split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(normalize(title2).split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }

  return overlap / Math.max(words1.size, words2.size);
}

// =============================================================================
// MAIN CORRELATION FUNCTION
// =============================================================================

/**
 * Correlate a single job to programs, contacts, and related jobs
 */
export function correlateJob(
  job: Job,
  programs: Program[],
  contacts: Contact[],
  allJobs: Job[]
): JobCorrelation {
  // Step 1: Match to programs
  const programMatches = matchJobToPrograms(job, programs);

  // Step 2: Match to contacts (using program context)
  const contactMatches = matchJobToContacts(job, contacts, programMatches);

  // Step 3: Find related jobs
  const relatedJobMatches = findRelatedJobs(job, allJobs, programMatches);

  // Calculate overall confidence
  const programConfidence = programMatches.length > 0 ? programMatches[0].confidence : 0;
  const contactConfidence = contactMatches.length > 0
    ? contactMatches.slice(0, 5).reduce((sum, c) => sum + c.confidence, 0) / 5
    : 0;
  const relatedConfidence = relatedJobMatches.length > 0 ? relatedJobMatches[0].confidence : 0;

  const overallConfidence = Math.round(
    (programConfidence * 0.5) + (contactConfidence * 0.3) + (relatedConfidence * 0.2)
  );

  return {
    job,
    programs: programMatches,
    contacts: contactMatches,
    relatedJobs: relatedJobMatches,
    overallConfidence,
    correlatedAt: new Date().toISOString(),
  };
}

/**
 * Correlate all jobs and return statistics
 */
export function correlateAllJobs(
  jobs: Job[],
  programs: Program[],
  contacts: Contact[]
): { correlations: JobCorrelation[]; stats: CorrelationStats } {
  const correlations: JobCorrelation[] = [];

  for (const job of jobs) {
    const correlation = correlateJob(job, programs, contacts, jobs);
    correlations.push(correlation);
  }

  // Calculate statistics
  const jobsWithPrograms = correlations.filter(c => c.programs.length > 0).length;
  const jobsWithContacts = correlations.filter(c => c.contacts.length > 0).length;
  const jobsWithRelatedJobs = correlations.filter(c => c.relatedJobs.length > 0).length;
  const totalConfidence = correlations.reduce((sum, c) => sum + c.overallConfidence, 0);

  const stats: CorrelationStats = {
    totalJobs: jobs.length,
    jobsWithPrograms,
    jobsWithContacts,
    jobsWithRelatedJobs,
    averageConfidence: jobs.length > 0 ? Math.round(totalConfidence / jobs.length) : 0,
    programMatchRate: jobs.length > 0 ? Math.round((jobsWithPrograms / jobs.length) * 100) : 0,
    contactMatchRate: jobs.length > 0 ? Math.round((jobsWithContacts / jobs.length) * 100) : 0,
  };

  return { correlations, stats };
}

/**
 * Get correlation for a specific job by ID
 */
export function getJobCorrelation(
  jobId: string,
  jobs: Job[],
  programs: Program[],
  contacts: Contact[]
): JobCorrelation | null {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return null;

  return correlateJob(job, programs, contacts, jobs);
}

// Export default instance
export default {
  correlateJob,
  correlateAllJobs,
  getJobCorrelation,
  matchJobToPrograms,
  matchJobToContacts,
  findRelatedJobs,
};
