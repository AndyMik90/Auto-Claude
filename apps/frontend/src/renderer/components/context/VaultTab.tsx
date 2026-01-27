/**
 * VaultTab - External vault browser and search for Context panel
 *
 * Provides access to vault files, context, and learnings within the context panel.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  File,
  Search,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Brain,
  Users,
  RefreshCw,
  Loader2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useSettingsStore } from '../../stores/settings-store';
import { useVaultStore, loadVaultContext, searchVault } from '../../stores/context-store';
import type { VaultFile, VaultSearchResult } from '../../../shared/types/vault';

interface VaultTabProps {
  className?: string;
}

/**
 * Vault browser and search tab for context panel
 */
export function VaultTab({ className }: VaultTabProps) {
  const { settings } = useSettingsStore();
  const {
    vaultContext,
    vaultLoading,
    vaultError,
    vaultFiles,
    vaultSearchResults,
    vaultSearchLoading,
  } = useVaultStore();

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const vaultPath = settings?.globalVaultPath;
  const vaultEnabled = settings?.vaultEnabled ?? false;

  // Load vault context when component mounts
  useEffect(() => {
    if (vaultPath && vaultEnabled) {
      loadVaultContext(vaultPath);
    }
  }, [vaultPath, vaultEnabled]);

  // Handle search with debounce
  useEffect(() => {
    if (!vaultPath || !vaultEnabled) return;

    const timer = setTimeout(() => {
      if (searchInput.trim()) {
        searchVault(vaultPath, searchInput.trim());
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, vaultPath, vaultEnabled]);

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleFileClick = async (file: VaultFile) => {
    if (file.isDirectory) {
      toggleExpanded(file.path);
      return;
    }

    setSelectedFile(file.path);
    setIsLoadingContent(true);

    try {
      const result = await window.electronAPI.readVaultFile(vaultPath!, file.path);
      if (result.success && result.data) {
        setFileContent(result.data);
      } else {
        setFileContent(`Error: ${result.error || 'Failed to read file'}`);
      }
    } catch (error) {
      setFileContent(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleRefresh = () => {
    if (vaultPath && vaultEnabled) {
      loadVaultContext(vaultPath);
    }
  };

  const copyPathToClipboard = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (e) {
      console.warn('Failed to copy path:', e);
    }
  };

  // Render file tree recursively
  const renderFileTree = (files: VaultFile[], depth = 0) => {
    return files.map((file) => {
      const isExpanded = expandedPaths.has(file.path);
      const isSelected = selectedFile === file.path;

      return (
        <div key={file.path}>
          <button
            type="button"
            onClick={() => handleFileClick(file)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-md transition-colors',
              isSelected
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted text-foreground',
              depth > 0 && 'pl-4'
            )}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            {file.isDirectory ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
              </>
            ) : (
              <>
                <span className="w-3.5" />
                <File className="h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            )}
            <span className="truncate">{file.name}</span>
          </button>

          {file.isDirectory && isExpanded && file.children && (
            <div>{renderFileTree(file.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  // Render search results
  const renderSearchResults = (results: VaultSearchResult[]) => {
    return results.map((result) => (
      <div
        key={result.file.path}
        className="border-b border-border last:border-b-0"
      >
        <button
          type="button"
          onClick={() => handleFileClick(result.file)}
          className={cn(
            'w-full flex items-start gap-2 p-3 text-left transition-colors hover:bg-muted',
            selectedFile === result.file.path && 'bg-primary/10'
          )}
        >
          <File className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{result.file.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {result.file.path}
            </p>
            <div className="mt-1 space-y-0.5">
              {result.matches.slice(0, 3).map((match, idx) => (
                <p
                  key={idx}
                  className="text-xs text-muted-foreground truncate"
                >
                  <span className="text-muted-foreground/50">
                    L{match.lineNumber}:
                  </span>{' '}
                  {match.line}
                </p>
              ))}
              {result.matches.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{result.matches.length - 3} more matches
                </p>
              )}
            </div>
          </div>
        </button>
      </div>
    ));
  };

  // Not configured state
  if (!vaultPath || !vaultEnabled) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-6 text-center', className)}>
        <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          No Vault Configured
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure an external vault in Settings → Account → Vault to access your
          knowledge base and learnings.
        </p>
        <Button variant="outline" onClick={() => window.electronAPI.openExternal('')}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open Settings
        </Button>
      </div>
    );
  }

  // Loading state
  if (vaultLoading) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">Loading vault...</p>
      </div>
    );
  }

  // Error state
  if (vaultError) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-6 text-center', className)}>
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Failed to Load Vault
        </h3>
        <p className="text-sm text-destructive mb-4">{vaultError}</p>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with search */}
      <div className="p-4 border-b border-border space-y-3">
        {/* Quick access badges */}
        <div className="flex flex-wrap gap-2">
          {vaultContext?.claudeMd && (
            <button
              type="button"
              onClick={() => handleFileClick({ name: 'CLAUDE.md', path: '.claude/CLAUDE.md', isDirectory: false, size: null, modifiedAt: '' })}
              className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md hover:bg-primary/20 transition-colors"
            >
              <BookOpen className="h-3 w-3" />
              CLAUDE.md
            </button>
          )}
          {vaultContext?.preferences && (
            <button
              type="button"
              onClick={() => handleFileClick({ name: 'preferences.md', path: 'memory/context/preferences.md', isDirectory: false, size: null, modifiedAt: '' })}
              className="inline-flex items-center gap-1 text-xs bg-success/10 text-success px-2 py-1 rounded-md hover:bg-success/20 transition-colors"
            >
              <Brain className="h-3 w-3" />
              Preferences
            </button>
          )}
          {vaultContext?.agents && vaultContext.agents.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
              <Users className="h-3 w-3" />
              {vaultContext.agents.length} Agents
            </span>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vault..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9"
          />
          {vaultSearchLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex">
        {/* File browser / search results */}
        <div className="w-1/2 overflow-auto border-r border-border">
          {searchInput.trim() ? (
            // Search results
            <div>
              {vaultSearchResults.length === 0 && !vaultSearchLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No results found
                </div>
              ) : (
                renderSearchResults(vaultSearchResults)
              )}
            </div>
          ) : (
            // File tree
            <div className="p-2">
              {/* Quick access sections */}
              <div className="space-y-1 mb-4">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                  Recent Learnings
                </p>
                {vaultContext?.recentLearnings.slice(0, 5).map((learning) => (
                  <button
                    key={learning.id}
                    type="button"
                    onClick={() => handleFileClick({ name: learning.topic + '.md', path: learning.path, isDirectory: false, size: null, modifiedAt: learning.modifiedAt })}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-md transition-colors',
                      selectedFile === learning.path
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted text-foreground'
                    )}
                  >
                    <Brain className="h-4 w-4 shrink-0 text-success" />
                    <span className="truncate">{learning.topic}</span>
                  </button>
                ))}
              </div>

              {/* Full file tree */}
              {vaultFiles.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                    All Files
                  </p>
                  {renderFileTree(vaultFiles)}
                </>
              )}
            </div>
          )}
        </div>

        {/* File content preview */}
        <div className="w-1/2 overflow-auto">
          {selectedFile ? (
            <div className="h-full flex flex-col">
              {/* File header */}
              <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30">
                <p className="text-xs font-medium truncate flex-1">{selectedFile}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => copyPathToClipboard(selectedFile)}
                >
                  {copiedPath === selectedFile ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>

              {/* File content */}
              {isLoadingContent ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <pre className="flex-1 p-3 text-xs font-mono whitespace-pre-wrap overflow-auto">
                  {fileContent}
                </pre>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Select a file to preview
            </div>
          )}
        </div>
      </div>

      {/* Footer with refresh */}
      <div className="p-2 border-t border-border flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
