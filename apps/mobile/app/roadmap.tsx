/**
 * Roadmap Screen
 * Displays project roadmap features with status tracking and progress indicators
 * Allows converting features to tasks
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import {
  Text,
  Surface,
  Chip,
  ProgressBar,
  Searchbar,
  IconButton,
  FAB,
  Divider,
  Portal,
  Modal,
  Button,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, borderRadius } from '../theme';
import {
  useRoadmapStore,
  useFeatureCounts,
  useRoadmapProgress,
  type FeatureStatus,
} from '../stores/roadmapStore';
import { useTaskStore } from '../stores/taskStore';
import { useCurrentProject } from '../stores/projectStore';
import type { RoadmapFeature } from '../types';
import { EmptyState } from '../components';

/**
 * Status configuration
 */
const STATUS_CONFIG: Record<
  FeatureStatus,
  { label: string; color: string; icon: string }
> = {
  planned: {
    label: 'Planned',
    color: colors.text.muted,
    icon: 'calendar-clock',
  },
  in_progress: {
    label: 'In Progress',
    color: colors.taskStatus.in_progress,
    icon: 'progress-clock',
  },
  completed: {
    label: 'Completed',
    color: colors.status.success,
    icon: 'check-circle',
  },
  cancelled: {
    label: 'Cancelled',
    color: colors.status.error,
    icon: 'close-circle',
  },
};

/**
 * Priority configuration
 */
const PRIORITY_CONFIG: Record<
  'low' | 'medium' | 'high',
  { label: string; color: string }
> = {
  low: { label: 'Low', color: colors.priority.low },
  medium: { label: 'Medium', color: colors.priority.medium },
  high: { label: 'High', color: colors.priority.high },
};

/**
 * Feature Card Component
 */
interface FeatureCardProps {
  feature: RoadmapFeature;
  onPress: () => void;
  onConvertToTask: () => void;
}

