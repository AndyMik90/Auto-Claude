/**
 * Methodology Phase Configuration Types
 *
 * Defines phase configurations for different methodologies (Native, BMAD).
 * Used by MethodologyProgressIndicator to display phase-specific progress.
 *
 * @module types/methodology-phases
 */

/**
 * Status of a methodology phase during execution
 */
export type MethodologyPhaseStatus =
  | 'pending'    // Phase has not started
  | 'active'     // Phase is currently executing
  | 'completed'  // Phase finished successfully
  | 'skipped'    // Phase was skipped (e.g., due to complexity level)
  | 'failed';    // Phase encountered an error

/**
 * Configuration for a single methodology phase
 */
export interface MethodologyPhaseConfig {
  /** Unique identifier for the phase */
  id: string;
  /** Translation key for the phase label (i18n) */
  labelKey: string;
  /** Phase color for progress indicator (Tailwind class) */
  color: string;
  /** Background color with opacity (Tailwind class) */
  bgColor: string;
  /** Order in the phase sequence (0-based) */
  order: number;
  /** Whether this phase is optional (can be skipped based on complexity) */
  optional?: boolean;
  /** Description translation key for tooltips */
  descriptionKey?: string;
}

/**
 * Phase progress information during execution
 */
export interface MethodologyPhaseProgress {
  /** Phase identifier */
  phaseId: string;
  /** Current status */
  status: MethodologyPhaseStatus;
  /** Progress percentage within this phase (0-100) */
  progress: number;
  /** Optional message describing current activity */
  message?: string;
  /** Timestamp when phase started */
  startedAt?: string;
  /** Timestamp when phase completed */
  completedAt?: string;
}

/**
 * Complete methodology configuration
 */
export interface MethodologyConfig {
  /** Unique identifier for the methodology */
  id: string;
  /** Human-readable name */
  name: string;
  /** Translation key for methodology name */
  nameKey: string;
  /** Ordered list of phases */
  phases: MethodologyPhaseConfig[];
  /** Supported complexity levels */
  complexityLevels: ('quick' | 'standard' | 'complex')[];
  /** Phases to skip for each complexity level */
  complexitySkips?: Record<string, string[]>;
}

// ============================================================================
// Native Methodology Phases
// ============================================================================

/**
 * Phase identifiers for Native Auto Claude methodology
 */
export type NativePhaseId =
  | 'idle'
  | 'planning'
  | 'coding'
  | 'qa_review'
  | 'qa_fixing'
  | 'complete'
  | 'failed';

/**
 * Native methodology phase configurations
 * Follows the existing PHASE_COLORS pattern from PhaseProgressIndicator.tsx
 */
export const NATIVE_PHASES: MethodologyPhaseConfig[] = [
  {
    id: 'idle',
    labelKey: 'tasks:execution.phases.idle',
    color: 'bg-muted-foreground',
    bgColor: 'bg-muted',
    order: 0,
    descriptionKey: 'tasks:execution.phaseDescriptions.idle',
  },
  {
    id: 'planning',
    labelKey: 'tasks:execution.phases.planning',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-500/20',
    order: 1,
    descriptionKey: 'tasks:execution.phaseDescriptions.planning',
  },
  {
    id: 'coding',
    labelKey: 'tasks:execution.phases.coding',
    color: 'bg-info',
    bgColor: 'bg-info/20',
    order: 2,
    descriptionKey: 'tasks:execution.phaseDescriptions.coding',
  },
  {
    id: 'qa_review',
    labelKey: 'tasks:execution.phases.reviewing',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-500/20',
    order: 3,
    descriptionKey: 'tasks:execution.phaseDescriptions.reviewing',
  },
  {
    id: 'qa_fixing',
    labelKey: 'tasks:execution.phases.fixing',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-500/20',
    order: 4,
    descriptionKey: 'tasks:execution.phaseDescriptions.fixing',
  },
  {
    id: 'complete',
    labelKey: 'tasks:execution.phases.complete',
    color: 'bg-success',
    bgColor: 'bg-success/20',
    order: 5,
    descriptionKey: 'tasks:execution.phaseDescriptions.complete',
  },
  {
    id: 'failed',
    labelKey: 'tasks:execution.phases.failed',
    color: 'bg-destructive',
    bgColor: 'bg-destructive/20',
    order: 99,
    descriptionKey: 'tasks:execution.phaseDescriptions.failed',
  },
];

// ============================================================================
// BMAD Methodology Phases
// ============================================================================

/**
 * Phase identifiers for BMAD methodology
 * Matches the 7 phases defined in apps/backend/methodologies/bmad/manifest.yaml
 */
export type BMADPhaseId =
  | 'analyze'
  | 'prd'
  | 'architecture'
  | 'epics'
  | 'stories'
  | 'dev'
  | 'review';

/**
 * BMAD methodology phase configurations
 * 7-phase structured development process
 */
