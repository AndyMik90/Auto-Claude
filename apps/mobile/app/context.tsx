/**
 * Context Screen
 * File tree navigation and memory search for exploring project context
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  FlatList,
} from 'react-native';
import {
  Text,
  Surface,
  Searchbar,
  IconButton,
  Chip,
  Divider,
  Portal,
  Modal,
  Button,
  SegmentedButtons,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, borderRadius } from '../theme';
import {
  useContextStore,
  useMemoryCounts,
  useTotalMemoryCount,
  useActiveTab,
  type MemoryCategory,
} from '../stores/contextStore';
import { useCurrentProject } from '../stores/projectStore';
import type { ContextFile, ContextMemory } from '../types';
import { EmptyState } from '../components';

/**
 * Memory category configuration
 */
const MEMORY_CATEGORY_CONFIG: Record<
  MemoryCategory,
  { label: string; color: string; icon: string }
> = {
  pattern: {
    label: 'Pattern',
    color: colors.taskStatus.in_progress,
    icon: 'puzzle-outline',
  },
  convention: {
    label: 'Convention',
    color: colors.accent.primary,
    icon: 'book-outline',
  },
  decision: {
    label: 'Decision',
    color: colors.taskStatus.ai_review,
    icon: 'scale-balance',
  },
  note: {
    label: 'Note',
    color: colors.text.muted,
    icon: 'note-text-outline',
  },
};

/**
 * File type configuration
 */
const getFileIcon = (file: ContextFile): { name: string; color: string } => {
  if (file.type === 'directory') {
    return { name: 'folder-outline', color: colors.accent.primary };
  }

  // Language-based icons
  const languageIcons: Record<string, { name: string; color: string }> = {
    typescript: { name: 'language-typescript', color: '#3178C6' },
    javascript: { name: 'language-javascript', color: '#F7DF1E' },
    json: { name: 'code-json', color: colors.text.muted },
    markdown: { name: 'language-markdown', color: colors.text.secondary },
    python: { name: 'language-python', color: '#3776AB' },
    rust: { name: 'language-rust', color: '#DEA584' },
    go: { name: 'language-go', color: '#00ADD8' },
  };

  if (file.language && languageIcons[file.language]) {
    return languageIcons[file.language];
  }

  return { name: 'file-outline', color: colors.text.muted };
};

/**
 * Format file size
 */
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * File Tree Item Component
 */
interface FileTreeItemProps {
  file: ContextFile;
  level: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
}

