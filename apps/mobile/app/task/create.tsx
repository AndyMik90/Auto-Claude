/**
 * Task Creation Wizard
 * Multi-step form to create new tasks
 * Step 1: Title, Description
 * Step 2: Category, Priority
 * Step 3: Complexity, Impact
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Button,
  Surface,
  TextInput,
  ProgressBar,
  IconButton,
  Chip,
  HelperText,
} from 'react-native-paper';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius } from '../../theme';
import { useTaskStore } from '../../stores/taskStore';
import { useProjectStore } from '../../stores/projectStore';
import type { TaskCategory, TaskPriority, TaskCreateInput } from '../../types';

/**
 * Wizard step configuration
 */
const STEPS = [
  {
    id: 'basics',
    title: 'Task Basics',
    description: 'Give your task a title and description',
    icon: 'text-box-outline',
  },
  {
    id: 'classification',
    title: 'Classification',
    description: 'Set the category and priority',
    icon: 'tag-outline',
  },
  {
    id: 'estimation',
    title: 'Estimation',
    description: 'Estimate complexity and impact',
    icon: 'chart-bar',
  },
] as const;

type StepId = (typeof STEPS)[number]['id'];

/**
 * Category options with icons and colors
 */
const CATEGORY_OPTIONS: Array<{
  value: TaskCategory;
  label: string;
  icon: string;
  color: string;
}> = [
  { value: 'feature', label: 'Feature', icon: 'star-outline', color: colors.status.info },
  { value: 'bug', label: 'Bug', icon: 'bug-outline', color: colors.status.error },
  { value: 'refactor', label: 'Refactor', icon: 'wrench-outline', color: colors.status.warning },
  { value: 'documentation', label: 'Docs', icon: 'file-document-outline', color: colors.accent.primary },
  { value: 'test', label: 'Test', icon: 'test-tube', color: colors.status.success },
  { value: 'chore', label: 'Chore', icon: 'broom', color: colors.text.secondary },
  { value: 'research', label: 'Research', icon: 'magnify', color: '#8B5CF6' },
];

/**
 * Priority options with colors
 */
const PRIORITY_OPTIONS: Array<{
  value: TaskPriority;
  label: string;
  icon: string;
  color: string;
}> = [
  { value: 'low', label: 'Low', icon: 'arrow-down', color: colors.priority.low },
  { value: 'medium', label: 'Medium', icon: 'minus', color: colors.priority.medium },
  { value: 'high', label: 'High', icon: 'arrow-up', color: colors.priority.high },
  { value: 'critical', label: 'Critical', icon: 'alert', color: colors.priority.critical },
];

/**
 * Form data type
 */
interface FormData {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  complexity: number;
  impact: number;
}

/**
 * Initial form state
 */
const initialFormData: FormData = {
  title: '',
  description: '',
  category: 'feature',
  priority: 'medium',
  complexity: 5,
  impact: 5,
};

/**
 * Task creation wizard component
 * Multi-step form for creating new tasks
 */
