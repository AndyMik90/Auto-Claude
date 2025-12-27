/**
 * Wizard Step Registry
 *
 * Central registry for all wizard steps. Steps are automatically collected
 * and sorted by priority. The wizard UI reads from this registry to render
 * the appropriate steps.
 *
 * AUTO-DISCOVERY PATTERN:
 * When adding a new step, simply:
 * 1. Import your step definition here
 * 2. Add it to the STEP_DEFINITIONS array
 *
 * The registry handles:
 * - Sorting by priority
 * - Filtering by conditions
 * - Deduplication by ID
 * - Lazy loading of components
 */

import { lazy } from 'react';
import type {
  WizardStepDefinition,
  StepConditionContext,
  WizardConfig
} from './wizard-step.schema';
import { STEP_PRIORITIES, defineWizardStep } from './wizard-step.schema';

// ============================================================================
// STEP DEFINITIONS
// Add new steps here - they will be automatically included in the wizard
// ============================================================================

/**
 * Welcome Step - First step in the wizard
 */
const welcomeStep = defineWizardStep({
  id: 'welcome',
  priority: STEP_PRIORITIES.WELCOME,
  translationKey: 'steps.welcome',
  component: lazy(() => import('./WelcomeStep').then(m => ({ default: m.WelcomeStep }))),
  category: 'welcome',
  showInProgress: false, // Welcome step doesn't show in progress bar
  skippable: false,
  addedInVersion: '1.0.0'
});

/**
 * OAuth Step - Claude authentication
 */
const oauthStep = defineWizardStep({
  id: 'oauth',
  priority: STEP_PRIORITIES.OAUTH,
  translationKey: 'steps.auth',
  component: lazy(() => import('./OAuthStep').then(m => ({ default: m.OAuthStep }))),
  category: 'auth',
  showInProgress: true,
  icon: 'Key',
  addedInVersion: '1.0.0'
});

/**
 * Memory Step - Memory backend configuration
 */
const memoryStep = defineWizardStep({
  id: 'memory',
  priority: STEP_PRIORITIES.MEMORY,
  translationKey: 'steps.memory',
  component: lazy(() => import('./MemoryStep').then(m => ({ default: m.MemoryStep }))),
  category: 'memory',
  showInProgress: true,
  icon: 'Brain',
  addedInVersion: '1.0.0'
});

/**
 * Completion Step - Final step
 */
const completionStep = defineWizardStep({
  id: 'completion',
  priority: STEP_PRIORITIES.COMPLETION,
  translationKey: 'steps.done',
  component: lazy(() => import('./CompletionStep').then(m => ({ default: m.CompletionStep }))),
  category: 'completion',
  showInProgress: false, // Completion step doesn't show in progress bar
  skippable: false,
  addedInVersion: '1.0.0'
});

// ============================================================================
// OPTIONAL/CONDITIONAL STEPS
// These steps appear based on conditions (feature flags, settings, etc.)
// ============================================================================

/**
 * Graphiti Step - Advanced memory with Graphiti
 * Only shown when Graphiti feature is enabled
 */
const graphitiStep = defineWizardStep({
  id: 'graphiti',
  priority: STEP_PRIORITIES.GRAPHITI,
  translationKey: 'steps.graphiti',
  component: lazy(() => import('./GraphitiStep').then(m => ({ default: m.GraphitiStep }))),
  category: 'memory',
  showInProgress: true,
  icon: 'Network',
  addedInVersion: '1.1.0',
  condition: (ctx) => ctx.features?.graphiti === true
});

/**
 * First Spec Step - Create first task specification
 * Only shown when user wants guided first task
 */
const firstSpecStep = defineWizardStep({
  id: 'firstSpec',
  priority: STEP_PRIORITIES.FIRST_SPEC,
  translationKey: 'steps.firstSpec',
  component: lazy(() => import('./FirstSpecStep').then(m => ({ default: m.FirstSpecStep }))),
  category: 'completion',
  showInProgress: true,
  icon: 'FileText',
  addedInVersion: '1.0.0',
  condition: (ctx) => ctx.features?.guidedFirstTask === true
});

