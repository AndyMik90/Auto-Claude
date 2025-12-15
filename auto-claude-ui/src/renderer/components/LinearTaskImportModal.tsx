import { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  CheckSquare,
  Square,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Minus
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import type {
  LinearIssue,
  LinearTeam,
  LinearProject,
  LinearImportResult
} from '../../shared/types';

interface LinearTaskImportModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (result: LinearImportResult) => void;
}

// Priority colors based on Linear's priority scale (0-4, where 1 is urgent)
const PRIORITY_COLORS: Record<number, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-destructive/10 text-destructive',
  2: 'bg-warning/10 text-warning',
  3: 'bg-info/10 text-info',
  4: 'bg-muted text-muted-foreground'
};

// State type colors
const STATE_TYPE_COLORS: Record<string, string> = {
  backlog: 'bg-muted text-muted-foreground',
  unstarted: 'bg-info/10 text-info',
  started: 'bg-warning/10 text-warning',
  completed: 'bg-success/10 text-success',
  canceled: 'bg-destructive/10 text-destructive'
};

export function LinearTaskImportModal({
  projectId,
  open,
  onOpenChange,
  onImportComplete
}: LinearTaskImportModalProps) {
  // Data state
  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [projects, setProjects] = useState<LinearProject[]>([]);
  const [issues, setIssues] = useState<LinearIssue[]>([]);

  // Selection state
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());

  // UI state
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<LinearImportResult | null>(null);

  // Filter state
  const [filterState, setFilterState] = useState<string>('all');

  // Load teams when modal opens
  useEffect(() => {
    const loadTeams = async () => {
      if (!open) return;

      setIsLoadingTeams(true);
      setError(null);

      try {
        const result = await window.electronAPI.getLinearTeams(projectId);
        if (result.success && result.data) {
          setTeams(result.data);
          // Auto-select first team if only one
          if (result.data.length === 1) {
            setSelectedTeamId(result.data[0].id);
          }
        } else {
          setError(result.error || 'Failed to load teams');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingTeams(false);
      }
    };

    loadTeams();
  }, [open, projectId]);

  // Load projects when team is selected
  useEffect(() => {
    const loadProjects = async () => {
      if (!selectedTeamId) {
        setProjects([]);
        return;
      }

      setIsLoadingProjects(true);
      setError(null);

      try {
        const result = await window.electronAPI.getLinearProjects(projectId, selectedTeamId);
        if (result.success && result.data) {
          setProjects(result.data);
        } else {
          setError(result.error || 'Failed to load projects');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingProjects(false);
      }
    };

    loadProjects();
  }, [projectId, selectedTeamId]);

  // Load issues when team or project is selected
  useEffect(() => {
    const loadIssues = async () => {
      if (!selectedTeamId) {
        setIssues([]);
        return;
      }

      setIsLoadingIssues(true);
      setError(null);

      try {
        const result = await window.electronAPI.getLinearIssues(
          projectId,
          selectedTeamId,
          selectedProjectId || undefined
        );
        if (result.success && result.data) {
          setIssues(result.data);
          // Clear selection when issues change
          setSelectedIssueIds(new Set());
        } else {
          setError(result.error || 'Failed to load issues');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingIssues(false);
      }
    };

    loadIssues();
  }, [projectId, selectedTeamId, selectedProjectId]);

  // Filter and search issues
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = issue.title.toLowerCase().includes(query);
        const matchesIdentifier = issue.identifier.toLowerCase().includes(query);
        const matchesDescription = issue.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesIdentifier && !matchesDescription) {
          return false;
        }
      }

      // State filter
      if (filterState !== 'all' && issue.state.type !== filterState) {
        return false;
      }

      return true;
    });
  }, [issues, searchQuery, filterState]);

  // Selection handlers
  const toggleIssue = (issueId: string) => {
    setSelectedIssueIds(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIssueIds(new Set(filteredIssues.map(i => i.id)));
  };

  const deselectAll = () => {
    setSelectedIssueIds(new Set());
  };

  const isAllSelected = filteredIssues.length > 0 && filteredIssues.every(i => selectedIssueIds.has(i.id));
  const isSomeSelected = filteredIssues.some(i => selectedIssueIds.has(i.id)) && !isAllSelected;

  // Import handler
  const handleImport = async () => {
    if (selectedIssueIds.size === 0) return;

    setIsImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const result = await window.electronAPI.importLinearIssues(
        projectId,
        Array.from(selectedIssueIds)
      );

      if (result.success && result.data) {
        setImportResult(result.data);
        if (result.data.success) {
          onImportComplete?.(result.data);
          // Don't close immediately, show success
        }
      } else {
        setError(result.error || 'Failed to import issues');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsImporting(false);
    }
  };

  // Reset state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state
      setSelectedTeamId('');
      setSelectedProjectId('');
      setSelectedIssueIds(new Set());
      setSearchQuery('');
      setFilterState('all');
      setError(null);
      setImportResult(null);
    }
    onOpenChange(newOpen);
  };

  // Unique state types from issues for filter
  const uniqueStateTypes = useMemo(() => {
    const types = new Set(issues.map(i => i.state.type));
    return Array.from(types);
  }, [issues]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Download className="h-5 w-5" />
            Import Linear Tasks
          </DialogTitle>
          <DialogDescription>
            Select tasks from Linear to import into AutoBuild
          </DialogDescription>
        </DialogHeader>

        {/* Import Success Banner */}
        {importResult?.success && (
          <div className="rounded-lg bg-success/10 border border-success/30 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-success">
                Successfully imported {importResult.imported} task{importResult.imported !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-success/80 mt-1">
                Tasks are being processed. Check your Kanban board for progress.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!importResult?.success && (
          <>
            {/* Team and Project Selection */}
            <div className="flex gap-4 shrink-0">
              <div className="flex-1 space-y-2">
                <Label className="text-sm font-medium text-foreground">Team</Label>
                <Select
                  value={selectedTeamId}
                  onValueChange={setSelectedTeamId}
                  disabled={isLoadingTeams}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingTeams ? 'Loading...' : 'Select a team'} />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name} ({team.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-2">
                <Label className="text-sm font-medium text-foreground">Project (Optional)</Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                  disabled={isLoadingProjects || !selectedTeamId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingProjects ? 'Loading...' : 'All projects'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All projects</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex gap-3 items-center shrink-0">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={filterState} onValueChange={setFilterState}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {uniqueStateTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selection Controls */}
            {issues.length > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={isAllSelected ? deselectAll : selectAll}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : isSomeSelected ? (
                      <Minus className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {isAllSelected ? 'Deselect all' : 'Select all'}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {selectedIssueIds.size} of {filteredIssues.length} selected
                  </span>
                </div>

                <button
                  onClick={() => {
                    // Refresh issues
                    setSelectedTeamId(prev => {
                      // Force re-fetch by temporarily clearing and resetting
                      setTimeout(() => setSelectedTeamId(prev), 0);
                      return '';
                    });
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  disabled={isLoadingIssues}
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingIssues ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            )}

            {/* Issue List */}
            <ScrollArea className="flex-1 -mx-6 px-6 min-h-0">
              {isLoadingIssues ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !selectedTeamId ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">Select a team to view issues</p>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">
                    {searchQuery || filterState !== 'all'
                      ? 'No issues match your filters'
                      : 'No issues found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  {filteredIssues.map(issue => (
                    <div
                      key={issue.id}
                      className={`
                        rounded-lg border border-border p-3 cursor-pointer transition-colors
                        ${selectedIssueIds.has(issue.id) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'}
                      `}
                      onClick={() => toggleIssue(issue.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div className="mt-0.5">
                          {selectedIssueIds.has(issue.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Issue Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">
                              {issue.identifier}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${STATE_TYPE_COLORS[issue.state.type] || ''}`}
                            >
                              {issue.state.name}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${PRIORITY_COLORS[issue.priority] || ''}`}
                            >
                              {issue.priorityLabel}
                            </Badge>
                            {issue.labels.slice(0, 2).map(label => (
                              <Badge
                                key={label.id}
                                variant="outline"
                                className="text-xs"
                                style={{
                                  borderColor: label.color,
                                  color: label.color
                                }}
                              >
                                {label.name}
                              </Badge>
                            ))}
                            {issue.labels.length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{issue.labels.length - 2} more
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-medium text-foreground mt-1 line-clamp-2">
                            {issue.title}
                          </h4>

                          {/* Expandable description */}
                          {issue.description && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedIssueId(
                                  expandedIssueId === issue.id ? null : issue.id
                                );
                              }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2"
                            >
                              {expandedIssueId === issue.id ? (
                                <>
                                  <ChevronUp className="h-3 w-3" />
                                  Hide description
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  Show description
                                </>
                              )}
                            </button>
                          )}

                          {expandedIssueId === issue.id && issue.description && (
                            <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2 max-h-32 overflow-auto">
                              {issue.description}
                            </div>
                          )}

                          {/* Meta info */}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {issue.assignee && (
                              <span>Assigned to {issue.assignee.name}</span>
                            )}
                            {issue.project && (
                              <span>Project: {issue.project.name}</span>
                            )}
                            <a
                              href={issue.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View in Linear
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {importResult?.success ? 'Done' : 'Cancel'}
          </Button>
          {!importResult?.success && (
            <Button
              onClick={handleImport}
              disabled={selectedIssueIds.size === 0 || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Import {selectedIssueIds.size} Task{selectedIssueIds.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
