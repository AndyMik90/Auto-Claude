/**
 * Project Detail Screen
 * Displays detailed information about a specific project
 * Includes task list, roadmap preview, and quick actions
 * Accessed via /project/{id} route
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  FlatList,
  Pressable,
} from 'react-native';
import {
  Text,
  Surface,
  ProgressBar,
  Chip,
  Button,
  IconButton,
  Divider,
  Badge,
} from 'react-native-paper';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useProjectStore, useCurrentProject } from '../../stores/projectStore';
import { useTaskStore } from '../../stores/taskStore';
import { TaskCard, EmptyState } from '../../components';
import type { Project, Task, TaskStatus, ProjectStatus, RoadmapFeature } from '../../types';

/**
 * Task status columns for displaying task counts
 */
const TASK_STATUS_CONFIG: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog', label: 'Backlog', color: colors.taskStatus.backlog },
  { status: 'in_progress', label: 'In Progress', color: colors.taskStatus.in_progress },
  { status: 'ai_review', label: 'AI Review', color: colors.taskStatus.ai_review },
  { status: 'human_review', label: 'Human Review', color: colors.taskStatus.human_review },
  { status: 'done', label: 'Done', color: colors.taskStatus.done },
];

/**
 * Get status color based on project status
 */
const getStatusColor = (status: ProjectStatus): string => {
  const statusColors: Record<ProjectStatus, string> = {
    active: colors.status.success,
    paused: colors.status.warning,
    completed: colors.status.info,
    archived: colors.text.muted,
  };
  return statusColors[status] || colors.text.muted;
};

/**
 * Get status icon based on project status
 */
const getStatusIcon = (status: ProjectStatus): string => {
  const icons: Record<ProjectStatus, string> = {
    active: 'play-circle',
    paused: 'pause-circle',
    completed: 'check-circle',
    archived: 'archive',
  };
  return icons[status] || 'folder';
};

/**
 * Format status label for display
 */
