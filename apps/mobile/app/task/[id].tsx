/**
 * Task Detail Screen
 * Displays detailed information about a specific task with tabbed view
 * Accessed via /task/{id} route
 * Includes Overview, Logs, Files, Plan tabs and execution controls
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  Chip,
  Divider,
  Button,
  ProgressBar,
  ActivityIndicator,
} from 'react-native-paper';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import {
  TabView,
  TabBar,
  type SceneRendererProps,
  type NavigationState,
} from 'react-native-tab-view';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius } from '../../theme';
import { useTaskStore } from '../../stores/taskStore';
import { useTerminalStore } from '../../stores/terminalStore';
import { TerminalOutput } from '../../components/TerminalOutput';
import { EmptyState } from '../../components/EmptyState';
import type { Task, TaskExecutionState } from '../../types';

/**
 * Tab route type
 */
interface TabRoute {
  key: string;
  title: string;
  icon: string;
}

/**
 * Get status color based on task status
 */
const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    backlog: colors.taskStatus.backlog,
    in_progress: colors.taskStatus.in_progress,
    ai_review: colors.taskStatus.ai_review,
    human_review: colors.taskStatus.human_review,
    done: colors.taskStatus.done,
  };
  return statusColors[status] || colors.taskStatus.backlog;
};

/**
 * Get priority color based on task priority
 */
const getPriorityColor = (priority: string): string => {
  const priorityColors: Record<string, string> = {
    low: colors.priority.low,
    medium: colors.priority.medium,
    high: colors.priority.high,
    critical: colors.priority.critical,
  };
  return priorityColors[priority] || colors.priority.low;
};

/**
 * Format status label for display
 */
const formatStatus = (status: string): string => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Get execution state display info
 */
const getExecutionStateInfo = (
  state: TaskExecutionState
): { label: string; color: string; icon: string } => {
  const stateMap: Record<
    TaskExecutionState,
    { label: string; color: string; icon: string }
  > = {
    idle: { label: 'Idle', color: colors.text.muted, icon: 'pause-circle-outline' },
    running: { label: 'Running', color: colors.status.success, icon: 'play-circle-outline' },
    paused: { label: 'Paused', color: colors.status.warning, icon: 'pause-circle' },
    completed: { label: 'Completed', color: colors.status.success, icon: 'check-circle-outline' },
    failed: { label: 'Failed', color: colors.status.error, icon: 'close-circle-outline' },
  };
  return stateMap[state] || stateMap.idle;
};

/**
 * Execution Controls Component
 */
const ExecutionControls: React.FC<{
  task: Task;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
}> = ({ task, onStart, onPause, onStop }) => {
  const executionInfo = getExecutionStateInfo(task.executionState);
  const isRunning = task.executionState === 'running';
  const isPaused = task.executionState === 'paused';
  const isIdle =
    task.executionState === 'idle' ||
    task.executionState === 'failed';
  const isCompleted = task.executionState === 'completed';

  return (
    <View style={styles.executionControls}>
      {/* Execution State Badge */}
      <View
        style={[
          styles.executionStateBadge,
          { backgroundColor: executionInfo.color + '20' },
        ]}
      >
        <MaterialCommunityIcons
          name={executionInfo.icon}
          size={16}
          color={executionInfo.color}
        />
        <Text style={[styles.executionStateText, { color: executionInfo.color }]}>
          {executionInfo.label}
        </Text>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlButtons}>
        {/* Start/Resume Button */}
        <IconButton
          icon={isPaused ? 'play' : 'play'}
          iconColor={colors.status.success}
          size={24}
          onPress={onStart}
          disabled={isRunning || isCompleted}
          accessibilityLabel={isPaused ? 'Resume task execution' : 'Start task execution'}
          accessibilityHint="Starts or resumes the task execution"
          style={[
            styles.controlButton,
            (isRunning || isCompleted) && styles.controlButtonDisabled,
          ]}
        />

        {/* Pause Button */}
        <IconButton
          icon="pause"
          iconColor={colors.status.warning}
          size={24}
          onPress={onPause}
          disabled={!isRunning}
          accessibilityLabel="Pause task execution"
          accessibilityHint="Pauses the currently running task"
          style={[
            styles.controlButton,
            !isRunning && styles.controlButtonDisabled,
          ]}
        />

        {/* Stop Button */}
        <IconButton
          icon="stop"
          iconColor={colors.status.error}
          size={24}
          onPress={onStop}
          disabled={isIdle || isCompleted}
          accessibilityLabel="Stop task execution"
          accessibilityHint="Stops and cancels the task execution"
          style={[
            styles.controlButton,
            (isIdle || isCompleted) && styles.controlButtonDisabled,
          ]}
        />
      </View>
    </View>
  );
};

