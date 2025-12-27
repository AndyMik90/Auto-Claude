/**
 * Projects Screen
 * Project list and management view with search, filters, and create project button
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import {
  Text,
  Surface,
  Searchbar,
  FAB,
  Badge,
  Menu,
  Divider,
  Snackbar,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ProjectListItem, EmptyState } from '../../components';
import {
  useProjectStore,
  useProjectCounts,
  useTotalProjectCount,
  useCurrentProject,
} from '../../stores/projectStore';
import type { Project, ProjectStatus } from '../../types';
import { colors, spacing, borderRadius, shadows } from '../../theme';

/**
 * Status filter options with labels and counts
 */
const STATUS_OPTIONS: { value: ProjectStatus | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'folder-multiple' },
  { value: 'active', label: 'Active', icon: 'play-circle' },
  { value: 'paused', label: 'Paused', icon: 'pause-circle' },
  { value: 'completed', label: 'Completed', icon: 'check-circle' },
  { value: 'archived', label: 'Archived', icon: 'archive' },
];

/**
 * Filter chip component for status filters
 */
const FilterChip: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
}> = ({ label, selected, onPress, count }) => (
  <Pressable
    onPress={onPress}
    style={[styles.filterChip, selected && styles.filterChipSelected]}
    accessibilityRole="button"
    accessibilityLabel={`Filter by ${label}${count !== undefined ? `, ${count} projects` : ''}`}
    accessibilityState={{ selected }}
  >
    <Text
      style={[styles.filterChipText, selected && styles.filterChipTextSelected]}
    >
      {label}
    </Text>
    {count !== undefined && count > 0 && (
      <Badge
        size={16}
        style={[styles.filterChipBadge, selected && styles.filterChipBadgeSelected]}
      >
        {count}
      </Badge>
    )}
  </Pressable>
);

/**
 * Projects tab screen component
 * Displays project list with search, filters, and create action
 */
