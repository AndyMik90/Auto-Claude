/**
 * Persona-related types
 */

// ============================================
// Core Persona Types
// ============================================

export type PersonaType = 'primary' | 'secondary' | 'edge-case';
export type PersonaConfidence = 'high' | 'medium' | 'low';
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'lead' | 'executive';
export type CompanySize = 'startup' | 'small' | 'medium' | 'enterprise';
export type UsageFrequency = 'daily' | 'weekly' | 'monthly' | 'occasionally';
export type GoalPriority = 'must-have' | 'should-have' | 'nice-to-have';
export type PainPointSeverity = 'high' | 'medium' | 'low';

export interface PersonaAvatar {
  initials: string;
  color: string; // Hex color for display
}

export interface PersonaDemographics {
  role: string; // Job title
  experienceLevel: ExperienceLevel;
  industry?: string;
  companySize?: CompanySize;
}

export interface PersonaGoal {
  id: string;
  description: string;
  priority: GoalPriority;
}

export interface PersonaPainPoint {
  id: string;
  description: string;
  severity: PainPointSeverity;
  currentWorkaround?: string;
}

export interface PersonaBehaviors {
  usageFrequency: UsageFrequency;
  preferredChannels: string[]; // CLI, API, Dashboard, etc.
  decisionFactors: string[];
  toolStack: string[];
}

export interface PersonaScenario {
  id: string;
  title: string;
  context: string;
  action: string;
  outcome: string;
}

export interface PersonaFeaturePreferences {
  mustHave: string[];
  niceToHave: string[];
  avoid: string[];
}

export interface PersonaDiscoverySource {
  userTypeId: string;
  confidence: PersonaConfidence;
  researchEnriched: boolean;
}

export interface Persona {
  id: string;
  name: string; // e.g., "Alex the API Developer"
  type: PersonaType;
  tagline: string;

  avatar: PersonaAvatar;
  demographics: PersonaDemographics;
  goals: PersonaGoal[];
  painPoints: PersonaPainPoint[];
  behaviors: PersonaBehaviors;
  quotes: string[]; // Realistic quotes this persona might say
  scenarios: PersonaScenario[];
  featurePreferences: PersonaFeaturePreferences;
  discoverySource: PersonaDiscoverySource;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// Personas Config (File Format)
// ============================================

export interface PersonasMetadata {
  generatedAt: string;
  discoverySynced: boolean;
  researchEnriched: boolean;
  roadmapSynced: boolean;
  personaCount: number;
}

export interface PersonasConfig {
  version: '1.0';
  projectId: string;
  personas: Persona[];
  metadata: PersonasMetadata;
}

// ============================================
// Persona Generation Status
// ============================================

export type PersonaGenerationPhase =
  | 'idle'
  | 'analyzing'
  | 'discovering'
  | 'researching'
  | 'generating'
  | 'complete'
  | 'error';

export interface PersonaGenerationStatus {
  phase: PersonaGenerationPhase;
  progress: number; // 0-100
  message: string;
  error?: string;
}

// ============================================
// Persona Discovery Types (intermediate format)
// ============================================

export interface DiscoveredUserTypeEvidence {
  readyMentions: string[];
  codePatterns: string[];
  documentationHints: string[];
  roadmapAlignment: string[];
}

export interface DiscoveredUserTypeCharacteristics {
  technicalLevel: string;
  likelyRole: string;
  usageFrequency: UsageFrequency;
  primaryGoal: string;
  keyPainPoints: string[];
}

export interface DiscoveredUserType {
  id: string;
  suggestedName: string;
  category: PersonaType;
  confidence: PersonaConfidence;
  evidence: DiscoveredUserTypeEvidence;
  inferredCharacteristics: DiscoveredUserTypeCharacteristics;
  featureRelevance: string[];
}

export interface PersonaDiscoveryResult {
  projectName: string;
  identifiedUserTypes: DiscoveredUserType[];
  discoverySources: {
    readmeAnalyzed: boolean;
    docsAnalyzed: boolean;
    codeAnalyzed: boolean;
    roadmapSynced: boolean;
    roadmapTargetAudience: string | null;
  };
  recommendedPersonaCount: number;
  createdAt: string;
}

// ============================================
// Persona Research Types (optional enrichment)
// ============================================

export interface IndustryInsights {
  commonJobTitles: string[];
  typicalCompanyTypes: string[];
  salaryRange: string;
  careerProgression: string;
  industryTrends: string[];
}

export interface BehaviorPatterns {
  toolPreferences: string[];
  learningResources: string[];
  communityParticipation: string[];
  decisionFactors: string[];
}

export interface PainPointValidation {
  originalPainPoint: string;
  validationStatus: 'confirmed' | 'partially_confirmed' | 'unconfirmed';
  supportingEvidence: string;
  additionalContext: string;
}

export interface DiscoveredPainPoint {
  description: string;
  severity: PainPointSeverity;
  source: string;
  relevanceToProject: string;
}

export interface ResearchQuote {
  quote: string;
  source: string;
  sentiment: 'frustrated' | 'satisfied' | 'neutral';
  relevance: string;
}

export interface CompetitiveUsage {
  alternativesUsed: string[];
  switchingTriggers: string[];
  loyaltyFactors: string[];
}

export interface UserTypeEnrichment {
  userTypeId: string;
  industryInsights: IndustryInsights;
  behaviorPatterns: BehaviorPatterns;
  painPointValidation: PainPointValidation[];
  discoveredPainPoints: DiscoveredPainPoint[];
  quotesFound: ResearchQuote[];
  competitiveUsage: CompetitiveUsage;
}

export interface MarketContext {
  totalAddressableMarket: string;
  growthTrends: string[];
  emergingNeeds: string[];
}

export interface ResearchSource {
  type: 'web_search' | 'forum' | 'article' | 'survey' | 'documentation';
  queryOrUrl: string;
  relevance: string;
}

export interface PersonaResearchResult {
  researchCompletedAt: string;
  userTypeEnrichments: UserTypeEnrichment[];
  marketContext: MarketContext | null;
  researchSources: ResearchSource[];
  researchLimitations: string[];
}

// ============================================
// Task Integration Types
// ============================================

export interface PersonaAlignment {
  personaId: string;
  goalIds?: string[]; // Which goals this addresses
  painPointIds?: string[]; // Which pain points this solves
}

// For extending TaskMetadata in task.ts
export interface TaskPersonaMetadata {
  targetPersonaIds?: string[];
  personaAlignment?: PersonaAlignment[];
}
