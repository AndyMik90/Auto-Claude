import { Lightbulb, Eye, EyeOff, Settings2, Plus, Trash2, RefreshCw, Archive, CheckSquare, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { IDEATION_TYPE_COLORS } from '../../../shared/constants';
import type { IdeationType } from '../../../shared/types';
import { TypeIcon } from './TypeIcon';

interface IdeationHeaderProps {
  totalIdeas: number;
  ideaCountByType: Record<string, number>;
  showDismissed: boolean;
  showArchived: boolean;
  selectedCount: number;
  onToggleShowDismissed: () => void;
  onToggleShowArchived: () => void;
  onOpenConfig: () => void;
  onOpenAddMore: () => void;
  onDismissAll: () => void;
  onDeleteSelected: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onRefresh: () => void;
  hasActiveIdeas: boolean;
  canAddMore: boolean;
}

export function IdeationHeader({
  totalIdeas,
  ideaCountByType,
  showDismissed,
  showArchived,
  selectedCount,
  onToggleShowDismissed,
  onToggleShowArchived,
  onOpenConfig,
  onOpenAddMore,
  onDismissAll,
  onDeleteSelected,
  onSelectAll,
  onClearSelection,
  onRefresh,
  hasActiveIdeas,
  canAddMore
}: IdeationHeaderProps) {
  const { t } = useTranslation('ideation');
  const hasSelection = selectedCount > 0;
  return (
    <div className="shrink-0 border-b border-border p-4 bg-card/50">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t('header.title')}</h2>
            <Badge variant="outline">{totalIdeas} {t('header.ideasCount')}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('header.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Selection controls */}
          {hasSelection ? (
            <>
              <Badge variant="secondary" className="mr-1">
                {selectedCount} {t('header.selected')}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={onDeleteSelected}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t('header.delete')}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClearSelection}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('header.clearSelection')}</TooltipContent>
              </Tooltip>
              <div className="w-px h-6 bg-border mx-1" />
            </>
          ) : (
            hasActiveIdeas && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSelectAll}
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('header.selectAll')}</TooltipContent>
              </Tooltip>
            )
          )}

          {/* View toggles */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showDismissed ? 'secondary' : 'outline'}
                size="icon"
                onClick={onToggleShowDismissed}
              >
                {showDismissed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showDismissed ? t('header.hideDismissed') : t('header.showDismissed')}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showArchived ? 'secondary' : 'outline'}
                size="icon"
                onClick={onToggleShowArchived}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showArchived ? t('header.hideArchived') : t('header.showArchived')}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenConfig}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('header.configure')}</TooltipContent>
          </Tooltip>
          {canAddMore && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={onOpenAddMore}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('header.addMore')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('header.addMoreTooltip')}</TooltipContent>
            </Tooltip>
          )}
          {hasActiveIdeas && !hasSelection && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={onDismissAll}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('header.dismissAll')}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('header.regenerate')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center gap-4">
        {Object.entries(ideaCountByType).map(([type, count]) => (
          <Badge
            key={type}
            variant="outline"
            className={IDEATION_TYPE_COLORS[type]}
          >
            <TypeIcon type={type as IdeationType} />
            <span className="ml-1">{count}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
