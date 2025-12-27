/**
 * Ideation Screen
 * Browse AI-generated and user ideas with swipe gestures for dismiss/archive
 * Supports converting ideas to tasks
 */

import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import {
  Text,
  Surface,
  Chip,
  Searchbar,
  IconButton,
  FAB,
  Divider,
  Portal,
  Modal,
  Button,
  SegmentedButtons,
  Badge,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  GestureDetector,
  Gesture,
  Swipeable,
} from 'react-native-gesture-handler';

import { colors, spacing, borderRadius } from '../theme';
import {
  useIdeationStore,
  useIdeaCounts,
  useActiveIdeaCount,
  type IdeaType,
  type IdeaStatus,
} from '../stores/ideationStore';
import { useTaskStore } from '../stores/taskStore';
import { useCurrentProject } from '../stores/projectStore';
import type { ProjectIdea } from '../types';
import { EmptyState } from '../components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

/**
 * Type configuration
 */
const TYPE_CONFIG: Record<IdeaType, { label: string; color: string; icon: string }> = {
  feature: {
    label: 'Feature',
    color: colors.accent.primary,
    icon: 'star-outline',
  },
  improvement: {
    label: 'Improvement',
    color: colors.taskStatus.in_progress,
    icon: 'trending-up',
  },
  bug_fix: {
    label: 'Bug Fix',
    color: colors.status.error,
    icon: 'bug-outline',
  },
  research: {
    label: 'Research',
    color: colors.taskStatus.ai_review,
    icon: 'flask-outline',
  },
  other: {
    label: 'Other',
    color: colors.text.muted,
    icon: 'dots-horizontal',
  },
};

/**
 * Status configuration
 */
const STATUS_CONFIG: Record<IdeaStatus, { label: string; color: string }> = {
  new: { label: 'New', color: colors.accent.primary },
  reviewing: { label: 'Reviewing', color: colors.taskStatus.in_progress },
  accepted: { label: 'Accepted', color: colors.status.success },
  rejected: { label: 'Rejected', color: colors.status.error },
  archived: { label: 'Archived', color: colors.text.muted },
};

/**
 * Source icon
 */
const getSourceIcon = (source: 'ai' | 'user'): string => {
  return source === 'ai' ? 'robot-outline' : 'account-outline';
};

/**
 * Swipeable Idea Card Component
 */
interface IdeaCardProps {
  idea: ProjectIdea;
  onPress: () => void;
  onDismiss: () => void;
  onArchive: () => void;
  onConvertToTask: () => void;
  onUpvote: () => void;
}

