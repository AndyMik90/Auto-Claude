/**
 * Terminal List Screen
 * Displays list of active terminal sessions with filtering and real-time status
 * Links to terminal detail view for output viewing
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  ListRenderItemInfo,
} from 'react-native';
import {
  Text,
  Searchbar,
  Chip,
  Surface,
  FAB,
  Portal,
  Snackbar,
  SegmentedButtons,
} from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '../../theme';
import { useTerminalStore, useSessionCounts, useActiveSessionCount } from '../../stores/terminalStore';
import { TerminalListItem } from '../../components/TerminalListItem';
import { EmptyState } from '../../components/EmptyState';
import type { TerminalSession, TerminalStatus } from '../../types';

/**
 * Filter options for terminal sessions
 */
type StatusFilter = 'all' | TerminalStatus;

/**
 * Terminal list screen component
 * Shows all terminal sessions with filtering and search
 */
export default function TerminalListScreen() {
  const router = useRouter();

  // Store state
  const sessions = useTerminalStore((state) => state.sessions);
  const filters = useTerminalStore((state) => state.filters);
  const setFilters = useTerminalStore((state) => state.setFilters);
  const clearFilters = useTerminalStore((state) => state.clearFilters);
  const getFilteredSessions = useTerminalStore((state) => state.getFilteredSessions);
  const selectSession = useTerminalStore((state) => state.selectSession);
  const simulateOutput = useTerminalStore((state) => state.simulateOutput);

  // Session counts
  const sessionCounts = useSessionCounts();
  const activeCount = useActiveSessionCount();

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Apply filters to store
  useEffect(() => {
    setFilters({
      ...filters,
      search: searchQuery || undefined,
      status: statusFilter === 'all' ? undefined : [statusFilter],
    });
  }, [searchQuery, statusFilter, setFilters]);

  // Get filtered sessions
  const filteredSessions = useMemo(() => {
    return getFilteredSessions().sort((a, b) => {
      // Sort by status (active first) then by last activity
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      const aTime = new Date(a.lastActivityAt || a.updatedAt).getTime();
      const bTime = new Date(b.lastActivityAt || b.updatedAt).getTime();
      return bTime - aTime;
    });
  }, [getFilteredSessions, sessions]);

  // Simulate real-time updates for active sessions
  useEffect(() => {
    const activeSessions = sessions.filter((s) => s.status === 'active');
    if (activeSessions.length === 0) return;

    // Simulate output every 3-5 seconds for active sessions
    const interval = setInterval(() => {
      const randomSession = activeSessions[Math.floor(Math.random() * activeSessions.length)];
      if (randomSession) {
        const messages = [
          { type: 'stdout' as const, content: 'Processing...' },
          { type: 'info' as const, content: '[Claude] Analyzing code structure...' },
          { type: 'stdout' as const, content: 'Compiling TypeScript files...' },
          { type: 'command' as const, content: '$ npm run build' },
          { type: 'stdout' as const, content: 'Build successful!' },
        ];
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        simulateOutput(randomSession.id, randomMessage.type, randomMessage.content);
      }
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, [sessions, simulateOutput]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate refresh delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
    setSnackbarMessage('Terminal sessions refreshed');
    setSnackbarVisible(true);
  }, []);

  // Handle session press
  const handleSessionPress = useCallback(
    (session: TerminalSession) => {
      selectSession(session.id);
      router.push(`/terminal/${session.id}`);
    },
    [selectSession, router]
  );

  // Handle session long press
  const handleSessionLongPress = useCallback((session: TerminalSession) => {
    setSnackbarMessage(`Quick actions for: ${session.name}`);
    setSnackbarVisible(true);
  }, []);

  // Handle search
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Handle status filter change
  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value as StatusFilter);
  }, []);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    clearFilters();
  }, [clearFilters]);

  // Render session item
  const renderSessionItem = useCallback(
    ({ item }: ListRenderItemInfo<TerminalSession>) => (
      <TerminalListItem
        session={item}
        onPress={handleSessionPress}
        onLongPress={handleSessionLongPress}
        showPreview={true}
        testID={`terminal-item-${item.id}`}
      />
    ),
    [handleSessionPress, handleSessionLongPress]
  );

  // Key extractor
  const keyExtractor = useCallback((item: TerminalSession) => item.id, []);

  // Get item layout for performance
  const getItemLayout = useCallback(
    (_data: ArrayLike<TerminalSession> | null | undefined, index: number) => ({
      length: 160, // Approximate item height
      offset: 160 * index,
      index,
    }),
    []
  );

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (searchQuery || statusFilter !== 'all') {
      return (
        <EmptyState
          icon="console"
          title="No Matching Sessions"
          description="No terminal sessions match your current filters. Try adjusting your search or filters."
          actionLabel="Clear Filters"
          onAction={handleClearFilters}
        />
      );
    }
    return (
      <EmptyState
        icon="console"
        title="No Terminal Sessions"
        description="Terminal sessions will appear here when tasks are running or when you start an investigation."
      />
    );
  }, [searchQuery, statusFilter, handleClearFilters]);

  // Status filter options
  const statusFilterOptions = useMemo(() => [
    { value: 'all', label: `All (${sessions.length})` },
    { value: 'active', label: `Active (${sessionCounts.active})` },
    { value: 'idle', label: `Idle (${sessionCounts.idle})` },
    { value: 'error', label: `Error (${sessionCounts.error})` },
    { value: 'closed', label: `Closed (${sessionCounts.closed})` },
  ], [sessions.length, sessionCounts]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Terminals',
          headerStyle: { backgroundColor: colors.background.secondary },
          headerTintColor: colors.text.primary,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.container}>
        {/* Header with stats */}
        <Surface style={styles.headerCard} elevation={1}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text variant="headlineMedium" style={styles.statValue}>
                {sessions.length}
              </Text>
              <Text variant="labelSmall" style={styles.statLabel}>
                Total
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text variant="headlineMedium" style={[styles.statValue, { color: colors.status.success }]}>
                {activeCount}
              </Text>
              <Text variant="labelSmall" style={styles.statLabel}>
                Active
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text variant="headlineMedium" style={[styles.statValue, { color: colors.status.error }]}>
                {sessionCounts.error}
              </Text>
              <Text variant="labelSmall" style={styles.statLabel}>
                Errors
              </Text>
            </View>
          </View>
        </Surface>

        {/* Search bar */}
        <Searchbar
          placeholder="Search terminal sessions..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          onClearIconPress={handleClearSearch}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.text.muted}
          placeholderTextColor={colors.text.muted}
          accessibilityLabel="Search terminal sessions"
          accessibilityHint="Type to filter terminal sessions by name or content"
        />

        {/* Status filter chips */}
        <View style={styles.filtersContainer}>
          <SegmentedButtons
            value={statusFilter}
            onValueChange={handleStatusFilterChange}
            buttons={statusFilterOptions}
            style={styles.segmentedButtons}
            density="small"
          />
        </View>

        {/* Session list */}
        <FlatList
          data={filteredSessions}
          renderItem={renderSessionItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent.primary}
              colors={[colors.accent.primary]}
              progressBackgroundColor={colors.surface.secondary}
            />
          }
          ListEmptyComponent={renderEmptyState}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          accessibilityLabel="Terminal sessions list"
          accessibilityRole="list"
        />
      </View>

      {/* Snackbar for feedback */}
      <Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={2000}
          style={styles.snackbar}
        >
          {snackbarMessage}
        </Snackbar>
      </Portal>
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
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  statLabel: {
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.surface.divider,
  },
  searchbar: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    elevation: 0,
  },
  searchInput: {
    color: colors.text.primary,
    fontSize: 14,
  },
  filtersContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  segmentedButtons: {
    backgroundColor: colors.surface.primary,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  snackbar: {
    backgroundColor: colors.surface.secondary,
  },
});
