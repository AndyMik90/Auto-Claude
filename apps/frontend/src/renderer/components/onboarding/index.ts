/**
 * Onboarding module barrel export
 * Provides clean import paths for onboarding wizard components
 */

// Main wizard exports
export { OnboardingWizard } from './OnboardingWizard';
export { OnboardingWizardV2 } from './OnboardingWizardV2';

// Step components
export { WelcomeStep } from './WelcomeStep';
export { OAuthStep } from './OAuthStep';
export { MemoryStep } from './MemoryStep';
export { OllamaModelSelector } from './OllamaModelSelector';
export { FirstSpecStep } from './FirstSpecStep';
export { CompletionStep } from './CompletionStep';
export { WizardProgress, type WizardStep } from './WizardProgress';

// Legacy export for backward compatibility
export { GraphitiStep } from './GraphitiStep';

// Schema-based wizard system (auto-discovery)
export * from './wizard-step.schema';
export * from './wizard-registry';