const IdeaCard: React.FC<IdeaCardProps> = React.memo(
  ({ idea, onPress, onDismiss, onArchive, onConvertToTask, onUpvote }) => {
    const typeConfig = TYPE_CONFIG[idea.type];
    const statusConfig = STATUS_CONFIG[idea.status];
    const swipeableRef = useRef<Swipeable>(null);

    const renderLeftActions = useCallback(
      (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
      ) => {
        const scale = dragX.interpolate({
          inputRange: [0, SWIPE_THRESHOLD],
          outputRange: [0.5, 1],
          extrapolate: 'clamp',
        });

        return (
          <View style={styles.swipeActionLeft}>
            <Animated.View
              style={[styles.swipeActionContent, { transform: [{ scale }] }]}
            >
              <MaterialCommunityIcons
                name="archive-outline"
                size={24}
                color={colors.text.primary}
              />
              <Text variant="labelMedium" style={styles.swipeActionText}>
                Archive
              </Text>
            </Animated.View>
          </View>
        );
      },
      []
    );

    const renderRightActions = useCallback(
      (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
      ) => {
        const scale = dragX.interpolate({
          inputRange: [-SWIPE_THRESHOLD, 0],
          outputRange: [1, 0.5],
          extrapolate: 'clamp',
        });

        return (
          <View style={styles.swipeActionRight}>
            <Animated.View
              style={[styles.swipeActionContent, { transform: [{ scale }] }]}
            >
              <MaterialCommunityIcons
                name="close-circle-outline"
                size={24}
                color={colors.text.primary}
              />
              <Text variant="labelMedium" style={styles.swipeActionText}>
                Dismiss
              </Text>
            </Animated.View>
          </View>
        );
      },
      []
    );

    const handleSwipeOpen = useCallback(
      (direction: 'left' | 'right') => {
        if (direction === 'left') {
          onDismiss();
        } else {
          onArchive();
        }
        swipeableRef.current?.close();
      },
      [onDismiss, onArchive]
    );

    const isActionable =
      idea.status !== 'archived' &&
      idea.status !== 'rejected' &&
      !idea.linkedTaskId;

    return (
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={isActionable ? renderLeftActions : undefined}
        renderRightActions={isActionable ? renderRightActions : undefined}
        onSwipeableOpen={handleSwipeOpen}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${idea.title}, ${typeConfig.label}, ${statusConfig.label}`}
          accessibilityHint={
            isActionable
              ? 'Tap to view details, swipe left to dismiss, swipe right to archive'
              : 'Tap to view details'
          }
        >
          <Surface style={styles.ideaCard} elevation={1}>
            <View style={styles.ideaHeader}>
              <View style={styles.ideaTypeIcon}>
                <MaterialCommunityIcons
                  name={typeConfig.icon}
                  size={18}
                  color={typeConfig.color}
                />
              </View>
              <View style={styles.ideaTitleContainer}>
                <Text
                  variant="titleMedium"
                  style={styles.ideaTitle}
                  numberOfLines={2}
                >
                  {idea.title}
                </Text>
                <View style={styles.ideaSource}>
                  <MaterialCommunityIcons
                    name={getSourceIcon(idea.source)}
                    size={14}
                    color={colors.text.muted}
                  />
                  <Text variant="labelSmall" style={styles.ideaSourceText}>
                    {idea.source === 'ai' ? 'AI Generated' : 'User Submitted'}
                  </Text>
                </View>
              </View>
              {idea.votes !== undefined && idea.votes > 0 && (
                <Pressable
                  onPress={onUpvote}
                  style={styles.voteButton}
                  accessibilityLabel={`${idea.votes} votes, tap to upvote`}
                >
                  <MaterialCommunityIcons
                    name="arrow-up-bold-circle-outline"
                    size={20}
                    color={colors.accent.primary}
                  />
                  <Text variant="labelMedium" style={styles.voteCount}>
                    {idea.votes}
                  </Text>
                </Pressable>
              )}
            </View>

            <Text
              variant="bodySmall"
              style={styles.ideaDescription}
              numberOfLines={2}
            >
              {idea.description}
            </Text>

            <View style={styles.ideaFooter}>
              <View style={styles.badges}>
                <Chip
                  mode="flat"
                  compact
                  textStyle={styles.chipText}
                  style={[
                    styles.typeChip,
                    { backgroundColor: typeConfig.color + '20' },
                  ]}
                >
                  {typeConfig.label}
                </Chip>
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
              </View>

              {isActionable && (
                <IconButton
                  icon="clipboard-plus-outline"
                  size={20}
                  iconColor={colors.accent.primary}
                  onPress={onConvertToTask}
                  accessibilityLabel="Convert to task"
                />
              )}
            </View>

            {idea.linkedTaskId && (
              <View style={styles.linkedTask}>
                <MaterialCommunityIcons
                  name="link-variant"
                  size={14}
                  color={colors.status.success}
                />
                <Text variant="labelSmall" style={styles.linkedTaskText}>
                  Linked to task
                </Text>
              </View>
            )}

            <Text variant="labelSmall" style={styles.ideaDate}>
              {new Date(idea.createdAt).toLocaleDateString()}
            </Text>
          </Surface>
        </Pressable>
      </Swipeable>
    );
  }
);

IdeaCard.displayName = 'IdeaCard';

/**
 * Ideation Screen Component
 */
export default function IdeationScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<IdeaType | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<ProjectIdea | null>(null);

  const {
    ideas,
    setFilters,
    clearFilters,
    getFilteredIdeas,
    dismissIdea,
    archiveIdea,
    upvoteIdea,
    linkToTask,
  } = useIdeationStore();
  const ideaCounts = useIdeaCounts();
  const activeCount = useActiveIdeaCount();
  const currentProject = useCurrentProject();
  const addTask = useTaskStore((state) => state.addTask);

  // Handle search and filter
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setFilters({
        search: query || undefined,
        type: selectedType !== 'all' ? [selectedType] : undefined,
        status: showArchived ? undefined : ['new', 'reviewing', 'accepted'],
      });
    },
    [selectedType, showArchived, setFilters]
  );

  const handleTypeFilter = useCallback(
    (type: IdeaType | 'all') => {
      setSelectedType(type);
      setFilters({
        search: searchQuery || undefined,
        type: type !== 'all' ? [type] : undefined,
        status: showArchived ? undefined : ['new', 'reviewing', 'accepted'],
      });
    },
    [searchQuery, showArchived, setFilters]
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Handle idea press
  const handleIdeaPress = useCallback((idea: ProjectIdea) => {
    setSelectedIdea(idea);
    setDetailModalVisible(true);
  }, []);

  // Handle convert to task
  const handleConvertToTask = useCallback(
    (idea: ProjectIdea) => {
      // Determine task category based on idea type
      const categoryMap: Record<IdeaType, string> = {
        feature: 'feature',
        improvement: 'feature',
        bug_fix: 'bug',
        research: 'research',
        other: 'chore',
      };

      const newTask = addTask({
        title: idea.title,
        description: idea.description,
        priority: 'medium',
        category: categoryMap[idea.type] as 'feature' | 'bug' | 'research' | 'chore',
        complexity: 5,
        impact: 5,
        projectId: currentProject?.id || 'project-001',
        labels: ['from-idea', idea.type],
      });

      linkToTask(idea.id, newTask.id);
      router.push(`/task/${newTask.id}`);
    },
    [addTask, linkToTask, currentProject?.id, router]
  );

  // Get filtered ideas
  const filteredIdeas = useMemo(() => {
    let filtered = getFilteredIdeas();

    // Apply type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter((idea) => idea.type === selectedType);
    }

    // Hide archived by default
    if (!showArchived) {
      filtered = filtered.filter(
        (idea) => idea.status !== 'archived' && idea.status !== 'rejected'
      );
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (idea) =>
          idea.title.toLowerCase().includes(query) ||
          idea.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [getFilteredIdeas, ideas, selectedType, showArchived, searchQuery]);

  // Group ideas by type
  const groupedIdeas = useMemo(() => {
    const groups: Record<IdeaType, ProjectIdea[]> = {
      feature: [],
      improvement: [],
      bug_fix: [],
      research: [],
      other: [],
    };

    filteredIdeas.forEach((idea) => {
      groups[idea.type].push(idea);
    });

    return groups;
  }, [filteredIdeas]);

  // Type filter buttons
  const typeButtons = [
    { value: 'all', label: `All (${activeCount})` },
    ...Object.entries(TYPE_CONFIG).map(([type, config]) => ({
      value: type,
      label: config.label,
    })),
  ];

  return (
    <View style={styles.container}>
      {/* Header Summary */}
      <Surface style={styles.header} elevation={1}>
        <View style={styles.headerTop}>
          <View>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              Ideas
            </Text>
            <Text variant="bodySmall" style={styles.headerSubtitle}>
              {currentProject?.name || 'Project'} • {activeCount} active ideas
            </Text>
          </View>
          <IconButton
            icon={showArchived ? 'archive' : 'archive-outline'}
            iconColor={
              showArchived ? colors.accent.primary : colors.text.secondary
            }
            onPress={() => setShowArchived(!showArchived)}
            accessibilityLabel={
              showArchived ? 'Hide archived ideas' : 'Show archived ideas'
            }
          />
        </View>

        {/* Status counts */}
        <View style={styles.statusCounts}>
          <View style={styles.statusCountItem}>
            <Badge style={[styles.countBadge, { backgroundColor: colors.accent.primary }]}>
              {ideaCounts.new}
            </Badge>
            <Text variant="labelSmall" style={styles.statusCountLabel}>New</Text>
          </View>
          <View style={styles.statusCountItem}>
            <Badge style={[styles.countBadge, { backgroundColor: colors.taskStatus.in_progress }]}>
              {ideaCounts.reviewing}
            </Badge>
            <Text variant="labelSmall" style={styles.statusCountLabel}>Reviewing</Text>
          </View>
          <View style={styles.statusCountItem}>
            <Badge style={[styles.countBadge, { backgroundColor: colors.status.success }]}>
              {ideaCounts.accepted}
            </Badge>
            <Text variant="labelSmall" style={styles.statusCountLabel}>Accepted</Text>
          </View>
        </View>
      </Surface>

      {/* Search */}
      <Searchbar
        placeholder="Search ideas..."
        value={searchQuery}
        onChangeText={handleSearch}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
        iconColor={colors.text.muted}
        placeholderTextColor={colors.text.muted}
      />

      {/* Type Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {typeButtons.map((btn) => (
          <Chip
            key={btn.value}
            selected={selectedType === btn.value}
            onPress={() => handleTypeFilter(btn.value as IdeaType | 'all')}
            mode="outlined"
            style={[
              styles.filterChip,
              selectedType === btn.value && styles.filterChipSelected,
            ]}
            textStyle={[
              styles.filterChipText,
              selectedType === btn.value && styles.filterChipTextSelected,
            ]}
          >
            {btn.label}
          </Chip>
        ))}
      </ScrollView>

      {/* Swipe Hint */}
      <View style={styles.swipeHint}>
        <MaterialCommunityIcons
          name="gesture-swipe-horizontal"
          size={16}
          color={colors.text.muted}
        />
        <Text variant="labelSmall" style={styles.swipeHintText}>
          Swipe left to dismiss, right to archive
        </Text>
      </View>

      {/* Ideas List */}
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
        {filteredIdeas.length === 0 ? (
          <EmptyState
            icon="lightbulb-outline"
            title="No Ideas Found"
            description={
              searchQuery
                ? 'Try a different search term'
                : showArchived
                ? 'No archived ideas'
                : 'No active ideas'
            }
            actionLabel="Clear Filters"
            onAction={() => {
              setSearchQuery('');
              setSelectedType('all');
              clearFilters();
            }}
          />
        ) : selectedType === 'all' ? (
          // Grouped view
          <>
            {(['feature', 'improvement', 'bug_fix', 'research', 'other'] as const).map(
              (type) =>
                groupedIdeas[type].length > 0 && (
                  <View key={type} style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <MaterialCommunityIcons
                        name={TYPE_CONFIG[type].icon}
                        size={18}
                        color={TYPE_CONFIG[type].color}
                      />
                      <Text variant="titleSmall" style={styles.sectionTitle}>
                        {TYPE_CONFIG[type].label} ({groupedIdeas[type].length})
                      </Text>
                    </View>
                    {groupedIdeas[type].map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        onPress={() => handleIdeaPress(idea)}
                        onDismiss={() => dismissIdea(idea.id)}
                        onArchive={() => archiveIdea(idea.id)}
                        onConvertToTask={() => handleConvertToTask(idea)}
                        onUpvote={() => upvoteIdea(idea.id)}
                      />
                    ))}
                  </View>
                )
            )}
          </>
        ) : (
          // Flat view for single type
          <View style={styles.section}>
            {filteredIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onPress={() => handleIdeaPress(idea)}
                onDismiss={() => dismissIdea(idea.id)}
                onArchive={() => archiveIdea(idea.id)}
                onConvertToTask={() => handleConvertToTask(idea)}
                onUpvote={() => upvoteIdea(idea.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => setDetailModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          {selectedIdea && (
            <ScrollView>
              <View style={styles.modalHeader}>
                <MaterialCommunityIcons
                  name={TYPE_CONFIG[selectedIdea.type].icon}
                  size={24}
                  color={TYPE_CONFIG[selectedIdea.type].color}
                />
                <Text variant="headlineSmall" style={styles.modalTitle}>
                  {selectedIdea.title}
                </Text>
              </View>

              <View style={styles.modalSource}>
                <MaterialCommunityIcons
                  name={getSourceIcon(selectedIdea.source)}
                  size={16}
                  color={colors.text.muted}
                />
                <Text variant="labelMedium" style={styles.modalSourceText}>
                  {selectedIdea.source === 'ai' ? 'AI Generated' : 'User Submitted'}
                </Text>
                {selectedIdea.votes !== undefined && (
                  <>
                    <Text style={styles.modalSourceDot}>•</Text>
                    <MaterialCommunityIcons
                      name="arrow-up-bold"
                      size={16}
                      color={colors.accent.primary}
                    />
                    <Text variant="labelMedium" style={styles.modalVotes}>
                      {selectedIdea.votes} votes
                    </Text>
                  </>
                )}
              </View>

              <Text variant="bodyMedium" style={styles.modalDescription}>
                {selectedIdea.description}
              </Text>

              <Divider style={styles.modalDivider} />

              <View style={styles.modalDetails}>
                <View style={styles.modalDetailRow}>
                  <Text variant="labelMedium" style={styles.modalLabel}>
                    Type
                  </Text>
                  <Chip
                    compact
                    style={{
                      backgroundColor: TYPE_CONFIG[selectedIdea.type].color + '20',
                    }}
                  >
                    {TYPE_CONFIG[selectedIdea.type].label}
                  </Chip>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text variant="labelMedium" style={styles.modalLabel}>
                    Status
                  </Text>
                  <Chip
                    compact
                    style={{
                      backgroundColor: STATUS_CONFIG[selectedIdea.status].color + '20',
                    }}
                  >
                    {STATUS_CONFIG[selectedIdea.status].label}
                  </Chip>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text variant="labelMedium" style={styles.modalLabel}>
                    Created
                  </Text>
                  <Text variant="bodyMedium" style={styles.modalValue}>
                    {new Date(selectedIdea.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                {selectedIdea.linkedTaskId && (
                  <View style={styles.modalDetailRow}>
                    <Text variant="labelMedium" style={styles.modalLabel}>
                      Linked Task
                    </Text>
                    <Pressable
                      onPress={() => {
                        setDetailModalVisible(false);
                        router.push(`/task/${selectedIdea.linkedTaskId}`);
                      }}
                    >
                      <Text variant="bodyMedium" style={styles.modalLink}>
                        View Task →
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                {!selectedIdea.linkedTaskId &&
                  selectedIdea.status !== 'archived' &&
                  selectedIdea.status !== 'rejected' && (
                    <>
                      <Button
                        mode="contained"
                        onPress={() => {
                          setDetailModalVisible(false);
                          handleConvertToTask(selectedIdea);
                        }}
                        icon="clipboard-plus-outline"
                        style={styles.modalButton}
                      >
                        Convert to Task
                      </Button>
                      <View style={styles.modalButtonRow}>
                        <Button
                          mode="outlined"
                          onPress={() => {
                            archiveIdea(selectedIdea.id);
                            setDetailModalVisible(false);
                          }}
                          icon="archive-outline"
                          style={[styles.modalButton, styles.modalButtonHalf]}
                        >
                          Archive
                        </Button>
                        <Button
                          mode="outlined"
                          onPress={() => {
                            dismissIdea(selectedIdea.id);
                            setDetailModalVisible(false);
                          }}
                          icon="close-circle-outline"
                          style={[styles.modalButton, styles.modalButtonHalf]}
                          textColor={colors.status.error}
                        >
                          Dismiss
                        </Button>
                      </View>
                    </>
                  )}
                <Button
                  mode="text"
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

      {/* Add Idea FAB */}
      <FAB
        icon="plus"
        onPress={() => {
          // Placeholder for add idea functionality
        }}
        style={styles.fab}
        color={colors.text.inverse}
        accessibilityLabel="Add idea"
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
  statusCounts: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  statusCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  countBadge: {
    color: colors.text.primary,
  },
  statusCountLabel: {
    color: colors.text.muted,
  },
  searchBar: {
    margin: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background.secondary,
  },
  searchInput: {
    color: colors.text.primary,
  },
  filterScroll: {
    maxHeight: 48,
  },
  filterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  filterChip: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.surface.border,
  },
  filterChipSelected: {
    backgroundColor: colors.accent.primary + '30',
    borderColor: colors.accent.primary,
  },
  filterChipText: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  filterChipTextSelected: {
    color: colors.accent.primary,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  swipeHintText: {
    color: colors.text.muted,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ideaCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  ideaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  ideaTypeIcon: {
    marginTop: 2,
  },
  ideaTitleContainer: {
    flex: 1,
  },
  ideaTitle: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  ideaSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  ideaSourceText: {
    color: colors.text.muted,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  voteCount: {
    color: colors.accent.primary,
    fontWeight: 'bold',
  },
  ideaDescription: {
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  ideaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  typeChip: {
    borderRadius: borderRadius.sm,
  },
  statusChip: {
    borderRadius: borderRadius.sm,
  },
  chipText: {
    fontSize: 10,
    color: colors.text.primary,
  },
  linkedTask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
  },
  linkedTaskText: {
    color: colors.status.success,
  },
  ideaDate: {
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
  swipeActionLeft: {
    backgroundColor: colors.taskStatus.ai_review,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  swipeActionRight: {
    backgroundColor: colors.status.error,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  swipeActionContent: {
    alignItems: 'center',
  },
  swipeActionText: {
    color: colors.text.primary,
    marginTop: spacing.xs,
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
    marginBottom: spacing.sm,
  },
  modalTitle: {
    color: colors.text.primary,
    flex: 1,
    fontWeight: 'bold',
  },
  modalSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  modalSourceText: {
    color: colors.text.muted,
  },
  modalSourceDot: {
    color: colors.text.muted,
    marginHorizontal: spacing.xs,
  },
  modalVotes: {
    color: colors.accent.primary,
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
  modalLink: {
    color: colors.accent.primary,
  },
  modalActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  modalButton: {
    borderRadius: borderRadius.md,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButtonHalf: {
    flex: 1,
  },
});