const formatStatus = (status: ProjectStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

/**
 * Format relative time from date string
 */
const formatRelativeTime = (dateString?: string): string => {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/**
 * Section header component
 */
const SectionHeader: React.FC<{
  title: string;
  icon?: string;
  count?: number;
  action?: { label: string; onPress: () => void };
}> = ({ title, icon, count, action }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderLeft}>
      {icon && <Icon name={icon} size={18} color={colors.text.secondary} />}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        {title}
      </Text>
      {count !== undefined && (
        <Badge size={18} style={styles.sectionBadge}>
          {count}
        </Badge>
      )}
    </View>
    {action && (
      <Pressable
        onPress={action.onPress}
        style={styles.sectionAction}
        accessibilityLabel={action.label}
        accessibilityRole="button"
      >
        <Text style={styles.sectionActionText}>{action.label}</Text>
        <Icon name="chevron-right" size={16} color={colors.accent.primary} />
      </Pressable>
    )}
  </View>
);

/**
 * Project detail screen component
 * Displays project information with tasks and quick links
 */
export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Store state
  const getProjectById = useProjectStore((state) => state.getProjectById);
  const selectProject = useProjectStore((state) => state.selectProject);
  const getTasksByProject = useTaskStore((state) => state.getTasksByProject);

  // Get project data
  const project = useMemo(() => {
    return getProjectById(id || '') || null;
  }, [getProjectById, id]);

  // Get tasks for this project
  const projectTasks = useMemo(() => {
    if (!project) return [];
    return getTasksByProject(project.id);
  }, [getTasksByProject, project]);

  // Calculate task counts by status
  const taskCounts = useMemo(() => {
    const counts: Record<TaskStatus, number> = {
      backlog: 0,
      in_progress: 0,
      ai_review: 0,
      human_review: 0,
      done: 0,
    };
    projectTasks.forEach((task) => {
      counts[task.status]++;
    });
    return counts;
  }, [projectTasks]);

  // Calculate progress
  const progress = useMemo(() => {
    if (projectTasks.length === 0) return 0;
    return taskCounts.done / projectTasks.length;
  }, [projectTasks.length, taskCounts.done]);

  // Get recent/active tasks (not done, sorted by updated)
  const activeTasks = useMemo(() => {
    return projectTasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [projectTasks]);

  // Generate mock roadmap items based on project
  const roadmapItems = useMemo((): RoadmapFeature[] => {
    if (!project) return [];

    // Generate project-specific roadmap based on project name and status
    const baseItems: RoadmapFeature[] = [
      {
        id: `${project.id}-roadmap-1`,
        title: 'Core Infrastructure',
        description: 'Set up project foundation and architecture',
        status: 'completed',
        priority: 'high',
        progress: 100,
        completedDate: project.createdAt,
      },
      {
        id: `${project.id}-roadmap-2`,
        title: project.name.includes('Mobile') ? 'Mobile UI Components' : 'Feature Implementation',
        description: project.name.includes('Mobile')
          ? 'Build reusable mobile components'
          : 'Implement core features',
        status: progress >= 0.5 ? 'completed' : 'in_progress',
        priority: 'high',
        progress: Math.min(Math.round(progress * 150), 100),
      },
      {
        id: `${project.id}-roadmap-3`,
        title: project.name.includes('API') ? 'API Integration' : 'Integration & Testing',
        description: 'Connect components and ensure quality',
        status: progress >= 0.8 ? 'in_progress' : 'planned',
        priority: 'medium',
        progress: progress >= 0.8 ? Math.round((progress - 0.8) * 500) : 0,
      },
    ];

    return baseItems.slice(0, 3);
  }, [project, progress]);

  // Local state
  const [refreshing, setRefreshing] = useState(false);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Navigation handlers
  const handleCreateTask = useCallback(() => {
    router.push('/task/create');
  }, [router]);

  const handleViewRoadmap = useCallback(() => {
    router.push('/roadmap');
  }, [router]);

  const handleViewIdeation = useCallback(() => {
    router.push('/ideation');
  }, [router]);

  const handleViewContext = useCallback(() => {
    router.push('/context');
  }, [router]);

  const handleViewAllTasks = useCallback(() => {
    // Navigate to home with project filter
    if (project) {
      selectProject(project.id);
      router.push('/(tabs)');
    }
  }, [project, selectProject, router]);

  const handleTaskPress = useCallback(
    (task: Task) => {
      router.push(`/task/${task.id}`);
    },
    [router]
  );

  const handleOpenRepository = useCallback(() => {
    // In a real app, this would open the URL with Linking.openURL
  }, []);

  // Render task item
  const renderTaskItem = useCallback(
    ({ item }: { item: Task }) => (
      <TaskCard
        task={item}
        onPress={handleTaskPress}
        testID={`task-card-${item.id}`}
      />
    ),
    [handleTaskPress]
  );

  // Key extractor
  const taskKeyExtractor = useCallback((item: Task) => item.id, []);

  // If project not found
  if (!project) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Project Not Found',
            headerStyle: { backgroundColor: colors.background.primary },
            headerTintColor: colors.text.primary,
            headerTitleStyle: { color: colors.text.primary },
          }}
        />
        <View style={styles.notFoundContainer}>
          <EmptyState
            icon="folder-alert-outline"
            title="Project Not Found"
            description={`The project "${id}" could not be found. It may have been deleted or moved.`}
            actionLabel="Go Back"
            onAction={() => router.back()}
          />
        </View>
      </>
    );
  }

  const statusColor = getStatusColor(project.status);
  const statusIcon = getStatusIcon(project.status);

  return (
    <>
      <Stack.Screen
        options={{
          title: project.name,
          headerStyle: { backgroundColor: colors.background.primary },
          headerTintColor: colors.text.primary,
          headerTitleStyle: { color: colors.text.primary },
          headerRight: () => (
            <IconButton
              icon="dots-vertical"
              iconColor={colors.text.secondary}
              onPress={() => {}}
              accessibilityLabel="More options"
            />
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.primary}
            colors={[colors.accent.primary]}
          />
        }
      >
        {/* Project Header */}
        <Surface style={styles.headerCard} elevation={2}>
          <View style={styles.headerTop}>
            <View style={styles.headerIconContainer}>
              <Icon
                name="folder-multiple"
                size={40}
                color={colors.accent.primary}
                accessibilityLabel="Project icon"
              />
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            </View>
            <Chip
              mode="flat"
              icon={statusIcon}
              style={[styles.statusChip, { backgroundColor: `${statusColor}20` }]}
              textStyle={[styles.chipText, { color: statusColor }]}
              accessibilityLabel={`Status: ${formatStatus(project.status)}`}
            >
              {formatStatus(project.status)}
            </Chip>
          </View>

          <Text variant="headlineSmall" style={styles.title}>
            {project.name}
          </Text>

          {project.description && (
            <Text variant="bodyMedium" style={styles.description}>
              {project.description}
            </Text>
          )}

          {/* Last opened */}
          <View style={styles.metaRow}>
            <Icon name="clock-outline" size={14} color={colors.text.muted} />
            <Text variant="labelSmall" style={styles.metaText}>
              Last opened {formatRelativeTime(project.lastOpenedAt)}
            </Text>
          </View>
        </Surface>

        {/* Progress Card */}
        <Surface style={styles.card} elevation={1}>
          <SectionHeader title="Progress" icon="chart-arc" />
          <View style={styles.progressContainer}>
            <ProgressBar
              progress={progress}
              color={colors.accent.primary}
              style={styles.progressBar}
              accessibilityLabel={`Progress: ${Math.round(progress * 100)}%`}
            />
            <View style={styles.progressStats}>
              <Text variant="labelLarge" style={styles.progressPercent}>
                {Math.round(progress * 100)}%
              </Text>
              <Text variant="bodySmall" style={styles.progressText}>
                {taskCounts.done} of {projectTasks.length} tasks completed
              </Text>
            </View>
          </View>
        </Surface>

        {/* Task Statistics */}
        <Surface style={styles.card} elevation={1}>
          <SectionHeader title="Task Overview" icon="format-list-checks" count={projectTasks.length} />
          <View style={styles.statsGrid}>
            {TASK_STATUS_CONFIG.map((config) => (
              <Pressable
                key={config.status}
                style={styles.statItem}
                onPress={handleViewAllTasks}
                accessibilityLabel={`${taskCounts[config.status]} tasks ${config.label}`}
                accessibilityRole="button"
              >
                <View style={[styles.statIndicator, { backgroundColor: config.color }]} />
                <Text variant="titleLarge" style={styles.statValue}>
                  {taskCounts[config.status]}
                </Text>
                <Text variant="labelSmall" style={styles.statLabel}>
                  {config.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Surface>

        {/* Active Tasks */}
        <Surface style={styles.card} elevation={1}>
          <SectionHeader
            title="Active Tasks"
            icon="lightning-bolt"
            count={activeTasks.length}
            action={
              projectTasks.length > 0
                ? { label: 'View All', onPress: handleViewAllTasks }
                : undefined
            }
          />
          {activeTasks.length > 0 ? (
            <View style={styles.tasksList}>
              {activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onPress={handleTaskPress}
                  testID={`active-task-${task.id}`}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyTasksContainer}>
              <Icon name="check-circle-outline" size={32} color={colors.text.muted} />
              <Text variant="bodyMedium" style={styles.emptyTasksText}>
                No active tasks. All caught up!
              </Text>
              <Button
                mode="contained"
                icon="plus"
                onPress={handleCreateTask}
                buttonColor={colors.accent.primary}
                textColor={colors.text.inverse}
                style={styles.createTaskButton}
                accessibilityLabel="Create new task"
              >
                Create Task
              </Button>
            </View>
          )}
        </Surface>

        {/* Quick Actions */}
        <Surface style={styles.card} elevation={1}>
          <SectionHeader title="Quick Actions" icon="flash" />
          <View style={styles.actionsGrid}>
            <Pressable
              style={styles.actionTile}
              onPress={handleCreateTask}
              accessibilityLabel="Create new task"
              accessibilityRole="button"
            >
              <View style={[styles.actionIconContainer, { backgroundColor: `${colors.accent.primary}20` }]}>
                <Icon name="plus" size={24} color={colors.accent.primary} />
              </View>
              <Text variant="labelMedium" style={styles.actionLabel}>New Task</Text>
            </Pressable>

            <Pressable
              style={styles.actionTile}
              onPress={handleViewRoadmap}
              accessibilityLabel="View roadmap"
              accessibilityRole="button"
            >
              <View style={[styles.actionIconContainer, { backgroundColor: `${colors.status.info}20` }]}>
                <Icon name="map-marker-path" size={24} color={colors.status.info} />
              </View>
              <Text variant="labelMedium" style={styles.actionLabel}>Roadmap</Text>
            </Pressable>

            <Pressable
              style={styles.actionTile}
              onPress={handleViewIdeation}
              accessibilityLabel="View ideation"
              accessibilityRole="button"
            >
              <View style={[styles.actionIconContainer, { backgroundColor: `${colors.status.warning}20` }]}>
                <Icon name="lightbulb-outline" size={24} color={colors.status.warning} />
              </View>
              <Text variant="labelMedium" style={styles.actionLabel}>Ideation</Text>
            </Pressable>

            <Pressable
              style={styles.actionTile}
              onPress={handleViewContext}
              accessibilityLabel="View context"
              accessibilityRole="button"
            >
              <View style={[styles.actionIconContainer, { backgroundColor: `${colors.taskStatus.ai_review}20` }]}>
                <Icon name="file-tree" size={24} color={colors.taskStatus.ai_review} />
              </View>
              <Text variant="labelMedium" style={styles.actionLabel}>Context</Text>
            </Pressable>
          </View>
        </Surface>

        {/* Roadmap Preview */}
        <Surface style={styles.card} elevation={1}>
          <SectionHeader
            title="Roadmap Preview"
            icon="map-marker-path"
            action={{ label: 'Full Roadmap', onPress: handleViewRoadmap }}
          />
          <View style={styles.roadmapPreview}>
            {roadmapItems.map((item) => {
              const statusConfig = {
                completed: { color: colors.status.success, icon: 'check-circle', label: 'Completed' },
                in_progress: { color: colors.status.info, icon: 'progress-clock', label: 'In Progress' },
                planned: { color: colors.text.muted, icon: 'clock-outline', label: 'Planned' },
                cancelled: { color: colors.status.error, icon: 'close-circle', label: 'Cancelled' },
              };
              const config = statusConfig[item.status];

              return (
                <View
                  key={item.id}
                  style={styles.roadmapItem}
                  accessibilityLabel={`${item.title}: ${config.label}, ${item.progress}% complete`}
                >
                  <View style={[styles.roadmapDot, { backgroundColor: config.color }]} />
                  <View style={styles.roadmapItemContent}>
                    <Text variant="bodyMedium" style={styles.roadmapItemTitle}>{item.title}</Text>
                    <Text variant="labelSmall" style={styles.roadmapItemStatus}>{config.label}</Text>
                  </View>
                  {item.status === 'completed' ? (
                    <Icon name={config.icon} size={18} color={config.color} />
                  ) : item.progress > 0 ? (
                    <Badge style={styles.roadmapBadge}>{`${item.progress}%`}</Badge>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Surface>

        {/* Repository */}
        {project.repositoryUrl && (
          <Pressable
            onPress={handleOpenRepository}
            accessibilityLabel={`Open repository: ${project.repositoryUrl}`}
            accessibilityRole="link"
          >
            <Surface style={styles.repoCard} elevation={1}>
              <Icon name="github" size={24} color={colors.text.primary} />
              <View style={styles.repoContent}>
                <Text variant="labelMedium" style={styles.repoLabel}>Repository</Text>
                <Text variant="bodyMedium" style={styles.repoUrl} numberOfLines={1}>
                  {project.repositoryUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
                </Text>
              </View>
              <Icon name="open-in-new" size={18} color={colors.text.muted} />
            </Surface>
          </Pressable>
        )}

        {/* Metadata */}
        <Surface style={styles.card} elevation={1}>
          <SectionHeader title="Details" icon="information-outline" />
          <View style={styles.metadataList}>
            <View style={styles.metadataItem}>
              <Text variant="labelMedium" style={styles.metadataLabel}>Project ID</Text>
              <Text variant="bodySmall" style={styles.metadataValue}>{project.id}</Text>
            </View>
            <Divider style={styles.metadataDivider} />
            <View style={styles.metadataItem}>
              <Text variant="labelMedium" style={styles.metadataLabel}>Created</Text>
              <Text variant="bodySmall" style={styles.metadataValue}>
                {new Date(project.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Divider style={styles.metadataDivider} />
            <View style={styles.metadataItem}>
              <Text variant="labelMedium" style={styles.metadataLabel}>Last Updated</Text>
              <Text variant="bodySmall" style={styles.metadataValue}>
                {formatRelativeTime(project.updatedAt)}
              </Text>
            </View>
            {project.path && (
              <>
                <Divider style={styles.metadataDivider} />
                <View style={styles.metadataItem}>
                  <Text variant="labelMedium" style={styles.metadataLabel}>Path</Text>
                  <Text variant="bodySmall" style={styles.metadataValue} numberOfLines={1}>
                    {project.path}
                  </Text>
                </View>
              </>
            )}
          </View>
        </Surface>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.md,
  },
  notFoundContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  // Header card
  headerCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerIconContainer: {
    position: 'relative',
  },
  statusDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.background.secondary,
  },
  statusChip: {
    height: 28,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  title: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  description: {
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    color: colors.text.muted,
  },
  // Cards
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  sectionBadge: {
    backgroundColor: colors.surface.primary,
    color: colors.text.secondary,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionActionText: {
    color: colors.accent.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  // Progress
  progressContainer: {
    gap: spacing.sm,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface.border,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercent: {
    color: colors.accent.primary,
    fontWeight: 'bold',
  },
  progressText: {
    color: colors.text.secondary,
  },
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    width: '18%',
    paddingVertical: spacing.sm,
  },
  statIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  statLabel: {
    color: colors.text.muted,
    fontSize: 10,
    textAlign: 'center',
  },
  // Tasks list
  tasksList: {
    marginHorizontal: -spacing.xs,
  },
  emptyTasksContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyTasksText: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  createTaskButton: {
    marginTop: spacing.sm,
  },
  // Actions grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionTile: {
    width: '23%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    textAlign: 'center',
  },
  // Roadmap preview
  roadmapPreview: {
    gap: spacing.sm,
  },
  roadmapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  roadmapDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roadmapItemContent: {
    flex: 1,
  },
  roadmapItemTitle: {
    color: colors.text.primary,
  },
  roadmapItemStatus: {
    color: colors.text.muted,
  },
  roadmapBadge: {
    backgroundColor: colors.status.info,
  },
  // Repository
  repoCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  repoContent: {
    flex: 1,
  },
  repoLabel: {
    color: colors.text.muted,
    fontSize: 11,
  },
  repoUrl: {
    color: colors.text.primary,
  },
  // Metadata
  metadataList: {
    gap: 0,
  },
  metadataItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  metadataLabel: {
    color: colors.text.muted,
  },
  metadataValue: {
    color: colors.text.secondary,
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  metadataDivider: {
    backgroundColor: colors.surface.border,
  },
});
