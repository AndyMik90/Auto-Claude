import { useRef, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { ScrollArea } from '../../ui/scroll-area';
import { IssueListItem } from './IssueListItem';
import { EmptyState } from './EmptyStates';
import type { IssueListProps } from '../types';
import { useTranslation } from 'react-i18next';

export function IssueList({
  issues,
  selectedIssueNumber,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onSelectIssue,
  onInvestigate,
  onLoadMore
}: IssueListProps) {
  const { t } = useTranslation('common');
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for infinite scroll
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoading && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, isLoading, onLoadMore]);

  useEffect(() => {
    const trigger = loadMoreTriggerRef.current;
    if (!trigger || !onLoadMore) return;

    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '100px',
      threshold: 0
    });

    observer.observe(trigger);

    return () => {
      observer.disconnect();
    };
  }, [handleIntersection, onLoadMore]);

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border-b border-destructive/30">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      </div>
    );
  }

  if (isLoading && issues.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (issues.length === 0) {
    return <EmptyState message="No issues found" />;
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {issues.map((issue) => (
          <IssueListItem
            key={issue.id}
            issue={issue}
            isSelected={selectedIssueNumber === issue.number}
            onClick={() => onSelectIssue(issue.number)}
            onInvestigate={() => onInvestigate(issue)}
          />
        ))}

        {/* Load more trigger / Loading indicator */}
        {onLoadMore && (
          <div ref={loadMoreTriggerRef} className="py-4 flex justify-center">
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{t('issues.loadingMore', 'Loading more...')}</span>
              </div>
            ) : hasMore ? (
              <span className="text-xs text-muted-foreground opacity-50">
                {t('issues.scrollForMore', 'Scroll for more')}
              </span>
            ) : issues.length > 0 ? (
              <span className="text-xs text-muted-foreground opacity-50">
                {t('issues.allLoaded', 'All issues loaded')}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
