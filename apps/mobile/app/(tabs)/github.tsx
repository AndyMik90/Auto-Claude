/**
 * GitHub Screen
 * GitHub issues and pull requests list view with segmented control
 * Includes filterable lists and action buttons for investigate/auto-fix
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
  Chip,
  Searchbar,
  IconButton,
  SegmentedButtons,
  Menu,
  Divider,
  Badge,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { IssueListItem, PRListItem, EmptyState } from '../../components';
import {
  useGitHubStore,
  useOpenIssueCount,
  useOpenPRCount,
  useGitHubIntegrationStatus,
} from '../../stores/githubStore';
import type { GitHubIssue, GitHubPR, IssueState, PRState } from '../../types';
import { colors, spacing, borderRadius, shadows } from '../../theme';

/**
 * Filter chip component for state filters
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
    accessibilityLabel={`Filter by ${label}${count !== undefined ? `, ${count} items` : ''}`}
    accessibilityState={{ selected }}
  >
    <Text
      style={[styles.filterChipText, selected && styles.filterChipTextSelected]}
    >
      {label}
    </Text>
    {count !== undefined && (
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
 * GitHub tab screen component
 * Displays issues and pull requests with filtering and search
 */
export default function GitHubScreen() {
  const insets = useSafeAreaInsets();

  // Store state
  const activeTab = useGitHubStore((state) => state.activeTab);
  const setActiveTab = useGitHubStore((state) => state.setActiveTab);
  const issues = useGitHubStore((state) => state.issues);
  const pullRequests = useGitHubStore((state) => state.pullRequests);
  const issueFilters = useGitHubStore((state) => state.issueFilters);
  const prFilters = useGitHubStore((state) => state.prFilters);
  const setIssueFilters = useGitHubStore((state) => state.setIssueFilters);
  const setPRFilters = useGitHubStore((state) => state.setPRFilters);
  const getFilteredIssues = useGitHubStore((state) => state.getFilteredIssues);
  const getFilteredPRs = useGitHubStore((state) => state.getFilteredPRs);
  const investigateIssue = useGitHubStore((state) => state.investigateIssue);
  const stopInvestigation = useGitHubStore((state) => state.stopInvestigation);
  const autoFixIssue = useGitHubStore((state) => state.autoFixIssue);
  const stopAutoFix = useGitHubStore((state) => state.stopAutoFix);
  const investigatePR = useGitHubStore((state) => state.investigatePR);
  const stopPRInvestigation = useGitHubStore((state) => state.stopPRInvestigation);
  const getIssueCounts = useGitHubStore((state) => state.getIssueCounts);
  const getPRCounts = useGitHubStore((state) => state.getPRCounts);

  const openIssueCount = useOpenIssueCount();
  const openPRCount = useOpenPRCount();
  const integrationStatus = useGitHubIntegrationStatus();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);

  // Get filtered data
  const filteredIssues = useMemo(() => getFilteredIssues(), [issues, issueFilters]);
  const filteredPRs = useMemo(() => getFilteredPRs(), [pullRequests, prFilters]);
  const issueCounts = useMemo(() => getIssueCounts(), [issues]);
  const prCounts = useMemo(() => getPRCounts(), [pullRequests]);

  // Current state filters
  const currentIssueStateFilters = issueFilters.state || [];
  const currentPRStateFilters = prFilters.state || [];

  // Handle tab change
  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value as 'issues' | 'prs');
    },
    [setActiveTab]
  );

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (activeTab === 'issues') {
        setIssueFilters({ ...issueFilters, search: query || undefined });
      } else {
        setPRFilters({ ...prFilters, search: query || undefined });
      }
    },
    [activeTab, issueFilters, prFilters, setIssueFilters, setPRFilters]
  );

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Handle issue state filter toggle
  const handleIssueStateFilter = useCallback(
    (state: IssueState) => {
      const currentStates = issueFilters.state || [];
      const newStates = currentStates.includes(state)
        ? currentStates.filter((s) => s !== state)
        : [...currentStates, state];
      setIssueFilters({
        ...issueFilters,
        state: newStates.length > 0 ? newStates : undefined,
      });
    },
    [issueFilters, setIssueFilters]
  );

  // Handle PR state filter toggle
  const handlePRStateFilter = useCallback(
    (state: PRState) => {
      const currentStates = prFilters.state || [];
      const newStates = currentStates.includes(state)
        ? currentStates.filter((s) => s !== state)
        : [...currentStates, state];
      setPRFilters({
        ...prFilters,
        state: newStates.length > 0 ? newStates : undefined,
      });
    },
    [prFilters, setPRFilters]
  );

  // Handle issue actions
  const handleInvestigateIssue = useCallback(
    (issue: GitHubIssue) => {
      if (issue.isInvestigating) {
        stopInvestigation(issue.id);
      } else {
        investigateIssue(issue.id);
      }
    },
    [investigateIssue, stopInvestigation]
  );

  const handleAutoFixIssue = useCallback(
    (issue: GitHubIssue) => {
      if (issue.isAutoFixing) {
        stopAutoFix(issue.id);
      } else {
        autoFixIssue(issue.id);
      }
    },
    [autoFixIssue, stopAutoFix]
  );

  // Handle PR actions
  const handleInvestigatePR = useCallback(
    (pr: GitHubPR) => {
      if (pr.isInvestigating) {
        stopPRInvestigation(pr.id);
      } else {
        investigatePR(pr.id);
      }
    },
    [investigatePR, stopPRInvestigation]
  );

  // Render issue item
  const renderIssueItem = useCallback(
    ({ item }: { item: GitHubIssue }) => (
      <IssueListItem
        issue={item}
        onInvestigate={handleInvestigateIssue}
        onAutoFix={handleAutoFixIssue}
        testID={`issue-item-${item.id}`}
      />
    ),
    [handleInvestigateIssue, handleAutoFixIssue]
  );

  // Render PR item
  const renderPRItem = useCallback(
    ({ item }: { item: GitHubPR }) => (
      <PRListItem
        pr={item}
        onInvestigate={handleInvestigatePR}
        testID={`pr-item-${item.id}`}
      />
    ),
    [handleInvestigatePR]
  );

  // Key extractors
  const issueKeyExtractor = useCallback((item: GitHubIssue) => item.id, []);
  const prKeyExtractor = useCallback((item: GitHubPR) => item.id, []);

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
          {/* Title and integration status */}
          <View style={styles.headerTitleRow}>
            <View style={styles.headerTitleContainer}>
              <Icon name="github" size={24} color={colors.text.primary} />
              <Text variant="titleLarge" style={styles.headerTitle}>
                GitHub
              </Text>
            </View>
            {integrationStatus.isConnected && (
              <View style={styles.integrationStatus}>
                <View style={styles.connectedDot} />
                <Text variant="labelSmall" style={styles.connectedText}>
                  Connected
                </Text>
              </View>
            )}
          </View>

          {/* Segmented control for Issues/PRs */}
          <View style={styles.segmentedContainer}>
            <SegmentedButtons
              value={activeTab}
              onValueChange={handleTabChange}
              buttons={[
                {
                  value: 'issues',
                  label: `Issues (${openIssueCount})`,
                  icon: 'alert-circle-outline',
                  accessibilityLabel: `Issues tab, ${openIssueCount} open`,
                },
                {
                  value: 'prs',
                  label: `PRs (${openPRCount})`,
                  icon: 'source-pull',
                  accessibilityLabel: `Pull requests tab, ${openPRCount} open`,
                },
              ]}
              style={styles.segmentedButtons}
              density="regular"
            />
          </View>

          {/* Search bar */}
          <Searchbar
            placeholder={activeTab === 'issues' ? 'Search issues...' : 'Search PRs...'}
            onChangeText={handleSearch}
            value={searchQuery}
            style={styles.searchbar}
            inputStyle={styles.searchbarInput}
            iconColor={colors.text.muted}
            placeholderTextColor={colors.text.muted}
            accessibilityLabel={activeTab === 'issues' ? 'Search issues' : 'Search pull requests'}
          />

          {/* Filter chips */}
          <View style={styles.filtersRow}>
            {activeTab === 'issues' ? (
              <>
                <FilterChip
                  label="Open"
                  selected={currentIssueStateFilters.includes('open')}
                  onPress={() => handleIssueStateFilter('open')}
                  count={issueCounts.open}
                />
                <FilterChip
                  label="Closed"
                  selected={currentIssueStateFilters.includes('closed')}
                  onPress={() => handleIssueStateFilter('closed')}
                  count={issueCounts.closed}
                />
              </>
            ) : (
              <>
                <FilterChip
                  label="Open"
                  selected={currentPRStateFilters.includes('open')}
                  onPress={() => handlePRStateFilter('open')}
                  count={prCounts.open}
                />
                <FilterChip
                  label="Merged"
                  selected={currentPRStateFilters.includes('merged')}
                  onPress={() => handlePRStateFilter('merged')}
                  count={prCounts.merged}
                />
                <FilterChip
                  label="Closed"
                  selected={currentPRStateFilters.includes('closed')}
                  onPress={() => handlePRStateFilter('closed')}
                  count={prCounts.closed}
                />
              </>
            )}
          </View>
        </View>
      </Surface>

      {/* List Content */}
      {activeTab === 'issues' ? (
        <FlatList
          data={filteredIssues}
          renderItem={renderIssueItem}
          keyExtractor={issueKeyExtractor}
          contentContainerStyle={styles.listContent}
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
              icon="alert-circle-outline"
              title="No Issues Found"
              description={
                issueFilters.search || issueFilters.state
                  ? 'Try adjusting your filters or search query'
                  : 'No issues in this repository'
              }
              compact
            />
          }
          accessibilityLabel="Issues list"
          accessibilityRole="list"
        />
      ) : (
        <FlatList
          data={filteredPRs}
          renderItem={renderPRItem}
          keyExtractor={prKeyExtractor}
          contentContainerStyle={styles.listContent}
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
              icon="source-pull"
              title="No Pull Requests Found"
              description={
                prFilters.search || prFilters.state
                  ? 'Try adjusting your filters or search query'
                  : 'No pull requests in this repository'
              }
              compact
            />
          }
          accessibilityLabel="Pull requests list"
          accessibilityRole="list"
        />
      )}
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
  integrationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  connectedText: {
    color: colors.status.success,
  },
  // Segmented control
  segmentedContainer: {
    marginBottom: spacing.md,
  },
  segmentedButtons: {
    backgroundColor: colors.surface.primary,
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
    color: colors.text.primary,
  },
  filterChipBadgeSelected: {
    backgroundColor: colors.accent.primary,
  },
  // List
  listContent: {
    paddingVertical: spacing.sm,
    flexGrow: 1,
  },
});
