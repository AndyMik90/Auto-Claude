import { useState, useEffect, useMemo } from 'react';
import {
  ExternalLink,
  User,
  Clock,
  GitBranch,
  FileDiff,
  Sparkles,
  Send,
  XCircle,
  Loader2
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { ScrollArea } from '../../ui/scroll-area';
import { Progress } from '../../ui/progress';
import { ReviewFindings } from './ReviewFindings';
import type { PRData, PRReviewResult, PRReviewProgress, PRReviewFinding } from '../hooks/useGitHubPRs';

interface PRDetailProps {
  pr: PRData;
  reviewResult: PRReviewResult | null;
  reviewProgress: PRReviewProgress | null;
  isReviewing: boolean;
  onRunReview: () => void;
  onPostReview: (selectedFindingIds?: string[]) => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusColor(status: PRReviewResult['overallStatus']): string {
  switch (status) {
    case 'approve':
      return 'bg-success/20 text-success border-success/50';
    case 'request_changes':
      return 'bg-destructive/20 text-destructive border-destructive/50';
    default:
      return 'bg-muted';
  }
}

export function PRDetail({
  pr,
  reviewResult,
  reviewProgress,
  isReviewing,
  onRunReview,
  onPostReview,
}: PRDetailProps) {
  // Selection state for findings
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());

  // Auto-select critical and high findings when review completes
  useEffect(() => {
    if (reviewResult?.success && reviewResult.findings.length > 0) {
      const importantFindings = reviewResult.findings
        .filter(f => f.severity === 'critical' || f.severity === 'high')
        .map(f => f.id);
      setSelectedFindingIds(new Set(importantFindings));
    }
  }, [reviewResult]);

  // Count selected findings by type for the button label
  const selectedCount = selectedFindingIds.size;
  const hasImportantSelected = useMemo(() => {
    if (!reviewResult?.findings) return false;
    return reviewResult.findings
      .filter(f => f.severity === 'critical' || f.severity === 'high')
      .some(f => selectedFindingIds.has(f.id));
  }, [reviewResult?.findings, selectedFindingIds]);

  const handlePostReview = () => {
    onPostReview(Array.from(selectedFindingIds));
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-success/20 text-success border-success/50">
                Open
              </Badge>
              <span className="text-sm text-muted-foreground">#{pr.number}</span>
            </div>
            <Button variant="ghost" size="icon" asChild>
              <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <h2 className="text-lg font-semibold text-foreground">{pr.title}</h2>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {pr.author.login}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatDate(pr.createdAt)}
          </div>
          <div className="flex items-center gap-1">
            <GitBranch className="h-4 w-4" />
            {pr.headRefName} → {pr.baseRefName}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <FileDiff className="h-3 w-3" />
            {pr.changedFiles} files
          </Badge>
          <span className="text-sm text-success">+{pr.additions}</span>
          <span className="text-sm text-destructive">-{pr.deletions}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onRunReview}
            disabled={isReviewing}
            className="flex-1"
          >
            {isReviewing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reviewing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Run AI Review
              </>
            )}
          </Button>
          {reviewResult && reviewResult.success && selectedCount > 0 && (
            <Button onClick={handlePostReview} variant="secondary">
              <Send className="h-4 w-4 mr-2" />
              Post {selectedCount} Finding{selectedCount !== 1 ? 's' : ''}
            </Button>
          )}
        </div>

        {/* Review Progress */}
        {reviewProgress && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{reviewProgress.message}</span>
                  <span className="text-muted-foreground">{reviewProgress.progress}%</span>
                </div>
                <Progress value={reviewProgress.progress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review Result */}
        {reviewResult && reviewResult.success && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Review Result
                </span>
                <Badge variant="outline" className={getStatusColor(reviewResult.overallStatus)}>
                  {reviewResult.overallStatus === 'approve' && 'Approve'}
                  {reviewResult.overallStatus === 'request_changes' && 'Changes Requested'}
                  {reviewResult.overallStatus === 'comment' && 'Comment'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 overflow-hidden">
              <p className="text-sm text-muted-foreground break-words">{reviewResult.summary}</p>

              {/* Interactive Findings with Selection */}
              <ReviewFindings
                findings={reviewResult.findings}
                selectedIds={selectedFindingIds}
                onSelectionChange={setSelectedFindingIds}
              />

              {reviewResult.reviewedAt && (
                <p className="text-xs text-muted-foreground">
                  Reviewed: {formatDate(reviewResult.reviewedAt)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Review Error */}
        {reviewResult && !reviewResult.success && reviewResult.error && (
          <Card className="border-destructive">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="text-sm">{reviewResult.error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Description */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden">
            {pr.body ? (
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans break-words max-w-full overflow-hidden">
                {pr.body}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No description provided.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Changed Files */}
        {pr.files && pr.files.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Changed Files ({pr.files.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {pr.files.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center justify-between text-xs py-1"
                  >
                    <code className="text-muted-foreground truncate flex-1">
                      {file.path}
                    </code>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-success">+{file.additions}</span>
                      <span className="text-destructive">-{file.deletions}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