export default function ProjectsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Store state
  const projects = useProjectStore((state) => state.projects);
  const filters = useProjectStore((state) => state.filters);
  const setFilters = useProjectStore((state) => state.setFilters);
  const clearFilters = useProjectStore((state) => state.clearFilters);
  const getFilteredProjects = useProjectStore((state) => state.getFilteredProjects);
  const selectProject = useProjectStore((state) => state.selectProject);
  const currentProject = useCurrentProject();
  const projectCounts = useProjectCounts();
  const totalCount = useTotalProjectCount();

  // Local state
  const [searchQuery, setSearchQuery] = useState(filters.search || '');
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Get filtered projects
  const filteredProjects = useMemo(() => {
    let result = getFilteredProjects();

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Sort by last opened (most recent first)
    return result.sort((a, b) => {
      const dateA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
      const dateB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [projects, filters, statusFilter, getFilteredProjects]);

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setFilters({ ...filters, search: query || undefined });
    },
    [filters, setFilters]
  );

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Handle status filter change
  const handleStatusFilter = useCallback(
    (status: ProjectStatus | 'all') => {
      setStatusFilter(status);
      if (status === 'all') {
        setFilters({ ...filters, status: undefined });
      } else {
        setFilters({ ...filters, status: [status] });
      }
    },
    [filters, setFilters]
  );

  // Handle project press
  const handleProjectPress = useCallback(
    (project: Project) => {
      selectProject(project.id);
      router.push(`/project/${project.id}`);
    },
    [selectProject, router]
  );

  // Handle project long press
  const handleProjectLongPress = useCallback(
    (project: Project) => {
      // Quick actions menu could be shown here
      // For now, just select the project
      selectProject(project.id);
    },
    [selectProject]
  );

  // Handle create project
  const handleCreateProject = useCallback(() => {
    // Show feedback - project creation will be implemented via desktop app
    // Mobile app is for monitoring and control, not full project creation
    setSnackbarMessage('Project creation is available via the desktop app');
    setSnackbarVisible(true);
  }, []);

  // Handle snackbar dismiss
  const handleDismissSnackbar = useCallback(() => {
    setSnackbarVisible(false);
  }, []);

  // Render project item
  const renderProjectItem = useCallback(
    ({ item }: { item: Project }) => (
      <ProjectListItem
        project={item}
        onPress={handleProjectPress}
        onLongPress={handleProjectLongPress}
        isSelected={item.id === currentProject?.id}
        testID={`project-item-${item.id}`}
      />
    ),
    [handleProjectPress, handleProjectLongPress, currentProject]
  );

  // Key extractor
  const keyExtractor = useCallback((item: Project) => item.id, []);

  // Get count for status filter
  const getStatusCount = useCallback(
    (status: ProjectStatus | 'all'): number => {
      if (status === 'all') return totalCount;
      return projectCounts[status] || 0;
    },
    [projectCounts, totalCount]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <Surface style={styles.header} elevation={1}>
        <View
          style={[
            styles.headerContent,
            { paddingTop: insets.top > 0 ? insets.top : spacing.md },
          ]}
        >
          {/* Title row */}
          <View style={styles.headerTitleRow}>
            <View style={styles.headerTitleContainer}>
              <Icon name="folder-multiple" size={24} color={colors.text.primary} />
              <Text variant="titleLarge" style={styles.headerTitle}>
                Projects
              </Text>
              <Badge size={20} style={styles.countBadge}>
                {totalCount}
              </Badge>
            </View>
            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              anchor={
                <Pressable
                  onPress={() => setSortMenuVisible(true)}
                  style={styles.sortButton}
                  accessibilityLabel="Sort options"
                  accessibilityRole="button"
                >
                  <Icon name="sort" size={20} color={colors.text.secondary} />
                </Pressable>
              }
              contentStyle={styles.menuContent}
            >
              <Menu.Item
                title="Last Opened"
                leadingIcon="clock-outline"
                onPress={() => setSortMenuVisible(false)}
              />
              <Menu.Item
                title="Name"
                leadingIcon="sort-alphabetical-ascending"
                onPress={() => setSortMenuVisible(false)}
              />
              <Menu.Item
                title="Most Tasks"
                leadingIcon="format-list-bulleted"
                onPress={() => setSortMenuVisible(false)}
              />
              <Divider />
              <Menu.Item
                title="Created Date"
                leadingIcon="calendar"
                onPress={() => setSortMenuVisible(false)}
              />
            </Menu>
          </View>

          {/* Search bar */}
          <Searchbar
            placeholder="Search projects..."
            onChangeText={handleSearch}
            value={searchQuery}
            style={styles.searchbar}
            inputStyle={styles.searchbarInput}
            iconColor={colors.text.muted}
            placeholderTextColor={colors.text.muted}
            accessibilityLabel="Search projects"
          />

          {/* Filter chips */}
          <View style={styles.filtersRow}>
            {STATUS_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                selected={statusFilter === option.value}
                onPress={() => handleStatusFilter(option.value)}
                count={getStatusCount(option.value)}
              />
            ))}
          </View>
        </View>
      </Surface>

      {/* Project List */}
      <FlatList
        data={filteredProjects}
        renderItem={renderProjectItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          filteredProjects.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.primary}
            colors={[colors.accent.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="folder-outline"
            title="No Projects Found"
            description={
              filters.search || statusFilter !== 'all'
                ? 'Try adjusting your filters or search query'
                : 'Create your first project to get started'
            }
            actionLabel={!filters.search && statusFilter === 'all' ? 'Create Project' : undefined}
            onAction={!filters.search && statusFilter === 'all' ? handleCreateProject : undefined}
          />
        }
        accessibilityLabel="Projects list"
        accessibilityRole="list"
      />

      {/* FAB for creating new project */}
      <FAB
        icon="plus"
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={handleCreateProject}
        color={colors.text.inverse}
        accessibilityLabel="Create new project"
        accessibilityHint="Opens project creation form"
      />

      {/* Snackbar for feedback */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={handleDismissSnackbar}
        duration={3000}
        style={styles.snackbar}
        action={{
          label: 'OK',
          onPress: handleDismissSnackbar,
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  // Header styles
  header: {
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  headerContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  countBadge: {
    backgroundColor: colors.accent.primary,
    color: colors.text.inverse,
  },
  sortButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
  },
  menuContent: {
    backgroundColor: colors.background.elevated,
  },
  // Search bar
  searchbar: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    elevation: 0,
  },
  searchbarInput: {
    color: colors.text.primary,
    fontSize: 14,
  },
  // Filters
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.surface.border,
    gap: spacing.xs,
  },
  filterChipSelected: {
    backgroundColor: colors.accent.primary + '20',
    borderColor: colors.accent.primary,
  },
  filterChipText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: colors.accent.primary,
  },
  filterChipBadge: {
    backgroundColor: colors.text.muted,
  },
  filterChipBadgeSelected: {
    backgroundColor: colors.accent.primary,
  },
  // List
  listContent: {
    paddingVertical: spacing.sm,
    flexGrow: 1,
  },
  listContentEmpty: {
    justifyContent: 'center',
  },
  // FAB
  fab: {
    position: 'absolute',
    right: spacing.md,
    backgroundColor: colors.accent.primary,
    ...shadows.medium,
  },
  // Snackbar
  snackbar: {
    backgroundColor: colors.background.elevated,
  },
});