export default function TaskCreateScreen() {
  const insets = useSafeAreaInsets();
  const addTask = useTaskStore((state) => state.addTask);
  const currentProjectId = useProjectStore((state) => state.currentProjectId);

  // Form state
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Step calculations
  const step = STEPS[currentStep];
  const progress = (currentStep + 1) / STEPS.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  /**
   * Update form data
   */
  const updateFormData = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error when field is updated
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  /**
   * Validate current step
   */
  const validateStep = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (currentStep === 0) {
      if (!formData.title.trim()) {
        newErrors.title = 'Title is required';
      } else if (formData.title.trim().length < 3) {
        newErrors.title = 'Title must be at least 3 characters';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStep, formData.title]);

  /**
   * Animate transition between steps
   */
  const animateTransition = useCallback(
    (direction: 'next' | 'back') => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        if (direction === 'next' && currentStep < STEPS.length - 1) {
          setCurrentStep((prev) => prev + 1);
        } else if (direction === 'back' && currentStep > 0) {
          setCurrentStep((prev) => prev - 1);
        }
      }, 150);
    },
    [currentStep, fadeAnim]
  );

  /**
   * Handle next step or submit
   */
  const handleNext = useCallback(() => {
    if (!validateStep()) return;

    if (isLastStep) {
      handleSubmit();
    } else {
      animateTransition('next');
    }
  }, [isLastStep, validateStep, animateTransition]);

  /**
   * Handle previous step
   */
  const handleBack = useCallback(() => {
    animateTransition('back');
  }, [animateTransition]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async () => {
    if (!validateStep()) return;

    setIsSubmitting(true);

    try {
      const taskInput: TaskCreateInput = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: formData.priority,
        complexity: formData.complexity,
        impact: formData.impact,
        projectId: currentProjectId || 'project-001',
      };

      addTask(taskInput);

      // Navigate back to home after successful creation
      router.replace('/(tabs)');
    } catch (error) {
      setErrors({ title: 'Failed to create task. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, currentProjectId, addTask, validateStep]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    router.back();
  }, []);

  /**
   * Render step indicator dots
   */
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((_, index) => (
        <View
          key={index}
          style={[
            styles.stepDot,
            index === currentStep && styles.stepDotActive,
            index < currentStep && styles.stepDotCompleted,
          ]}
          accessibilityLabel={`Step ${index + 1} of ${STEPS.length}${
            index === currentStep ? ', current' : ''
          }`}
        />
      ))}
    </View>
  );

  /**
   * Render metric slider for complexity/impact
   */
  const renderMetricSlider = (
    label: string,
    value: number,
    onValueChange: (value: number) => void,
    description: string
  ) => {
    const getValueColor = (val: number) => {
      if (val <= 3) return colors.status.success;
      if (val <= 6) return colors.status.warning;
      return colors.status.error;
    };

    return (
      <Surface style={styles.metricCard} elevation={1}>
        <View style={styles.metricHeader}>
          <Text style={styles.metricLabel}>{label}</Text>
          <View
            style={[
              styles.metricValueBadge,
              { backgroundColor: getValueColor(value) + '20' },
            ]}
          >
            <Text style={[styles.metricValue, { color: getValueColor(value) }]}>
              {value}
            </Text>
          </View>
        </View>
        <Text style={styles.metricDescription}>{description}</Text>
        <View style={styles.metricSlider}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
            <Button
              key={val}
              mode={value === val ? 'contained' : 'outlined'}
              compact
              onPress={() => onValueChange(val)}
              style={[
                styles.sliderButton,
                value === val && { backgroundColor: getValueColor(val) },
              ]}
              labelStyle={[
                styles.sliderButtonLabel,
                value === val && { color: colors.text.inverse },
              ]}
              accessibilityLabel={`${label} ${val}`}
              accessibilityState={{ selected: value === val }}
            >
              {String(val)}
            </Button>
          ))}
        </View>
      </Surface>
    );
  };

  /**
   * Render Step 1: Basics (Title, Description)
   */
  const renderBasicsStep = () => (
    <View style={styles.stepContent}>
      <TextInput
        mode="outlined"
        label="Task Title *"
        value={formData.title}
        onChangeText={(text) => updateFormData('title', text)}
        placeholder="e.g., Implement user authentication"
        style={styles.input}
        outlineColor={errors.title ? colors.status.error : colors.surface.border}
        activeOutlineColor={errors.title ? colors.status.error : colors.accent.primary}
        textColor={colors.text.primary}
        placeholderTextColor={colors.text.muted}
        error={!!errors.title}
        accessibilityLabel="Task title"
        accessibilityHint="Required. Enter a descriptive title for the task"
      />
      {errors.title && (
        <HelperText type="error" visible={!!errors.title}>
          {errors.title}
        </HelperText>
      )}

      <TextInput
        mode="outlined"
        label="Description"
        value={formData.description}
        onChangeText={(text) => updateFormData('description', text)}
        placeholder="Describe what needs to be done..."
        style={[styles.input, styles.textArea]}
        outlineColor={colors.surface.border}
        activeOutlineColor={colors.accent.primary}
        textColor={colors.text.primary}
        placeholderTextColor={colors.text.muted}
        multiline
        numberOfLines={5}
        accessibilityLabel="Task description"
        accessibilityHint="Optional. Provide additional details about the task"
      />

      <Surface style={styles.tipCard} elevation={1}>
        <MaterialCommunityIcons
          name="lightbulb-outline"
          size={20}
          color={colors.accent.primary}
        />
        <Text style={styles.tipText}>
          A good task title is specific and actionable. Include the key objective.
        </Text>
      </Surface>
    </View>
  );

  /**
   * Render Step 2: Classification (Category, Priority)
   */
  const renderClassificationStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.fieldLabel}>Category</Text>
      <View style={styles.chipGrid}>
        {CATEGORY_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            mode={formData.category === option.value ? 'flat' : 'outlined'}
            selected={formData.category === option.value}
            onPress={() => updateFormData('category', option.value)}
            style={[
              styles.chip,
              formData.category === option.value && {
                backgroundColor: option.color + '20',
              },
            ]}
            textStyle={[
              styles.chipText,
              formData.category === option.value && { color: option.color },
            ]}
            icon={() => (
              <MaterialCommunityIcons
                name={option.icon as any}
                size={16}
                color={
                  formData.category === option.value
                    ? option.color
                    : colors.text.secondary
                }
              />
            )}
            accessibilityLabel={`${option.label} category`}
            accessibilityState={{ selected: formData.category === option.value }}
          >
            {option.label}
          </Chip>
        ))}
      </View>

      <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Priority</Text>
      <View style={styles.priorityContainer}>
        {PRIORITY_OPTIONS.map((option) => (
          <Button
            key={option.value}
            mode={formData.priority === option.value ? 'contained' : 'outlined'}
            onPress={() => updateFormData('priority', option.value)}
            style={[
              styles.priorityButton,
              formData.priority === option.value && {
                backgroundColor: option.color,
                borderColor: option.color,
              },
            ]}
            labelStyle={[
              styles.priorityLabel,
              formData.priority === option.value && { color: colors.text.inverse },
            ]}
            icon={() => (
              <MaterialCommunityIcons
                name={option.icon as any}
                size={16}
                color={
                  formData.priority === option.value
                    ? colors.text.inverse
                    : option.color
                }
              />
            )}
            accessibilityLabel={`${option.label} priority`}
            accessibilityState={{ selected: formData.priority === option.value }}
          >
            {option.label}
          </Button>
        ))}
      </View>

      <Surface style={styles.previewCard} elevation={1}>
        <Text style={styles.previewLabel}>Preview</Text>
        <View style={styles.previewRow}>
          <Chip
            mode="flat"
            compact
            style={{
              backgroundColor:
                CATEGORY_OPTIONS.find((c) => c.value === formData.category)?.color +
                '20',
            }}
            textStyle={{
              color: CATEGORY_OPTIONS.find((c) => c.value === formData.category)
                ?.color,
              fontSize: 12,
            }}
          >
            {CATEGORY_OPTIONS.find((c) => c.value === formData.category)?.label}
          </Chip>
          <Chip
            mode="flat"
            compact
            style={{
              backgroundColor:
                PRIORITY_OPTIONS.find((p) => p.value === formData.priority)?.color +
                '20',
            }}
            textStyle={{
              color: PRIORITY_OPTIONS.find((p) => p.value === formData.priority)
                ?.color,
              fontSize: 12,
            }}
          >
            {PRIORITY_OPTIONS.find((p) => p.value === formData.priority)?.label}
          </Chip>
        </View>
      </Surface>
    </View>
  );

  /**
   * Render Step 3: Estimation (Complexity, Impact)
   */
  const renderEstimationStep = () => {
    const score = useMemo(() => {
      return ((formData.complexity + formData.impact) / 2).toFixed(1);
    }, [formData.complexity, formData.impact]);

    return (
      <View style={styles.stepContent}>
        {renderMetricSlider(
          'Complexity',
          formData.complexity,
          (value) => updateFormData('complexity', value),
          'How difficult is this task to implement? (1 = simple, 10 = very complex)'
        )}

        {renderMetricSlider(
          'Impact',
          formData.impact,
          (value) => updateFormData('impact', value),
          'How much value does this task deliver? (1 = minor, 10 = critical)'
        )}

        <Surface style={styles.scoreCard} elevation={2}>
          <View style={styles.scoreHeader}>
            <MaterialCommunityIcons
              name="chart-timeline-variant"
              size={24}
              color={colors.accent.primary}
            />
            <Text style={styles.scoreLabel}>Task Score</Text>
          </View>
          <Text style={styles.scoreValue}>{score}</Text>
          <Text style={styles.scoreDescription}>
            Based on complexity and impact ratings
          </Text>
        </Surface>
      </View>
    );
  };

  /**
   * Render current step content
   */
  const renderStepContent = () => {
    switch (step.id) {
      case 'basics':
        return renderBasicsStep();
      case 'classification':
        return renderClassificationStep();
      case 'estimation':
        return renderEstimationStep();
      default:
        return null;
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Create Task',
          headerStyle: { backgroundColor: colors.background.secondary },
          headerTintColor: colors.text.primary,
          headerLeft: () => (
            <IconButton
              icon="close"
              iconColor={colors.text.secondary}
              onPress={handleCancel}
              accessibilityLabel="Cancel task creation"
            />
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.container,
            { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <ProgressBar
              progress={progress}
              color={colors.accent.primary}
              style={styles.progressBar}
            />
          </View>

          {/* Step indicator */}
          {renderStepIndicator()}

          {/* Scrollable content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.animatedContent, { opacity: fadeAnim }]}>
              {/* Step icon */}
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name={step.icon as any}
                  size={48}
                  color={colors.accent.primary}
                  accessibilityLabel={`${step.title} icon`}
                />
              </View>

              {/* Step title and description */}
              <Text
                variant="headlineSmall"
                style={styles.title}
                accessibilityRole="header"
              >
                {step.title}
              </Text>
              <Text variant="bodyMedium" style={styles.description}>
                {step.description}
              </Text>

              {/* Step-specific content */}
              {renderStepContent()}
            </Animated.View>
          </ScrollView>

          {/* Footer navigation */}
          <View style={styles.footer}>
            <View style={styles.footerButtons}>
              {!isFirstStep && (
                <Button
                  mode="outlined"
                  onPress={handleBack}
                  style={styles.backButton}
                  textColor={colors.text.secondary}
                  accessibilityLabel="Go to previous step"
                >
                  Back
                </Button>
              )}
              <Button
                mode="contained"
                onPress={handleNext}
                style={[styles.nextButton, isFirstStep && styles.fullWidthButton]}
                contentStyle={styles.nextButtonContent}
                labelStyle={styles.nextButtonLabel}
                loading={isSubmitting}
                disabled={isSubmitting}
                accessibilityLabel={isLastStep ? 'Create task' : 'Continue to next step'}
              >
                {isLastStep ? 'Create Task' : 'Continue'}
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface.border,
  },
  stepDotActive: {
    width: 24,
    backgroundColor: colors.accent.primary,
  },
  stepDotCompleted: {
    backgroundColor: colors.status.success,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  animatedContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text.primary,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  stepContent: {
    width: '100%',
  },
  // Form inputs
  input: {
    width: '100%',
    backgroundColor: colors.background.secondary,
    marginBottom: spacing.xs,
  },
  textArea: {
    height: 120,
    marginTop: spacing.sm,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  tipText: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: 14,
  },
  // Classification step
  fieldLabel: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.surface.border,
  },
  chipText: {
    color: colors.text.secondary,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityButton: {
    flex: 1,
    borderColor: colors.surface.border,
  },
  priorityLabel: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  previewCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  previewLabel: {
    color: colors.text.muted,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  // Estimation step
  metricCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  metricLabel: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  metricValueBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  metricValue: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  metricDescription: {
    color: colors.text.secondary,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  metricSlider: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  sliderButton: {
    minWidth: 28,
    borderRadius: borderRadius.sm,
    borderColor: colors.surface.border,
  },
  sliderButtonLabel: {
    fontSize: 12,
    marginHorizontal: 0,
    color: colors.text.secondary,
  },
  scoreCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  scoreLabel: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  scoreValue: {
    color: colors.accent.primary,
    fontWeight: 'bold',
    fontSize: 48,
    lineHeight: 56,
  },
  scoreDescription: {
    color: colors.text.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.background.primary,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    borderColor: colors.surface.border,
  },
  nextButton: {
    flex: 2,
    borderRadius: borderRadius.md,
  },
  fullWidthButton: {
    flex: 1,
  },
  nextButtonContent: {
    paddingVertical: spacing.xs,
  },
  nextButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