/**
 * Overview Tab Component
 */
const OverviewTab: React.FC<{ task: Task }> = ({ task }) => {
  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentInner}
      showsVerticalScrollIndicator={false}
    >
      {/* Description */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Description
        </Text>
        <Text variant="bodyMedium" style={styles.description}>
          {task.description || 'No description provided.'}
        </Text>
      </Surface>

      {/* Metrics */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Metrics
        </Text>
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text variant="labelMedium" style={styles.metricLabel}>
              Complexity
            </Text>
            <Text variant="headlineMedium" style={styles.metricValue}>
              {task.complexity}/10
            </Text>
            <ProgressBar
              progress={task.complexity / 10}
              color={
                task.complexity >= 7
                  ? colors.status.error
                  : task.complexity >= 4
                  ? colors.status.warning
                  : colors.status.success
              }
              style={styles.metricBar}
            />
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text variant="labelMedium" style={styles.metricLabel}>
              Impact
            </Text>
            <Text variant="headlineMedium" style={styles.metricValue}>
              {task.impact}/10
            </Text>
            <ProgressBar
              progress={task.impact / 10}
              color={colors.accent.primary}
              style={styles.metricBar}
            />
          </View>
        </View>
      </Surface>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Labels
          </Text>
          <View style={styles.labelsContainer}>
            {task.labels.map((label) => (
              <Chip
                key={label}
                style={styles.labelChip}
                textStyle={styles.labelChipText}
              >
                {label}
              </Chip>
            ))}
          </View>
        </Surface>
      )}

      {/* Timestamps */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Timeline
        </Text>
        <View style={styles.metadataRow}>
          <MaterialCommunityIcons
            name="calendar-plus"
            size={16}
            color={colors.text.muted}
          />
          <Text variant="bodySmall" style={styles.metadataLabel}>
            Created
          </Text>
          <Text variant="bodySmall" style={styles.metadataValue}>
            {new Date(task.createdAt).toLocaleString()}
          </Text>
        </View>
        <View style={styles.metadataRow}>
          <MaterialCommunityIcons
            name="calendar-edit"
            size={16}
            color={colors.text.muted}
          />
          <Text variant="bodySmall" style={styles.metadataLabel}>
            Updated
          </Text>
          <Text variant="bodySmall" style={styles.metadataValue}>
            {new Date(task.updatedAt).toLocaleString()}
          </Text>
        </View>
        {task.startedAt && (
          <View style={styles.metadataRow}>
            <MaterialCommunityIcons
              name="play-circle-outline"
              size={16}
              color={colors.status.success}
            />
            <Text variant="bodySmall" style={styles.metadataLabel}>
              Started
            </Text>
            <Text variant="bodySmall" style={styles.metadataValue}>
              {new Date(task.startedAt).toLocaleString()}
            </Text>
          </View>
        )}
        {task.completedAt && (
          <View style={styles.metadataRow}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={16}
              color={colors.status.success}
            />
            <Text variant="bodySmall" style={styles.metadataLabel}>
              Completed
            </Text>
            <Text variant="bodySmall" style={styles.metadataValue}>
              {new Date(task.completedAt).toLocaleString()}
            </Text>
          </View>
        )}
        {task.estimatedDuration && (
          <View style={styles.metadataRow}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color={colors.text.muted}
            />
            <Text variant="bodySmall" style={styles.metadataLabel}>
              Estimated
            </Text>
            <Text variant="bodySmall" style={styles.metadataValue}>
              {task.estimatedDuration}
            </Text>
          </View>
        )}
      </Surface>

      {/* GitHub Links */}
      {(task.githubIssueId || task.githubPRId) && (
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            GitHub
          </Text>
          {task.githubIssueId && (
            <Pressable
              style={styles.githubLink}
              onPress={() => router.push(`/github/issue/${task.githubIssueId}`)}
              accessibilityLabel={`View GitHub issue ${task.githubIssueId}`}
              accessibilityRole="link"
            >
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={18}
                color={colors.status.success}
              />
              <Text style={styles.githubLinkText}>
                Issue: {task.githubIssueId}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={colors.text.muted}
              />
            </Pressable>
          )}
          {task.githubPRId && (
            <Pressable
              style={styles.githubLink}
              onPress={() => router.push(`/github/pr/${task.githubPRId}`)}
              accessibilityLabel={`View GitHub PR ${task.githubPRId}`}
              accessibilityRole="link"
            >
              <MaterialCommunityIcons
                name="source-pull"
                size={18}
                color={colors.status.info}
              />
              <Text style={styles.githubLinkText}>
                PR: {task.githubPRId}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={colors.text.muted}
              />
            </Pressable>
          )}
        </Surface>
      )}
    </ScrollView>
  );
};