// ============================================================================
// REGISTRY COLLECTION
// All steps must be added here to be included in the wizard
// ============================================================================

/**
 * Master list of all step definitions
 * Steps are automatically sorted by priority when the wizard loads
 */
const STEP_DEFINITIONS: WizardStepDefinition[] = [
  // Core steps (always shown)
  welcomeStep,
  oauthStep,
  memoryStep,
  completionStep,

  // Conditional steps (shown based on features/settings)
  graphitiStep,
  firstSpecStep

  // ========================================
  // ADD NEW STEPS HERE
  // Example:
  // myNewStep,
  // ========================================
];

// ============================================================================
// REGISTRY API
// Functions for the wizard to consume registered steps
// ============================================================================

/**
 * Default condition context
 * Override with actual values from the app at runtime
 */
const defaultContext: StepConditionContext = {
  settings: {},
  isDev: import.meta.env?.DEV ?? false,
  platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
  features: {}
};

/**
 * Get all registered steps, sorted by priority
 * Does NOT filter by conditions - use getActiveSteps for filtered list
 */
export function getAllSteps(): WizardStepDefinition[] {
  // Sort by priority (ascending)
  return [...STEP_DEFINITIONS].sort((a, b) => a.priority - b.priority);
}

/**
 * Get active steps that pass their conditions
 * This is what the wizard should use to determine which steps to show
 */
export function getActiveSteps(context?: Partial<StepConditionContext>): WizardStepDefinition[] {
  const ctx: StepConditionContext = {
    ...defaultContext,
    ...context
  };

  return getAllSteps().filter(step => {
    // If no condition, step is always active
    if (!step.condition) return true;

    // Evaluate condition
    try {
      return step.condition(ctx);
    } catch (err) {
      console.error(`Error evaluating condition for step "${step.id}":`, err);
      return false; // Don't show step if condition throws
    }
  });
}

/**
 * Get steps that should appear in the progress indicator
 */
export function getProgressSteps(context?: Partial<StepConditionContext>): WizardStepDefinition[] {
  return getActiveSteps(context).filter(step => step.showInProgress);
}

/**
 * Get a specific step by ID
 */
export function getStepById(id: string): WizardStepDefinition | undefined {
  return STEP_DEFINITIONS.find(step => step.id === id);
}

/**
 * Get steps by category
 */
export function getStepsByCategory(
  category: WizardStepDefinition['category'],
  context?: Partial<StepConditionContext>
): WizardStepDefinition[] {
  return getActiveSteps(context).filter(step => step.category === category);
}

/**
 * Register a new step at runtime
 * Useful for plugins or dynamic step injection
 */
export function registerStep(definition: WizardStepDefinition): void {
  // Check for duplicate ID
  const existingIndex = STEP_DEFINITIONS.findIndex(s => s.id === definition.id);
  if (existingIndex >= 0) {
    console.warn(`Replacing existing step with ID "${definition.id}"`);
    STEP_DEFINITIONS[existingIndex] = definition;
  } else {
    STEP_DEFINITIONS.push(definition);
  }
}

/**
 * Unregister a step by ID
 */
export function unregisterStep(id: string): boolean {
  const index = STEP_DEFINITIONS.findIndex(s => s.id === id);
  if (index >= 0) {
    STEP_DEFINITIONS.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Get the complete wizard configuration
 */
export function getWizardConfig(context?: Partial<StepConditionContext>): WizardConfig {
  return {
    steps: getActiveSteps(context),
    defaultContext: defaultContext,
    persistProgress: true,
    persistenceKey: 'auto-claude:wizard-progress'
  };
}

/**
 * Debug helper - logs all registered steps
 */
export function debugSteps(): void {
  console.group('Wizard Steps Registry');
  console.log('Total registered:', STEP_DEFINITIONS.length);
  console.table(
    getAllSteps().map(s => ({
      id: s.id,
      priority: s.priority,
      category: s.category,
      showInProgress: s.showInProgress,
      hasCondition: !!s.condition
    }))
  );
  console.groupEnd();
}