const FeatureCard: React.FC<FeatureCardProps> = React.memo(
  ({ feature, onPress, onConvertToTask }) => {
    const statusConfig = STATUS_CONFIG[feature.status];
    const priorityConfig = PRIORITY_CONFIG[feature.priority];

    const progressColor = useMemo(() => {
      if (feature.progress >= 100) return colors.status.success;
      if (feature.progress >= 50) return colors.accent.primary;
      if (feature.progress > 0) return colors.taskStatus.in_progress;
      return colors.text.muted;
    }, [feature.progress]);

    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${feature.title}, ${statusConfig.label}, ${feature.progress}% complete`}
        accessibilityHint="Tap to view details"
      >
        <Surface style={styles.featureCard} elevation={1}>
          <View style={styles.featureHeader}>
            <MaterialCommunityIcons
              name={statusConfig.icon}
              size={20}
              color={statusConfig.color}
            />
            <Text
              variant="titleMedium"
              style={styles.featureTitle}
              numberOfLines={2}
            >
              {feature.title}
            </Text>
          </View>

          <Text
            variant="bodySmall"
            style={styles.featureDescription}
            numberOfLines={2}
          >
            {feature.description}
          </Text>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text variant="labelSmall" style={styles.progressLabel}>
                Progress
              </Text>
              <Text
                variant="labelSmall"
                style={[styles.progressValue, { color: progressColor }]}
              >
                {feature.progress}%
              </Text>
            </View>
            <ProgressBar
              progress={feature.progress / 100}
              color={progressColor}
              style={styles.progressBar}
            />
          </View>

          <View style={styles.featureFooter}>
            <View style={styles.badges}>
              <Chip
                mode="flat"
                compact
                textStyle={styles.chipText}
                style={[
                  styles.statusChip,
                  { backgroundColor: statusConfig.color + '20' },
                ]}
              >
                {statusConfig.label}
              </Chip>
              <Chip
                mode="flat"
                compact
                textStyle={styles.chipText}
                style={[
                  styles.priorityChip,
                  { backgroundColor: priorityConfig.color + '20' },
                ]}
              >
                {priorityConfig.label}
              </Chip>
            </View>

            {feature.status !== 'completed' && feature.status !== 'cancelled' && (
              <IconButton
                icon="clipboard-plus-outline"
                size={20}
                iconColor={colors.accent.primary}
                onPress={onConvertToTask}
                accessibilityLabel="Convert to task"
              />
            )}
          </View>

          {feature.targetDate && (
            <View style={styles.targetDate}>
              <MaterialCommunityIcons
                name="calendar"
                size={14}
                color={colors.text.muted}
              />
              <Text variant="labelSmall" style={styles.targetDateText}>
                Target: {new Date(feature.targetDate).toLocaleDateString()}
              </Text>
            </View>
          )}

          {feature.linkedTaskIds && feature.linkedTaskIds.length > 0 && (
            <View style={styles.linkedTasks}>
              <MaterialCommunityIcons
                name="link-variant"
                size={14}
                color={colors.text.muted}
              />
              <Text variant="labelSmall" style={styles.linkedTasksText}>
                {feature.linkedTaskIds.length} linked task
                {feature.linkedTaskIds.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </Surface>
      </Pressable>
    );
  }
);

FeatureCard.displayName = 'FeatureCard';

/**
 * Roadmap Screen Component
 */
export default function RoadmapScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<FeatureStatus | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<RoadmapFeature | null>(
    null
  );

  const { features, setFilters, clearFilters, getFilteredFeatures } =
    useRoadmapStore();
  const featureCounts = useFeatureCounts();
  const overallProgress = useRoadmapProgress();
  const currentProject = useCurrentProject();
  const addTask = useTaskStore((state) => state.addTask);
  const linkTask = useRoadmapStore((state) => state.linkTask);

  // Handle search and filter
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setFilters({
        search: query || undefined,
        status: selectedStatus ? [selectedStatus] : undefined,
      });
    },
    [selectedStatus, setFilters]
  );

  const handleStatusFilter = useCallback(
    (status: FeatureStatus | null) => {
      setSelectedStatus(status);
      setFilters({
        search: searchQuery || undefined,
        status: status ? [status] : undefined,
      });
    },
    [searchQuery, setFilters]
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Handle feature press
  const handleFeaturePress = useCallback((feature: RoadmapFeature) => {
    setSelectedFeature(feature);
    setDetailModalVisible(true);
  }, []);

  // Handle convert to task
  const handleConvertToTask = useCallback(
    (feature: RoadmapFeature) => {
      // Create a new task from the feature
      const newTask = addTask({
        title: feature.title,
        description: feature.description,
        priority: feature.priority,
        category: 'feature',
        complexity: 5,
        impact: 7,
        projectId: currentProject?.id || 'project-001',
        labels: ['from-roadmap'],
      });

      // Link the task to the feature
      linkTask(feature.id, newTask.id);

      // Navigate to task creation or show confirmation
      router.push(`/task/${newTask.id}`);
    },
    [addTask, linkTask, currentProject?.id, router]
  );

  // Get filtered features
  const filteredFeatures = useMemo(() => {
    return getFilteredFeatures();
  }, [getFilteredFeatures, features, searchQuery, selectedStatus]);

  // Group features by status
  const groupedFeatures = useMemo(() => {
    const groups: Record<FeatureStatus, RoadmapFeature[]> = {
      in_progress: [],
      planned: [],
      completed: [],
      cancelled: [],
    };

    filteredFeatures.forEach((feature) => {
      groups[feature.status].push(feature);
    });

    return groups;
  }, [filteredFeatures]);

  return (
    <View style={styles.container}>
      {/* Header Summary */}
      <Surface style={styles.header} elevation={1}>
        <View style={styles.headerTop}>
          <View>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              Roadmap
            </Text>
            <Text variant="bodySmall" style={styles.headerSubtitle}>
              {currentProject?.name || 'Project'} • {features.length} features
            </Text>
          </View>
          <View style={styles.progressCircle}>
            <Text variant="titleLarge" style={styles.progressText}>
              {overallProgress}%
            </Text>
            <Text variant="labelSmall" style={styles.progressSubtext}>
              Complete
            </Text>
          </View>
        </View>

        <ProgressBar
          progress={overallProgress / 100}
          color={colors.status.success}
          style={styles.overallProgress}
        />

        {/* Status counts */}
        <View style={styles.statusCounts}>
          {(['planned', 'in_progress', 'completed', 'cancelled'] as const).map(
            (status) => (
              <Pressable
                key={status}
                onPress={() =>
                  handleStatusFilter(selectedStatus === status ? null : status)
                }
                style={[
                  styles.statusCount,
                  selectedStatus === status && styles.statusCountSelected,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${STATUS_CONFIG[status].label}`}
                accessibilityState={{ selected: selectedStatus === status }}
              >
                <Text
                  variant="titleMedium"
                  style={[
                    styles.statusCountNumber,
                    { color: STATUS_CONFIG[status].color },
                  ]}
                >
                  {featureCounts[status]}
                </Text>
                <Text variant="labelSmall" style={styles.statusCountLabel}>
                  {STATUS_CONFIG[status].label}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </Surface>

      {/* Search */}
      <Searchbar
        placeholder="Search features..."
        value={searchQuery}
        onChangeText={handleSearch}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
        iconColor={colors.text.muted}
        placeholderTextColor={colors.text.muted}
      />

      {/* Feature List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.primary}
          />
        }
      >
        {filteredFeatures.length === 0 ? (
          <EmptyState
            icon="map-marker-path"
            title="No Features Found"
            description={
              searchQuery
                ? 'Try a different search term'
                : 'No roadmap features available'
            }
            actionLabel="Clear Filters"
            onAction={() => {
              setSearchQuery('');
              setSelectedStatus(null);
              clearFilters();
            }}
          />
        ) : (
          <>
            {/* In Progress Section */}
            {groupedFeatures.in_progress.length > 0 && (
              <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  In Progress ({groupedFeatures.in_progress.length})
                </Text>
                {groupedFeatures.in_progress.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    onPress={() => handleFeaturePress(feature)}
                    onConvertToTask={() => handleConvertToTask(feature)}
                  />
                ))}
              </View>
            )}

            {/* Planned Section */}
            {groupedFeatures.planned.length > 0 && (
              <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Planned ({groupedFeatures.planned.length})
                </Text>
                {groupedFeatures.planned.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    onPress={() => handleFeaturePress(feature)}
                    onConvertToTask={() => handleConvertToTask(feature)}
                  />
                ))}
              </View>
            )}

            {/* Completed Section */}
            {groupedFeatures.completed.length > 0 && (
              <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Completed ({groupedFeatures.completed.length})
                </Text>
                {groupedFeatures.completed.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    onPress={() => handleFeaturePress(feature)}
                    onConvertToTask={() => handleConvertToTask(feature)}
                  />
                ))}
              </View>
            )}

            {/* Cancelled Section */}
            {groupedFeatures.cancelled.length > 0 && (
              <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Cancelled ({groupedFeatures.cancelled.length})
                </Text>
                {groupedFeatures.cancelled.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    onPress={() => handleFeaturePress(feature)}
                    onConvertToTask={() => handleConvertToTask(feature)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => setDetailModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          {selectedFeature && (
            <ScrollView>
              <View style={styles.modalHeader}>
                <MaterialCommunityIcons
                  name={STATUS_CONFIG[selectedFeature.status].icon}
                  size={24}
                  color={STATUS_CONFIG[selectedFeature.status].color}
                />
                <Text variant="headlineSmall" style={styles.modalTitle}>
                  {selectedFeature.title}
                </Text>
              </View>

              <Text variant="bodyMedium" style={styles.modalDescription}>
                {selectedFeature.description}
              </Text>

              <Divider style={styles.modalDivider} />

              <View style={styles.modalDetails}>
                <View style={styles.modalDetailRow}>
                  <Text variant="labelMedium" style={styles.modalLabel}>
                    Status
                  </Text>
                  <Chip
                    compact
                    style={{
                      backgroundColor:
                        STATUS_CONFIG[selectedFeature.status].color + '20',
                    }}
                  >
                    {STATUS_CONFIG[selectedFeature.status].label}
                  </Chip>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text variant="labelMedium" style={styles.modalLabel}>
                    Priority
                  </Text>
                  <Chip
                    compact
                    style={{
                      backgroundColor:
                        PRIORITY_CONFIG[selectedFeature.priority].color + '20',
                    }}
                  >
                    {PRIORITY_CONFIG[selectedFeature.priority].label}
                  </Chip>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text variant="labelMedium" style={styles.modalLabel}>
                    Progress
                  </Text>
                  <Text variant="bodyMedium" style={styles.modalValue}>
                    {selectedFeature.progress}%
                  </Text>
                </View>

                {selectedFeature.targetDate && (
                  <View style={styles.modalDetailRow}>
                    <Text variant="labelMedium" style={styles.modalLabel}>
                      Target Date
                    </Text>
                    <Text variant="bodyMedium" style={styles.modalValue}>
                      {new Date(selectedFeature.targetDate).toLocaleDateString()}
                    </Text>
                  </View>
                )}

                {selectedFeature.completedDate && (
                  <View style={styles.modalDetailRow}>
                    <Text variant="labelMedium" style={styles.modalLabel}>
                      Completed
                    </Text>
                    <Text variant="bodyMedium" style={styles.modalValue}>
                      {new Date(
                        selectedFeature.completedDate
                      ).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                {selectedFeature.status !== 'completed' &&
                  selectedFeature.status !== 'cancelled' && (
                    <Button
                      mode="contained"
                      onPress={() => {
                        setDetailModalVisible(false);
                        handleConvertToTask(selectedFeature);
                      }}
                      icon="clipboard-plus-outline"
                      style={styles.modalButton}
                    >
                      Convert to Task
                    </Button>
                  )}
                <Button
                  mode="outlined"
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.modalButton}
                >
                  Close
                </Button>
              </View>
            </ScrollView>
          )}
        </Modal>
      </Portal>

      {/* Add Feature FAB */}
      <FAB
        icon="plus"
        onPress={() => {
          // Placeholder for add feature functionality
        }}
        style={styles.fab}
        color={colors.text.inverse}
        accessibilityLabel="Add feature"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  progressCircle: {
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    padding: spacing.sm,
    borderRadius: borderRadius.round,
    minWidth: 70,
  },
  progressText: {
    color: colors.status.success,
    fontWeight: 'bold',
  },
  progressSubtext: {
    color: colors.text.muted,
  },
  overallProgress: {
    height: 6,
    borderRadius: 3,
    marginTop: spacing.md,
    backgroundColor: colors.background.tertiary,
  },
  statusCounts: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
  },
  statusCount: {
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  statusCountSelected: {
    backgroundColor: colors.background.tertiary,
  },
  statusCountNumber: {
    fontWeight: 'bold',
  },
  statusCountLabel: {
    color: colors.text.muted,
  },
  searchBar: {
    margin: spacing.md,
    backgroundColor: colors.background.secondary,
  },
  searchInput: {
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  featureCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  featureTitle: {
    color: colors.text.primary,
    flex: 1,
    fontWeight: '600',
  },
  featureDescription: {
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  progressSection: {
    marginBottom: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    color: colors.text.muted,
  },
  progressValue: {
    fontWeight: 'bold',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.background.tertiary,
  },
  featureFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statusChip: {
    borderRadius: borderRadius.sm,
  },
  priorityChip: {
    borderRadius: borderRadius.sm,
  },
  chipText: {
    fontSize: 10,
    color: colors.text.primary,
  },
  targetDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
  },
  targetDateText: {
    color: colors.text.muted,
  },
  linkedTasks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  linkedTasksText: {
    color: colors.text.muted,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.accent.primary,
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.text.primary,
    flex: 1,
    fontWeight: 'bold',
  },
  modalDescription: {
    color: colors.text.secondary,
    lineHeight: 22,
  },
  modalDivider: {
    marginVertical: spacing.md,
    backgroundColor: colors.surface.border,
  },
  modalDetails: {
    gap: spacing.sm,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalLabel: {
    color: colors.text.muted,
  },
  modalValue: {
    color: colors.text.primary,
  },
  modalActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  modalButton: {
    borderRadius: borderRadius.md,
  },
});