const FileTreeItem: React.FC<FileTreeItemProps> = React.memo(
  ({ file, level, isExpanded, onToggle, onSelect, isSelected }) => {
    const fileIcon = getFileIcon(file);
    const isDirectory = file.type === 'directory';

    return (
      <Pressable
        onPress={isDirectory ? onToggle : onSelect}
        style={[
          styles.fileTreeItem,
          { paddingLeft: spacing.md + level * spacing.md },
          isSelected && styles.fileTreeItemSelected,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${file.name}, ${isDirectory ? 'folder' : 'file'}`}
        accessibilityState={{
          expanded: isDirectory ? isExpanded : undefined,
          selected: isSelected,
        }}
      >
        {isDirectory && (
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-down' : 'chevron-right'}
            size={18}
            color={colors.text.muted}
            style={styles.fileTreeChevron}
          />
        )}
        {!isDirectory && <View style={styles.fileTreeChevronPlaceholder} />}

        <MaterialCommunityIcons
          name={
            isDirectory
              ? isExpanded
                ? 'folder-open-outline'
                : 'folder-outline'
              : fileIcon.name
          }
          size={18}
          color={isDirectory ? colors.accent.primary : fileIcon.color}
        />

        <Text
          variant="bodyMedium"
          style={styles.fileTreeName}
          numberOfLines={1}
        >
          {file.name}
        </Text>

        {!isDirectory && file.size && (
          <Text variant="labelSmall" style={styles.fileTreeSize}>
            {formatFileSize(file.size)}
          </Text>
        )}
      </Pressable>
    );
  }
);

FileTreeItem.displayName = 'FileTreeItem';

/**
 * Recursive File Tree Component
 */
interface FileTreeProps {
  files: ContextFile[];
  level?: number;
  expandedDirs: Set<string>;
  onToggleDir: (id: string) => void;
  onSelectFile: (file: ContextFile) => void;
  selectedId: string | null;
}

const FileTree: React.FC<FileTreeProps> = ({
  files,
  level = 0,
  expandedDirs,
  onToggleDir,
  onSelectFile,
  selectedId,
}) => {
  return (
    <>
      {files.map((file) => (
        <React.Fragment key={file.id}>
          <FileTreeItem
            file={file}
            level={level}
            isExpanded={expandedDirs.has(file.id)}
            onToggle={() => onToggleDir(file.id)}
            onSelect={() => onSelectFile(file)}
            isSelected={selectedId === file.id}
          />
          {file.type === 'directory' &&
            expandedDirs.has(file.id) &&
            file.children && (
              <FileTree
                files={file.children}
                level={level + 1}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                selectedId={selectedId}
              />
            )}
        </React.Fragment>
      ))}
    </>
  );
};

/**
 * Memory Item Component
 */
interface MemoryItemProps {
  memory: ContextMemory;
  onPress: () => void;
  isSelected: boolean;
}

const MemoryItem: React.FC<MemoryItemProps> = React.memo(
  ({ memory, onPress, isSelected }) => {
    const categoryConfig = MEMORY_CATEGORY_CONFIG[memory.category];

    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${memory.key}, ${categoryConfig.label}`}
        accessibilityState={{ selected: isSelected }}
      >
        <Surface
          style={[styles.memoryCard, isSelected && styles.memoryCardSelected]}
          elevation={1}
        >
          <View style={styles.memoryHeader}>
            <MaterialCommunityIcons
              name={categoryConfig.icon}
              size={18}
              color={categoryConfig.color}
            />
            <Text
              variant="titleSmall"
              style={styles.memoryKey}
              numberOfLines={1}
            >
              {memory.key}
            </Text>
            <Chip
              mode="flat"
              compact
              textStyle={styles.memoryCategoryChipText}
              style={[
                styles.memoryCategoryChip,
                { backgroundColor: categoryConfig.color + '20' },
              ]}
            >
              {categoryConfig.label}
            </Chip>
          </View>

          <Text
            variant="bodySmall"
            style={styles.memoryValue}
            numberOfLines={3}
          >
            {memory.value}
          </Text>

          <Text variant="labelSmall" style={styles.memoryDate}>
            Updated: {new Date(memory.updatedAt).toLocaleDateString()}
          </Text>
        </Surface>
      </Pressable>
    );
  }
);

MemoryItem.displayName = 'MemoryItem';

/**
 * Context Screen Component
 */
export default function ContextScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    MemoryCategory | 'all'
  >('all');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ContextFile | null>(null);
  const [selectedMemoryItem, setSelectedMemoryItem] =
    useState<ContextMemory | null>(null);

  const {
    fileTree,
    memories,
    expandedDirs,
    selectedId,
    selectedType,
    activeTab,
    toggleDir,
    expandAll,
    collapseAll,
    select,
    clearSelection,
    setActiveTab,
    setFilters,
    clearFilters,
    getFilteredMemories,
    searchFiles,
  } = useContextStore();
  const memoryCounts = useMemoryCounts();
  const totalMemoryCount = useTotalMemoryCount();
  const currentProject = useCurrentProject();

  // Handle tab change
  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value as 'files' | 'memories');
      setSearchQuery('');
      clearSelection();
    },
    [setActiveTab, clearSelection]
  );

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (activeTab === 'memories') {
        setFilters({
          search: query || undefined,
          memoryCategory:
            selectedCategory !== 'all' ? [selectedCategory] : undefined,
        });
      }
    },
    [activeTab, selectedCategory, setFilters]
  );

  // Handle category filter
  const handleCategoryFilter = useCallback(
    (category: MemoryCategory | 'all') => {
      setSelectedCategory(category);
      setFilters({
        search: searchQuery || undefined,
        memoryCategory: category !== 'all' ? [category] : undefined,
      });
    },
    [searchQuery, setFilters]
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(
    (file: ContextFile) => {
      select(file.id, 'file');
      setSelectedFile(file);
      setDetailModalVisible(true);
    },
    [select]
  );

  // Handle memory selection
  const handleMemorySelect = useCallback(
    (memory: ContextMemory) => {
      select(memory.id, 'memory');
      setSelectedMemoryItem(memory);
      setDetailModalVisible(true);
    },
    [select]
  );

  // Get filtered memories
  const filteredMemories = useMemo(() => {
    let filtered = getFilteredMemories();

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((m) => m.category === selectedCategory);
    }

    // Apply search
    if (searchQuery && activeTab === 'memories') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.key.toLowerCase().includes(query) ||
          m.value.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [getFilteredMemories, memories, selectedCategory, searchQuery, activeTab]);

  // Get search results for files
  const fileSearchResults = useMemo(() => {
    if (!searchQuery || activeTab !== 'files') return [];
    return searchFiles(searchQuery);
  }, [searchQuery, activeTab, searchFiles]);

  // Category filter buttons
  const categoryButtons = [
    { value: 'all', label: `All (${totalMemoryCount})` },
    ...Object.entries(MEMORY_CATEGORY_CONFIG).map(([cat, config]) => ({
      value: cat,
      label: `${config.label} (${memoryCounts[cat as MemoryCategory]})`,
    })),
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <Surface style={styles.header} elevation={1}>
        <View style={styles.headerTop}>
          <View>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              Context
            </Text>
            <Text variant="bodySmall" style={styles.headerSubtitle}>
              {currentProject?.name || 'Project'} • Browse files and memories
            </Text>
          </View>
        </View>

        {/* Tab Selector */}
        <SegmentedButtons
          value={activeTab}
          onValueChange={handleTabChange}
          buttons={[
            {
              value: 'files',
              label: 'Files',
              icon: 'file-tree',
            },
            {
              value: 'memories',
              label: `Memories (${totalMemoryCount})`,
              icon: 'brain',
            },
          ]}
          style={styles.tabSelector}
        />
      </Surface>

      {/* Search */}
      <Searchbar
        placeholder={
          activeTab === 'files' ? 'Search files...' : 'Search memories...'
        }
        value={searchQuery}
        onChangeText={handleSearch}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
        iconColor={colors.text.muted}
        placeholderTextColor={colors.text.muted}
      />

      {/* Files Tab */}
      {activeTab === 'files' && (
        <>
          {/* Tree Controls */}
          <View style={styles.treeControls}>
            <Text variant="labelMedium" style={styles.treeControlsLabel}>
              File Tree
            </Text>
            <View style={styles.treeControlsButtons}>
              <IconButton
                icon="expand-all"
                size={20}
                iconColor={colors.text.secondary}
                onPress={expandAll}
                accessibilityLabel="Expand all folders"
              />
              <IconButton
                icon="collapse-all"
                size={20}
                iconColor={colors.text.secondary}
                onPress={collapseAll}
                accessibilityLabel="Collapse all folders"
              />
            </View>
          </View>

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
            {searchQuery ? (
              // Show search results
              fileSearchResults.length === 0 ? (
                <EmptyState
                  icon="file-search-outline"
                  title="No Files Found"
                  description="Try a different search term"
                  actionLabel="Clear Search"
                  onAction={() => setSearchQuery('')}
                />
              ) : (
                <View style={styles.searchResults}>
                  <Text variant="labelMedium" style={styles.searchResultsLabel}>
                    {fileSearchResults.length} results
                  </Text>
                  {fileSearchResults.map((file) => (
                    <Pressable
                      key={file.id}
                      onPress={() => handleFileSelect(file)}
                      style={styles.searchResultItem}
                    >
                      <MaterialCommunityIcons
                        name={getFileIcon(file).name}
                        size={18}
                        color={getFileIcon(file).color}
                      />
                      <View style={styles.searchResultContent}>
                        <Text
                          variant="bodyMedium"
                          style={styles.searchResultName}
                        >
                          {file.name}
                        </Text>
                        <Text
                          variant="labelSmall"
                          style={styles.searchResultPath}
                          numberOfLines={1}
                        >
                          {file.path}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )
            ) : (
              // Show file tree
              <FileTree
                files={fileTree}
                expandedDirs={expandedDirs}
                onToggleDir={toggleDir}
                onSelectFile={handleFileSelect}
                selectedId={selectedType === 'file' ? selectedId : null}
              />
            )}
          </ScrollView>
        </>
      )}

      {/* Memories Tab */}
      {activeTab === 'memories' && (
        <>
          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContent}
          >
            {categoryButtons.map((btn) => (
              <Chip
                key={btn.value}
                selected={selectedCategory === btn.value}
                onPress={() =>
                  handleCategoryFilter(btn.value as MemoryCategory | 'all')
                }
                mode="outlined"
                style={[
                  styles.filterChip,
                  selectedCategory === btn.value && styles.filterChipSelected,
                ]}
                textStyle={[
                  styles.filterChipText,
                  selectedCategory === btn.value &&
                    styles.filterChipTextSelected,
                ]}
              >
                {btn.label}
              </Chip>
            ))}
          </ScrollView>

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
            {filteredMemories.length === 0 ? (
              <EmptyState
                icon="brain"
                title="No Memories Found"
                description={
                  searchQuery
                    ? 'Try a different search term'
                    : 'No memories in this category'
                }
                actionLabel="Clear Filters"
                onAction={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  clearFilters();
                }}
              />
            ) : (
              filteredMemories.map((memory) => (
                <MemoryItem
                  key={memory.id}
                  memory={memory}
                  onPress={() => handleMemorySelect(memory)}
                  isSelected={
                    selectedType === 'memory' && selectedId === memory.id
                  }
                />
              ))
            )}
          </ScrollView>
        </>
      )}

      {/* Detail Modal */}
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => {
            setDetailModalVisible(false);
            setSelectedFile(null);
            setSelectedMemoryItem(null);
          }}
          contentContainerStyle={styles.modalContent}
        >
          <ScrollView>
            {selectedFile && (
              <>
                <View style={styles.modalHeader}>
                  <MaterialCommunityIcons
                    name={getFileIcon(selectedFile).name}
                    size={24}
                    color={getFileIcon(selectedFile).color}
                  />
                  <Text variant="headlineSmall" style={styles.modalTitle}>
                    {selectedFile.name}
                  </Text>
                </View>

                <Text variant="bodySmall" style={styles.modalPath}>
                  {selectedFile.path}
                </Text>

                <Divider style={styles.modalDivider} />

                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text variant="labelMedium" style={styles.modalLabel}>
                      Type
                    </Text>
                    <Text variant="bodyMedium" style={styles.modalValue}>
                      {selectedFile.type === 'directory' ? 'Directory' : 'File'}
                    </Text>
                  </View>

                  {selectedFile.language && (
                    <View style={styles.modalDetailRow}>
                      <Text variant="labelMedium" style={styles.modalLabel}>
                        Language
                      </Text>
                      <Text variant="bodyMedium" style={styles.modalValue}>
                        {selectedFile.language}
                      </Text>
                    </View>
                  )}

                  {selectedFile.size && (
                    <View style={styles.modalDetailRow}>
                      <Text variant="labelMedium" style={styles.modalLabel}>
                        Size
                      </Text>
                      <Text variant="bodyMedium" style={styles.modalValue}>
                        {formatFileSize(selectedFile.size)}
                      </Text>
                    </View>
                  )}

                  {selectedFile.lastModified && (
                    <View style={styles.modalDetailRow}>
                      <Text variant="labelMedium" style={styles.modalLabel}>
                        Last Modified
                      </Text>
                      <Text variant="bodyMedium" style={styles.modalValue}>
                        {new Date(selectedFile.lastModified).toLocaleString()}
                      </Text>
                    </View>
                  )}

                  {selectedFile.type === 'directory' && selectedFile.children && (
                    <View style={styles.modalDetailRow}>
                      <Text variant="labelMedium" style={styles.modalLabel}>
                        Contents
                      </Text>
                      <Text variant="bodyMedium" style={styles.modalValue}>
                        {selectedFile.children.length} items
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {selectedMemoryItem && (
              <>
                <View style={styles.modalHeader}>
                  <MaterialCommunityIcons
                    name={
                      MEMORY_CATEGORY_CONFIG[selectedMemoryItem.category].icon
                    }
                    size={24}
                    color={
                      MEMORY_CATEGORY_CONFIG[selectedMemoryItem.category].color
                    }
                  />
                  <Text variant="headlineSmall" style={styles.modalTitle}>
                    {selectedMemoryItem.key}
                  </Text>
                </View>

                <Chip
                  compact
                  style={[
                    styles.memoryCategoryChipLarge,
                    {
                      backgroundColor:
                        MEMORY_CATEGORY_CONFIG[selectedMemoryItem.category]
                          .color + '20',
                    },
                  ]}
                >
                  {MEMORY_CATEGORY_CONFIG[selectedMemoryItem.category].label}
                </Chip>

                <Divider style={styles.modalDivider} />

                <Text variant="bodyMedium" style={styles.modalMemoryValue}>
                  {selectedMemoryItem.value}
                </Text>

                <Divider style={styles.modalDivider} />

                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text variant="labelMedium" style={styles.modalLabel}>
                      Created
                    </Text>
                    <Text variant="bodyMedium" style={styles.modalValue}>
                      {new Date(
                        selectedMemoryItem.createdAt
                      ).toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={styles.modalDetailRow}>
                    <Text variant="labelMedium" style={styles.modalLabel}>
                      Updated
                    </Text>
                    <Text variant="bodyMedium" style={styles.modalValue}>
                      {new Date(
                        selectedMemoryItem.updatedAt
                      ).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => {
                  setDetailModalVisible(false);
                  setSelectedFile(null);
                  setSelectedMemoryItem(null);
                }}
                style={styles.modalButton}
              >
                Close
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
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
    marginBottom: spacing.md,
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  tabSelector: {
    backgroundColor: colors.background.tertiary,
  },
  searchBar: {
    margin: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background.secondary,
  },
  searchInput: {
    color: colors.text.primary,
  },
  treeControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  treeControlsLabel: {
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  treeControlsButtons: {
    flexDirection: 'row',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  fileTreeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    gap: spacing.xs,
  },
  fileTreeItemSelected: {
    backgroundColor: colors.accent.primary + '20',
  },
  fileTreeChevron: {
    marginRight: spacing.xs,
  },
  fileTreeChevronPlaceholder: {
    width: 18,
    marginRight: spacing.xs,
  },
  fileTreeName: {
    flex: 1,
    color: colors.text.primary,
  },
  fileTreeSize: {
    color: colors.text.muted,
  },
  searchResults: {
    padding: spacing.md,
  },
  searchResultsLabel: {
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    color: colors.text.primary,
  },
  searchResultPath: {
    color: colors.text.muted,
  },
  memoryCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  memoryCardSelected: {
    borderWidth: 1,
    borderColor: colors.accent.primary,
  },
  memoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  memoryKey: {
    flex: 1,
    color: colors.text.primary,
    fontWeight: '600',
  },
  memoryCategoryChip: {
    borderRadius: borderRadius.sm,
  },
  memoryCategoryChipText: {
    fontSize: 10,
    color: colors.text.primary,
  },
  memoryCategoryChipLarge: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  memoryValue: {
    color: colors.text.secondary,
    lineHeight: 20,
  },
  memoryDate: {
    color: colors.text.muted,
    marginTop: spacing.sm,
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
  modalPath: {
    color: colors.text.muted,
    marginBottom: spacing.sm,
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
  modalMemoryValue: {
    color: colors.text.secondary,
    lineHeight: 22,
  },
  modalActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  modalButton: {
    borderRadius: borderRadius.md,
  },
});
