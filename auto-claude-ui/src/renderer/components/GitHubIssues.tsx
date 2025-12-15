import { useEffect, useState, useCallback } from 'react';
import {
  Github,
  RefreshCw,
  ExternalLink,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  Tag,
  User,
  Clock,
  Sparkles,
  Plus,
  Filter,
  Settings2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Progress } from './ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { useGitHubStore, loadGitHubIssues, checkGitHubConnection, investigateGitHubIssue } from '../stores/github-store';
import { useProjectStore } from '../stores/project-store';
import {
  GITHUB_ISSUE_STATE_COLORS,
  GITHUB_ISSUE_STATE_LABELS,
  GITHUB_COMPLEXITY_COLORS
} from '../../shared/constants';
import type { GitHubIssue, GitHubInvestigationResult } from '../../shared/types';

interface GitHubIssuesProps {
  onOpenSettings?: () => void;
}

export function GitHubIssues({ onOpenSettings }: GitHubIssuesProps) {
  const projects = useProjectStore((state) => state.projects);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const {
    issues,
    syncStatus,
    isLoading,
    error,
    selectedIssueNumber,
    filterState,
    investigationStatus,
    lastInvestigationResult,
    selectIssue,
    setFilterState,
    getFilteredIssues,
    getOpenIssuesCount,
    setInvestigationStatus,
    setInvestigationResult,
    setError
  } = useGitHubStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showInvestigateDialog, setShowInvestigateDialog] = useState(false);
  const [selectedIssueForInvestigation, setSelectedIssueForInvestigation] = useState<GitHubIssue | null>(null);

  // Load issues when project changes
  useEffect(() => {
    if (selectedProject?.id) {
      checkGitHubConnection(selectedProject.id);
      loadGitHubIssues(selectedProject.id, filterState);
    }
  }, [selectedProject?.id]);

  // Set up event listeners for investigation progress
  useEffect(() => {
    if (!selectedProject?.id) return;

    const cleanupProgress = window.electronAPI.onGitHubInvestigationProgress(
      (projectId, status) => {
        if (projectId === selectedProject.id) {
          setInvestigationStatus(status);
        }
      }
    );

    const cleanupComplete = window.electronAPI.onGitHubInvestigationComplete(
      (projectId, result) => {
        if (projectId === selectedProject.id) {
          setInvestigationResult(result);
          setShowInvestigateDialog(false);
        }
      }
    );

    const cleanupError = window.electronAPI.onGitHubInvestigationError(
      (projectId, error) => {
        if (projectId === selectedProject.id) {
          setError(error);
          setInvestigationStatus({
            phase: 'error',
            progress: 0,
            message: error
          });
        }
      }
    );

    return () => {
      cleanupProgress();
      cleanupComplete();
      cleanupError();
    };
  }, [selectedProject?.id, setInvestigationStatus, setInvestigationResult, setError]);

  const handleRefresh = useCallback(() => {
    if (selectedProject?.id) {
      loadGitHubIssues(selectedProject.id, filterState);
    }
  }, [selectedProject?.id, filterState]);

  const handleFilterChange = useCallback((state: 'open' | 'closed' | 'all') => {
    setFilterState(state);
    if (selectedProject?.id) {
      loadGitHubIssues(selectedProject.id, state);
    }
  }, [selectedProject?.id, setFilterState]);

  const handleInvestigate = useCallback((issue: GitHubIssue) => {
    setSelectedIssueForInvestigation(issue);
    setShowInvestigateDialog(true);
  }, []);

  const startInvestigation = useCallback(() => {
    if (selectedProject?.id && selectedIssueForInvestigation) {
      investigateGitHubIssue(selectedProject.id, selectedIssueForInvestigation.number);
    }
  }, [selectedProject?.id, selectedIssueForInvestigation]);

  const filteredIssues = getFilteredIssues().filter(issue =>
    searchQuery === '' ||
    issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    issue.body?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedIssue = issues.find(i => i.number === selectedIssueNumber);

  // Not connected state
  if (!syncStatus?.connected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Github className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          GitHub Not Connected
        </h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          {syncStatus?.error || 'Configure your GitHub token and repository in project settings to sync issues.'}
        </p>
        {onOpenSettings && (
          <Button onClick={onOpenSettings} variant="outline">
            <Settings2 className="h-4 w-4 mr-2" />
            Open Settings
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                GitHub Issues
              </h2>
              <p className="text-xs text-muted-foreground">
                {syncStatus.repoFullName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {getOpenIssuesCount()} open
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterState} onValueChange={(v: 'open' | 'closed' | 'all') => handleFilterChange(v)}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Issue List */}
        <div className="w-1/2 border-r border-border flex flex-col">
          {error && (
            <div className="p-4 bg-destructive/10 border-b border-destructive/30">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No issues match your search' : 'No issues found'}
              </p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {filteredIssues.map((issue) => (
                  <IssueListItem
                    key={issue.id}
                    issue={issue}
                    isSelected={selectedIssueNumber === issue.number}
                    onClick={() => selectIssue(issue.number)}
                    onInvestigate={() => handleInvestigate(issue)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Issue Detail */}
        <div className="w-1/2 flex flex-col">
          {selectedIssue ? (
            <IssueDetail
              issue={selectedIssue}
              onInvestigate={() => handleInvestigate(selectedIssue)}
              investigationResult={lastInvestigationResult?.issueNumber === selectedIssue.number ? lastInvestigationResult : null}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Github className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Select an issue to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Investigation Dialog */}
      <Dialog open={showInvestigateDialog} onOpenChange={setShowInvestigateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-info" />
              AI Investigation
            </DialogTitle>
            <DialogDescription>
              {selectedIssueForInvestigation && (
                <span>
                  Investigating issue #{selectedIssueForInvestigation.number}: {selectedIssueForInvestigation.title}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {investigationStatus.phase === 'idle' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The AI will analyze this issue, examine relevant code, and create a planned task in your Kanban board.
              </p>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="text-sm font-medium mb-2">What the AI will do:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>- Analyze the issue description and comments</li>
                  <li>- Identify affected files and components</li>
                  <li>- Estimate complexity and effort</li>
                  <li>- Create acceptance criteria</li>
                  <li>- Generate a task spec for implementation</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{investigationStatus.message}</span>
                  <span className="text-foreground">{investigationStatus.progress}%</span>
                </div>
                <Progress value={investigationStatus.progress} className="h-2" />
              </div>

              {investigationStatus.phase === 'error' && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  {investigationStatus.error}
                </div>
              )}

              {investigationStatus.phase === 'complete' && (
                <div className="rounded-lg bg-success/10 border border-success/30 p-3 flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Investigation complete! Task created in Kanban board.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {investigationStatus.phase === 'idle' && (
              <>
                <Button variant="outline" onClick={() => setShowInvestigateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={startInvestigation}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Investigation
                </Button>
              </>
            )}
            {investigationStatus.phase !== 'idle' && investigationStatus.phase !== 'complete' && (
              <Button variant="outline" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Investigating...
              </Button>
            )}
            {investigationStatus.phase === 'complete' && (
              <Button onClick={() => {
                setShowInvestigateDialog(false);
                setInvestigationStatus({ phase: 'idle', progress: 0, message: '' });
              }}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Issue List Item Component
interface IssueListItemProps {
  issue: GitHubIssue;
  isSelected: boolean;
  onClick: () => void;
  onInvestigate: () => void;
}

function IssueListItem({ issue, isSelected, onClick, onInvestigate }: IssueListItemProps) {
  return (
    <div
      className={`group p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-accent/50 border border-accent'
          : 'hover:bg-muted/50 border border-transparent'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={`text-xs ${GITHUB_ISSUE_STATE_COLORS[issue.state]}`}
            >
              {GITHUB_ISSUE_STATE_LABELS[issue.state]}
            </Badge>
            <span className="text-xs text-muted-foreground">#{issue.number}</span>
          </div>
          <h4 className="text-sm font-medium text-foreground truncate">
            {issue.title}
          </h4>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {issue.author.login}
            </div>
            {issue.commentsCount > 0 && (
              <div className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {issue.commentsCount}
              </div>
            )}
            {issue.labels.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {issue.labels.length}
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onInvestigate();
          }}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Issue Detail Component
interface IssueDetailProps {
  issue: GitHubIssue;
  onInvestigate: () => void;
  investigationResult: GitHubInvestigationResult | null;
}

function IssueDetail({ issue, onInvestigate, investigationResult }: IssueDetailProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${GITHUB_ISSUE_STATE_COLORS[issue.state]}`}
              >
                {GITHUB_ISSUE_STATE_LABELS[issue.state]}
              </Badge>
              <span className="text-sm text-muted-foreground">#{issue.number}</span>
            </div>
            <Button variant="ghost" size="icon" asChild>
              <a href={issue.htmlUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {issue.title}
          </h2>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {issue.author.login}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatDate(issue.createdAt)}
          </div>
          {issue.commentsCount > 0 && (
            <div className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              {issue.commentsCount} comments
            </div>
          )}
        </div>

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {issue.labels.map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                style={{
                  backgroundColor: `#${label.color}20`,
                  borderColor: `#${label.color}50`,
                  color: `#${label.color}`
                }}
              >
                {label.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button onClick={onInvestigate} className="flex-1">
            <Sparkles className="h-4 w-4 mr-2" />
            Investigate & Create Task
          </Button>
        </div>

        {/* Investigation Result */}
        {investigationResult?.success && (
          <Card className="bg-success/5 border-success/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                Investigation Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-foreground">{investigationResult.analysis.summary}</p>
              <div className="flex items-center gap-2">
                <Badge className={GITHUB_COMPLEXITY_COLORS[investigationResult.analysis.estimatedComplexity]}>
                  {investigationResult.analysis.estimatedComplexity}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Task ID: {investigationResult.taskId}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Body */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            {issue.body ? (
              <div className="prose prose-sm prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans">
                  {issue.body}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No description provided.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Assignees */}
        {issue.assignees.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Assignees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {issue.assignees.map((assignee) => (
                  <Badge key={assignee.login} variant="outline">
                    <User className="h-3 w-3 mr-1" />
                    {assignee.login}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Milestone */}
        {issue.milestone && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Milestone</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{issue.milestone.title}</Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