/**
 * Logs Tab Component
 */
const LogsTab: React.FC<{ task: Task }> = ({ task }) => {
  const { getSessionByTaskId } = useTerminalStore();
  const terminalSession = useMemo(
    () => (task.terminalSessionId ? getSessionByTaskId(task.id) : undefined),
    [task.id, task.terminalSessionId, getSessionByTaskId]
  );

  if (!terminalSession) {
    return (
      <View style={styles.tabContent}>
        <EmptyState
          icon="text-box-outline"
          title="No Logs Available"
          description="Execution logs will appear here when the task is running."
          actionLabel={task.executionState === 'idle' ? 'Start Task' : undefined}
          onAction={task.executionState === 'idle' ? () => {} : undefined}
        />
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <TerminalOutput
        lines={terminalSession.output}
        isActive={terminalSession.status === 'active'}
        sessionName={terminalSession.name}
        showHeader={true}
        testID="task-logs-terminal"
      />
    </View>
  );
};

/**
 * Files Tab Component
 */
const FilesTab: React.FC<{ task: Task }> = ({ task }) => {
  // Mock file changes for demonstration
  const mockFileChanges = useMemo(
    () => [
      { path: 'src/components/Feature.tsx', status: 'modified' as const, additions: 45, deletions: 12 },
      { path: 'src/stores/featureStore.ts', status: 'added' as const, additions: 120, deletions: 0 },
      { path: 'src/types/feature.ts', status: 'added' as const, additions: 35, deletions: 0 },
      { path: 'src/__tests__/Feature.test.tsx', status: 'added' as const, additions: 85, deletions: 0 },
      { path: 'package.json', status: 'modified' as const, additions: 3, deletions: 1 },
    ],
    []
  );

  const getStatusIcon = (status: string): { name: string; color: string } => {
    switch (status) {
      case 'added':
        return { name: 'plus-circle', color: colors.status.success };
      case 'modified':
        return { name: 'pencil-circle', color: colors.status.warning };
      case 'deleted':
        return { name: 'minus-circle', color: colors.status.error };
      default:
        return { name: 'file-document-outline', color: colors.text.muted };
    }
  };

  if (task.executionState === 'idle') {
    return (
      <View style={styles.tabContent}>
        <EmptyState
          icon="file-document-outline"
          title="No File Changes"
          description="File modifications will appear here once the task starts executing."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentInner}
      showsVerticalScrollIndicator={false}
    >
      <Surface style={styles.card} elevation={1}>
        <View style={styles.fileSummary}>
          <Chip
            style={[styles.fileChip, { backgroundColor: colors.status.success + '20' }]}
            textStyle={[styles.fileChipText, { color: colors.status.success }]}
          >
            +{mockFileChanges.reduce((sum, f) => sum + f.additions, 0)}
          </Chip>
          <Chip
            style={[styles.fileChip, { backgroundColor: colors.status.error + '20' }]}
            textStyle={[styles.fileChipText, { color: colors.status.error }]}
          >
            -{mockFileChanges.reduce((sum, f) => sum + f.deletions, 0)}
          </Chip>
          <Text style={styles.fileSummaryText}>
            {mockFileChanges.length} files changed
          </Text>
        </View>
        <Divider style={styles.divider} />
        {mockFileChanges.map((file, index) => {
          const statusInfo = getStatusIcon(file.status);
          return (
            <Pressable
              key={file.path}
              style={[
                styles.fileItem,
                index < mockFileChanges.length - 1 && styles.fileItemBorder,
              ]}
              accessibilityLabel={`${file.path}, ${file.status}`}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name={statusInfo.name}
                size={18}
                color={statusInfo.color}
              />
              <View style={styles.fileInfo}>
                <Text style={styles.filePath} numberOfLines={1}>
                  {file.path}
                </Text>
                <View style={styles.fileDiff}>
                  {file.additions > 0 && (
                    <Text style={styles.fileAdditions}>+{file.additions}</Text>
                  )}
                  {file.deletions > 0 && (
                    <Text style={styles.fileDeletions}>-{file.deletions}</Text>
                  )}
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={colors.text.muted}
              />
            </Pressable>
          );
        })}
      </Surface>
    </ScrollView>
  );
};

/**
 * Plan Tab Component
 */
const PlanTab: React.FC<{ task: Task }> = ({ task }) => {
  // Mock implementation plan
  const mockPlan = useMemo(
    () => ({
      phases: [
        {
          id: '1',
          title: 'Analysis',
          description: 'Analyze requirements and existing code',
          status: 'completed' as const,
          steps: [
            { id: '1.1', title: 'Read task requirements', status: 'completed' as const },
            { id: '1.2', title: 'Explore codebase structure', status: 'completed' as const },
            { id: '1.3', title: 'Identify dependencies', status: 'completed' as const },
          ],
        },
        {
          id: '2',
          title: 'Implementation',
          description: 'Build the core functionality',
          status: 'in_progress' as const,
          steps: [
            { id: '2.1', title: 'Create type definitions', status: 'completed' as const },
            { id: '2.2', title: 'Implement store logic', status: 'in_progress' as const },
            { id: '2.3', title: 'Build UI components', status: 'pending' as const },
          ],
        },
        {
          id: '3',
          title: 'Testing',
          description: 'Write and run tests',
          status: 'pending' as const,
          steps: [
            { id: '3.1', title: 'Write unit tests', status: 'pending' as const },
            { id: '3.2', title: 'Run integration tests', status: 'pending' as const },
          ],
        },
      ],
    }),
    []
  );

  const getStepIcon = (status: string): { name: string; color: string } => {
    switch (status) {
      case 'completed':
        return { name: 'check-circle', color: colors.status.success };
      case 'in_progress':
        return { name: 'progress-clock', color: colors.status.warning };
      case 'pending':
        return { name: 'circle-outline', color: colors.text.muted };
      default:
        return { name: 'circle-outline', color: colors.text.muted };
    }
  };

  if (task.executionState === 'idle') {
    return (
      <View style={styles.tabContent}>
        <EmptyState
          icon="format-list-bulleted"
          title="No Plan Generated"
          description="Claude will generate an implementation plan when the task starts."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentInner}
      showsVerticalScrollIndicator={false}
    >
      {mockPlan.phases.map((phase, phaseIndex) => {
        const phaseIcon = getStepIcon(phase.status);
        const completedSteps = phase.steps.filter((s) => s.status === 'completed').length;
        const progress = completedSteps / phase.steps.length;

        return (
          <Surface key={phase.id} style={styles.card} elevation={1}>
            <View style={styles.phaseHeader}>
              <MaterialCommunityIcons
                name={phaseIcon.name}
                size={22}
                color={phaseIcon.color}
              />
              <View style={styles.phaseInfo}>
                <Text variant="titleMedium" style={styles.phaseTitle}>
                  Phase {phase.id}: {phase.title}
                </Text>
                <Text variant="bodySmall" style={styles.phaseDescription}>
                  {phase.description}
                </Text>
              </View>
              <Chip
                style={[
                  styles.phaseChip,
                  { backgroundColor: phaseIcon.color + '20' },
                ]}
                textStyle={[styles.phaseChipText, { color: phaseIcon.color }]}
                compact
              >
                {completedSteps}/{phase.steps.length}
              </Chip>
            </View>

            <ProgressBar
              progress={progress}
              color={phaseIcon.color}
              style={styles.phaseProgress}
            />

            <View style={styles.stepsList}>
              {phase.steps.map((step, stepIndex) => {
                const stepIcon = getStepIcon(step.status);
                return (
                  <View
                    key={step.id}
                    style={[
                      styles.stepItem,
                      stepIndex < phase.steps.length - 1 && styles.stepItemBorder,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={stepIcon.name}
                      size={18}
                      color={stepIcon.color}
                    />
                    <Text
                      style={[
                        styles.stepTitle,
                        step.status === 'completed' && styles.stepTitleCompleted,
                      ]}
                    >
                      {step.title}
                    </Text>
                    {step.status === 'in_progress' && (
                      <ActivityIndicator size={14} color={colors.status.warning} />
                    )}
                  </View>
                );
              })}
            </View>
          </Surface>
        );
      })}
    </ScrollView>
  );
};

/**
 * Task detail screen component
 * Displays task information with tabs for Overview, Logs, Files, Plan
 */
export default function TaskDetailScreen() {
  const layout = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Get task from store
  const { getTaskById, updateExecutionState } = useTaskStore();
  const task = useMemo(() => getTaskById(id || ''), [id, getTaskById]);

  // Tab state
  const [tabIndex, setTabIndex] = useState(0);
  const routes: TabRoute[] = useMemo(
    () => [
      { key: 'overview', title: 'Overview', icon: 'information-outline' },
      { key: 'logs', title: 'Logs', icon: 'text-box-outline' },
      { key: 'files', title: 'Files', icon: 'file-document-outline' },
      { key: 'plan', title: 'Plan', icon: 'format-list-bulleted' },
    ],
    []
  );

  // Execution control handlers
  const handleStart = useCallback(() => {
    if (task) {
      updateExecutionState(task.id, 'running');
    }
  }, [task, updateExecutionState]);

  const handlePause = useCallback(() => {
    if (task) {
      updateExecutionState(task.id, 'paused');
    }
  }, [task, updateExecutionState]);

  const handleStop = useCallback(() => {
    if (task) {
      updateExecutionState(task.id, 'failed');
    }
  }, [task, updateExecutionState]);

  // Render tab scene
  const renderScene = useCallback(
    ({ route }: { route: TabRoute }) => {
      if (!task) return null;
      switch (route.key) {
        case 'overview':
          return <OverviewTab task={task} />;
        case 'logs':
          return <LogsTab task={task} />;
        case 'files':
          return <FilesTab task={task} />;
        case 'plan':
          return <PlanTab task={task} />;
        default:
          return null;
      }
    },
    [task]
  );

  // Tab options for custom rendering with icons and labels
  const tabOptions = useMemo(
    () =>
      routes.reduce(
        (acc, route) => ({
          ...acc,
          [route.key]: {
            label: ({
              focused,
            }: {
              route: TabRoute;
              focused: boolean;
              color: string;
            }) => (
              <View style={styles.tabLabelContainer}>
                <MaterialCommunityIcons
                  name={route.icon}
                  size={18}
                  color={focused ? colors.accent.primary : colors.text.muted}
                />
                <Text
                  style={[styles.tabLabel, focused && styles.tabLabelFocused]}
                >
                  {route.title}
                </Text>
              </View>
            ),
          },
        }),
        {} as Record<
          string,
          {
            label: (props: {
              route: TabRoute;
              focused: boolean;
              color: string;
            }) => React.ReactNode;
          }
        >
      ),
    [routes]
  );

  // Custom tab bar
  const renderTabBar = useCallback(
    (props: SceneRendererProps & { navigationState: NavigationState<TabRoute> }) => (
      <TabBar
        {...props}
        style={styles.tabBar}
        indicatorStyle={styles.tabIndicator}
        options={tabOptions}
        tabStyle={styles.tabItem}
        scrollEnabled={false}
        pressColor={colors.accent.primary + '20'}
        activeColor={colors.accent.primary}
        inactiveColor={colors.text.muted}
      />
    ),
    [tabOptions]
  );

  // Handle missing task
  if (!task) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Task Not Found',
            headerStyle: { backgroundColor: colors.background.primary },
            headerTintColor: colors.text.primary,
          }}
        />
        <View style={styles.container}>
          <EmptyState
            icon="alert-circle-outline"
            title="Task Not Found"
            description="The requested task could not be found."
            actionLabel="Go Back"
            onAction={() => router.back()}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Task Details',
          headerStyle: { backgroundColor: colors.background.primary },
          headerTintColor: colors.text.primary,
          headerTitleStyle: { color: colors.text.primary },
        }}
      />
      <View style={styles.container}>
        {/* Task Header */}
        <Surface style={styles.headerCard} elevation={2}>
          <View style={styles.headerTop}>
            <MaterialCommunityIcons
              name="checkbox-marked-outline"
              size={28}
              color={colors.accent.primary}
              accessibilityLabel="Task icon"
            />
            <Text variant="titleLarge" style={styles.title} numberOfLines={2}>
              {task.title}
            </Text>
          </View>

          {/* Status Badges */}
          <View style={styles.chipRow}>
            <Chip
              style={[styles.chip, { backgroundColor: getStatusColor(task.status) }]}
              textStyle={styles.chipText}
              accessibilityLabel={`Status: ${formatStatus(task.status)}`}
            >
              {formatStatus(task.status)}
            </Chip>
            <Chip
              style={[styles.chip, { backgroundColor: getPriorityColor(task.priority) }]}
              textStyle={styles.chipText}
              accessibilityLabel={`Priority: ${task.priority}`}
            >
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </Chip>
            <Chip
              style={[styles.chip, { backgroundColor: colors.surface.secondary }]}
              textStyle={styles.chipText}
              accessibilityLabel={`Category: ${task.category}`}
            >
              {task.category.charAt(0).toUpperCase() + task.category.slice(1)}
            </Chip>
          </View>

          {/* Execution Controls */}
          <ExecutionControls
            task={task}
            onStart={handleStart}
            onPause={handlePause}
            onStop={handleStop}
          />
        </Surface>

        {/* Tabbed Content */}
        <TabView
          navigationState={{ index: tabIndex, routes }}
          renderScene={renderScene}
          renderTabBar={renderTabBar}
          onIndexChange={setTabIndex}
          initialLayout={{ width: layout.width }}
          style={styles.tabView}
          lazy
          lazyPreloadDistance={1}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  headerCard: {
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    color: colors.text.primary,
    fontWeight: 'bold',
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    height: 28,
  },
  chipText: {
    color: colors.text.primary,
    fontSize: 12,
  },
  executionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.divider,
  },
  executionStateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  executionStateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  controlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    margin: 0,
  },
  controlButtonDisabled: {
    opacity: 0.4,
  },
  tabView: {
    flex: 1,
    marginTop: spacing.sm,
  },
  tabBar: {
    backgroundColor: colors.background.primary,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.divider,
  },
  tabIndicator: {
    backgroundColor: colors.accent.primary,
    height: 3,
    borderRadius: 1.5,
  },
  tabItem: {
    paddingVertical: spacing.sm,
  },
  tabLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tabLabel: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  tabLabelFocused: {
    color: colors.accent.primary,
  },
  tabContent: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  tabContentInner: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.text.secondary,
    lineHeight: 22,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  metricValue: {
    color: colors.accent.primary,
    fontWeight: 'bold',
  },
  metricBar: {
    width: '80%',
    height: 4,
    borderRadius: 2,
    marginTop: spacing.xs,
    backgroundColor: colors.surface.secondary,
  },
  metricDivider: {
    width: 1,
    height: 60,
    backgroundColor: colors.surface.divider,
    marginHorizontal: spacing.md,
  },
  labelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  labelChip: {
    backgroundColor: colors.surface.secondary,
  },
  labelChipText: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  metadataLabel: {
    color: colors.text.muted,
    flex: 1,
  },
  metadataValue: {
    color: colors.text.secondary,
  },
  divider: {
    backgroundColor: colors.surface.divider,
    marginVertical: spacing.sm,
  },
  githubLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  githubLinkText: {
    color: colors.text.primary,
    flex: 1,
  },
  fileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fileChip: {
    height: 24,
  },
  fileChipText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  fileSummaryText: {
    color: colors.text.muted,
    fontSize: 12,
    marginLeft: 'auto',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  fileItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.divider,
  },
  fileInfo: {
    flex: 1,
  },
  filePath: {
    color: colors.text.primary,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  fileDiff: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  fileAdditions: {
    color: colors.status.success,
    fontSize: 11,
    fontWeight: '600',
  },
  fileDeletions: {
    color: colors.status.error,
    fontSize: 11,
    fontWeight: '600',
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  phaseInfo: {
    flex: 1,
  },
  phaseTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  phaseDescription: {
    color: colors.text.muted,
    marginTop: 2,
  },
  phaseChip: {
    height: 24,
  },
  phaseChipText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  phaseProgress: {
    height: 4,
    borderRadius: 2,
    marginVertical: spacing.sm,
    backgroundColor: colors.surface.secondary,
  },
  stepsList: {
    marginTop: spacing.xs,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  stepItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.divider,
  },
  stepTitle: {
    color: colors.text.primary,
    fontSize: 13,
    flex: 1,
  },
  stepTitleCompleted: {
    color: colors.text.muted,
    textDecorationLine: 'line-through',
  },
});