export const BMAD_PHASES: MethodologyPhaseConfig[] = [
  {
    id: 'analyze',
    labelKey: 'artifacts:phases.bmad.analyze',
    color: 'bg-cyan-500',
    bgColor: 'bg-cyan-500/20',
    order: 0,
    descriptionKey: 'artifacts:phases.bmad.analyzeDescription',
  },
  {
    id: 'prd',
    labelKey: 'artifacts:phases.bmad.prd',
    color: 'bg-violet-500',
    bgColor: 'bg-violet-500/20',
    order: 1,
    optional: true, // Skipped in Quick complexity
    descriptionKey: 'artifacts:phases.bmad.prdDescription',
  },
  {
    id: 'architecture',
    labelKey: 'artifacts:phases.bmad.architecture',
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-500/20',
    order: 2,
    optional: true, // Skipped in Quick complexity
    descriptionKey: 'artifacts:phases.bmad.architectureDescription',
  },
  {
    id: 'epics',
    labelKey: 'artifacts:phases.bmad.epics',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-500/20',
    order: 3,
    descriptionKey: 'artifacts:phases.bmad.epicsDescription',
  },
  {
    id: 'stories',
    labelKey: 'artifacts:phases.bmad.stories',
    color: 'bg-teal-500',
    bgColor: 'bg-teal-500/20',
    order: 4,
    descriptionKey: 'artifacts:phases.bmad.storiesDescription',
  },
  {
    id: 'dev',
    labelKey: 'artifacts:phases.bmad.dev',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-500/20',
    order: 5,
    descriptionKey: 'artifacts:phases.bmad.devDescription',
  },
  {
    id: 'review',
    labelKey: 'artifacts:phases.bmad.review',
    color: 'bg-rose-500',
    bgColor: 'bg-rose-500/20',
    order: 6,
    descriptionKey: 'artifacts:phases.bmad.reviewDescription',
  },
];

// ============================================================================
// Methodology Configurations
// ============================================================================

/**
 * Native Auto Claude methodology configuration
 */
export const NATIVE_METHODOLOGY: MethodologyConfig = {
  id: 'native',
  name: 'Native Auto Claude',
  nameKey: 'methodology:native.name',
  phases: NATIVE_PHASES,
  complexityLevels: ['quick', 'standard', 'complex'],
};

/**
 * BMAD methodology configuration
 * Quick complexity skips PRD and Architecture phases
 */
export const BMAD_METHODOLOGY: MethodologyConfig = {
  id: 'bmad',
  name: 'BMAD Method',
  nameKey: 'methodology:bmad.name',
  phases: BMAD_PHASES,
  complexityLevels: ['quick', 'standard', 'complex'],
  complexitySkips: {
    quick: ['prd', 'architecture'],
    standard: [],
    complex: [],
  },
};

/**
 * All available methodology configurations
 */
export const METHODOLOGY_CONFIGS: Record<string, MethodologyConfig> = {
  native: NATIVE_METHODOLOGY,
  bmad: BMAD_METHODOLOGY,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get methodology configuration by ID
 */
export function getMethodologyConfig(methodologyId: string): MethodologyConfig | undefined {
  return METHODOLOGY_CONFIGS[methodologyId];
}

/**
 * Get phase configuration by methodology and phase ID
 */
export function getPhaseConfig(
  methodologyId: string,
  phaseId: string
): MethodologyPhaseConfig | undefined {
  const methodology = getMethodologyConfig(methodologyId);
  if (!methodology) return undefined;
  return methodology.phases.find((p) => p.id === phaseId);
}

/**
 * Get enabled phases for a methodology at a given complexity level
 */
export function getEnabledPhases(
  methodologyId: string,
  complexity: 'quick' | 'standard' | 'complex' = 'standard'
): MethodologyPhaseConfig[] {
  const methodology = getMethodologyConfig(methodologyId);
  if (!methodology) return [];

  const skippedPhases = methodology.complexitySkips?.[complexity] || [];
  return methodology.phases.filter((phase) => !skippedPhases.includes(phase.id));
}

/**
 * Check if a phase is enabled for a given complexity level
 */
export function isPhaseEnabled(
  methodologyId: string,
  phaseId: string,
  complexity: 'quick' | 'standard' | 'complex' = 'standard'
): boolean {
  const methodology = getMethodologyConfig(methodologyId);
  if (!methodology) return false;

  const skippedPhases = methodology.complexitySkips?.[complexity] || [];
  return !skippedPhases.includes(phaseId);
}

/**
 * Calculate overall progress based on phase progress
 */
export function calculateOverallProgress(
  methodologyId: string,
  phaseProgress: MethodologyPhaseProgress[],
  complexity: 'quick' | 'standard' | 'complex' = 'standard'
): number {
  const enabledPhases = getEnabledPhases(methodologyId, complexity);
  if (enabledPhases.length === 0) return 0;

  const totalProgress = phaseProgress.reduce((sum, pp) => {
    const phase = enabledPhases.find((p) => p.id === pp.phaseId);
    if (!phase) return sum;

    // Completed phases count as 100%
    if (pp.status === 'completed') return sum + 100;
    // Active phases contribute their progress
    if (pp.status === 'active') return sum + pp.progress;
    // Pending/failed phases contribute 0%
    return sum;
  }, 0);

  return Math.round(totalProgress / enabledPhases.length);
}

/**
 * Get the current active phase from progress array
 */
export function getCurrentPhase(
  phaseProgress: MethodologyPhaseProgress[]
): MethodologyPhaseProgress | undefined {
  return phaseProgress.find((pp) => pp.status === 'active');
}

/**
 * Check if all phases are complete
 */
export function isMethodologyComplete(
  methodologyId: string,
  phaseProgress: MethodologyPhaseProgress[],
  complexity: 'quick' | 'standard' | 'complex' = 'standard'
): boolean {
  const enabledPhases = getEnabledPhases(methodologyId, complexity);
  return enabledPhases.every((phase) => {
    const progress = phaseProgress.find((pp) => pp.phaseId === phase.id);
    return progress?.status === 'completed' || progress?.status === 'skipped';
  });
}

/**
 * Check if any phase has failed
 */
export function hasMethodologyFailed(
  phaseProgress: MethodologyPhaseProgress[]
): boolean {
  return phaseProgress.some((pp) => pp.status === 'failed');
}
