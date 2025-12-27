/**
 * Home Screen (Dashboard)
 * Main dashboard with Kanban task board
 * Displays tasks organized by status with drag-and-drop support
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Platform,
} from 'react-native';
import { Text, FAB, Portal, Surface, Chip, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { KanbanBoard, Header } from '../../components';
import { useTaskStore, useTaskCounts, useTotalTaskCount } from '../../stores/taskStore';
import { useProjectStore, useCurrentProject } from '../../stores/projectStore';
import type { Task, TaskStatus } from '../../types';
import { colors, spacing, borderRadius } from '../../theme';

/**
 * Quick stats summary item
 */
interface StatItem {
  label: string;
  value: number;
  icon: string;
  color: string;
  status: TaskStatus;
}

/**
 * Home tab screen component
 * Displays Kanban board with project context and quick stats
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Store hooks
  const tasks = useTaskStore((state) => state.tasks);
  const taskCounts = useTaskCounts();
  const totalTasks = useTotalTaskCount();
  const projects = useProjectStore((state) => state.projects);
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const selectProject = useProjectStore((state) => state.selectProject);
  const currentProject = useCurrentProject();

  // Local state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // Calculate stats for the current project or all tasks
  const filteredTaskCounts = useMemo(() => {
    if (!currentProjectId) return taskCounts;

    const projectTasks = tasks.filter((t) => t.projectId === currentProjectId);
    return {
      backlog: projectTasks.filter((t) => t.status === 'backlog').length,
      in_progress: projectTasks.filter((t) => t.status === 'in_progress').length,
      ai_review: projectTasks.filter((t) => t.status === 'ai_review').length,
      human_review: projectTasks.filter((t) => t.status === 'human_review').length,
      done: projectTasks.filter((t) => t.status === 'done').length,
    };
  }, [tasks, currentProjectId, taskCounts]);

  // Calculate total for current context
  const filteredTotalTasks = useMemo(() => {
    if (!currentProjectId) return totalTasks;
    return tasks.filter((t) => t.projectId === currentProjectId).length;
  }, [tasks, currentProjectId, totalTasks]);

  // Running task count
  const runningTaskCount = useMemo(() => {
    const targetTasks = currentProjectId
      ? tasks.filter((t) => t.projectId === currentProjectId)
      : tasks;
    return targetTasks.filter((t) => t.executionState === 'running').length;
  }, [tasks, currentProjectId]);

  // Stats for the quick summary
  const stats: StatItem[] = useMemo(
    () => [
      {
        label: 'Backlog',
        value: filteredTaskCounts.backlog,
        icon: 'inbox-outline',
        color: colors.taskStatus.backlog,
        status: 'backlog' as TaskStatus,
      },
      {
        label: 'In Progress',
        value: filteredTaskCounts.in_progress,
        icon: 'play-circle-outline',
        color: colors.taskStatus.in_progress,
        status: 'in_progress' as TaskStatus,
      },
      {
        label: 'AI Review',
        value: filteredTaskCounts.ai_review,
        icon: 'robot-outline',
        color: colors.taskStatus.ai_review,
        status: 'ai_review' as TaskStatus,
      },
      {
        label: 'Human Review',
        value: filteredTaskCounts.human_review,
        icon: 'account-check-outline',
        color: colors.taskStatus.human_review,
        status: 'human_review' as TaskStatus,
      },
      {
        label: 'Done',
        value: filteredTaskCounts.done,
        icon: 'check-circle-outline',
        color: colors.taskStatus.done,
        status: 'done' as TaskStatus,
      },
    ],
    [filteredTaskCounts]
  );

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    // Simulate a refresh delay (in Phase 6, this will call the API)
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  }, []);

  // Handle task press - navigate to task detail
  const handleTaskPress = useCallback(
    (task: Task) => {
      router.push(`/task/${task.id}`);
    },
    [router]
  );

  // Handle task long press - show quick actions (future implementation)
  const handleTaskLongPress = useCallback((_task: Task) => {
    // Future: Show action sheet with quick actions
  }, []);

  // Handle task move between columns
  const handleTaskMove = useCallback(
    (_task: Task, _fromStatus: TaskStatus, _toStatus: TaskStatus) => {
      // Task movement is handled internally by KanbanBoard via the store
      // This callback is for additional actions like haptic feedback
    },
    []
  );

  // Handle FAB actions
  const handleCreateTask = useCallback(() => {
    setFabOpen(false);
    router.push('/task/create');
  }, [router]);

  const handleViewAllTasks = useCallback(() => {
    setFabOpen(false);
    // Future: Navigate to a task list view
  }, []);

  // Handle project selection from switcher
  const handleProjectSelect = useCallback(
    (project: { id: string; name: string }) => {
      selectProject(project.id);
    },
    [selectProject]
  );

  // Format projects for the header switcher
  const projectItems = useMemo(() => {
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
    }));
  }, [projects]);

  // Current project for header
  const currentProjectItem = useMemo(() => {
    if (!currentProject) return undefined;
    return {
      id: currentProject.id,
      name: currentProject.name,
      status: currentProject.status,
    };
  }, [currentProject]);

  // Calculate completion percentage
  const completionPercentage = useMemo(() => {
    if (filteredTotalTasks === 0) return 0;
    return Math.round((filteredTaskCounts.done / filteredTotalTasks) * 100);
  }, [filteredTaskCounts.done, filteredTotalTasks]);

  return (
    <View style={styles.container}>
      {/* Header with project switcher */}
      <Header
        title={currentProject?.name || 'All Projects'}
        subtitle={
          runningTaskCount > 0
            ? `${runningTaskCount} task${runningTaskCount > 1 ? 's' : ''} running`
            : undefined
        }
        showProjectSwitcher={!!currentProject}
        currentProject={currentProjectItem}
        projects={projectItems}
        onProjectSelect={handleProjectSelect}
        actions={[
          {
            icon: 'filter-variant',
            onPress: () => {
              // Future: Open filter modal
            },
            accessibilityLabel: 'Filter tasks',
          },
          {
            icon: 'magnify',
            onPress: () => {
              // Future: Open search modal
            },
            accessibilityLabel: 'Search tasks',
          },
        ]}
        showBorder
        testID="home-header"
      />

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.accent.primary]}
            progressBackgroundColor={colors.background.secondary}
            tintColor={colors.accent.primary}
          />
        }
        accessibilityLabel="Dashboard content"
        accessibilityRole="scrollbar"
      >
        {/* Quick Stats Summary */}
        <Surface style={styles.statsCard} elevation={1}>
          <View style={styles.statsHeader}>
            <Text variant="titleSmall" style={styles.statsTitle}>
              Task Overview
            </Text>
            <Chip
              icon={({ size, color }) => (
                <Icon name="chart-donut" size={size} color={color} />
              )}
              style={styles.completionChip}
              textStyle={styles.completionChipText}
              accessibilityLabel={`${completionPercentage} percent complete`}
            >
              {completionPercentage}% complete
            </Chip>
          </View>

          <Divider style={styles.statsDivider} />

          <View style={styles.statsGrid}>
            {stats.map((stat) => (
              <View
                key={stat.status}
                style={styles.statItem}
                accessible
                accessibilityLabel={`${stat.label}: ${stat.value} tasks`}
                accessibilityRole="text"
              >
                <View style={[styles.statIconContainer, { backgroundColor: stat.color + '20' }]}>
                  <Icon name={stat.icon} size={18} color={stat.color} />
                </View>
                <Text variant="titleMedium" style={styles.statValue}>
                  {stat.value}
                </Text>
                <Text variant="labelSmall" style={styles.statLabel}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.statsFooter}>
            <Text variant="bodySmall" style={styles.totalText}>
              {filteredTotalTasks} total task{filteredTotalTasks !== 1 ? 's' : ''}
            </Text>
          </View>
        </Surface>

        {/* Kanban Board */}
        <View style={styles.kanbanContainer}>
          <KanbanBoard
            projectId={currentProjectId || undefined}
            onTaskPress={handleTaskPress}
            onTaskLongPress={handleTaskLongPress}
            onTaskMove={handleTaskMove}
            testID="home-kanban-board"
          />
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <Portal>
        <FAB.Group
          open={fabOpen}
          visible
          icon={fabOpen ? 'close' : 'plus'}
          actions={[
            {
              icon: 'format-list-bulleted',
              label: 'View All Tasks',
              onPress: handleViewAllTasks,
              labelStyle: styles.fabLabel,
              style: styles.fabAction,
              accessibilityLabel: 'View all tasks',
            },
            {
              icon: 'plus-circle',
              label: 'New Task',
              onPress: handleCreateTask,
              labelStyle: styles.fabLabel,
              style: styles.fabAction,
              accessibilityLabel: 'Create new task',
            },
          ]}
          onStateChange={({ open }) => setFabOpen(open)}
          onPress={() => {
            // Optional: directly navigate to create task when FAB is pressed
          }}
          fabStyle={[
            styles.fab,
            { marginBottom: Platform.OS === 'ios' ? insets.bottom + 60 : 60 },
          ]}
          style={styles.fabGroup}
          accessibilityLabel={fabOpen ? 'Close menu' : 'Open task menu'}
        />
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Space for FAB
  },
  // Stats card
  statsCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.secondary,
    overflow: 'hidden',
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  statsTitle: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  completionChip: {
    backgroundColor: colors.accent.primary + '20',
    height: 28,
  },
  completionChipText: {
    color: colors.accent.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  statsDivider: {
    backgroundColor: colors.surface.divider,
    marginHorizontal: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  statItem: {
    width: '20%',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  statLabel: {
    color: colors.text.muted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  statsFooter: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  totalText: {
    color: colors.text.secondary,
  },
  // Kanban container
  kanbanContainer: {
    flex: 1,
    minHeight: 400, // Ensure Kanban has adequate height
  },
  // FAB styles
  fabGroup: {
    paddingBottom: Platform.OS === 'ios' ? 8 : 0,
  },
  fab: {
    backgroundColor: colors.accent.primary,
  },
  fabAction: {
    backgroundColor: colors.background.elevated,
  },
  fabLabel: {
    color: colors.text.primary,
    backgroundColor: colors.background.elevated,
  },
});
