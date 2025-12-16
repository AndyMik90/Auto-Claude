import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../lib/utils';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from './ui/tooltip';
import { Play, ExternalLink, TrendingUp } from 'lucide-react';
import {
  ROADMAP_PRIORITY_COLORS,
  ROADMAP_PRIORITY_LABELS,
  ROADMAP_COMPLEXITY_COLORS,
  ROADMAP_IMPACT_COLORS
} from '../../shared/constants';
import type { RoadmapFeature } from '../../shared/types';

interface SortableFeatureCardProps {
  feature: RoadmapFeature;
  onClick: () => void;
  onConvertToSpec?: (feature: RoadmapFeature) => void;
  onGoToTask?: (specId: string) => void;
}

export function SortableFeatureCard({
  feature,
  onClick,
  onConvertToSpec,
  onGoToTask
}: SortableFeatureCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({ id: feature.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Prevent z-index stacking issues during drag
    zIndex: isDragging ? 50 : undefined
  };

  const hasCompetitorInsight =
    !!feature.competitorInsightIds && feature.competitorInsightIds.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'touch-none transition-all duration-200',
        isDragging && 'dragging-placeholder opacity-40 scale-[0.98]',
        isOver && !isDragging && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background rounded-xl'
      )}
      {...attributes}
      {...listeners}
    >
      <Card
        className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={onClick}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge
                variant="outline"
                className={ROADMAP_PRIORITY_COLORS[feature.priority]}
              >
                {ROADMAP_PRIORITY_LABELS[feature.priority]}
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs ${ROADMAP_COMPLEXITY_COLORS[feature.complexity]}`}
              >
                {feature.complexity}
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs ${ROADMAP_IMPACT_COLORS[feature.impact]}`}
              >
                {feature.impact} impact
              </Badge>
              {hasCompetitorInsight && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-xs text-primary border-primary/50"
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Competitor Insight
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    This feature addresses competitor pain points
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <h3 className="font-medium truncate">{feature.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {feature.description}
            </p>
          </div>
          {feature.linkedSpecId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onGoToTask?.(feature.linkedSpecId!);
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Go to Task
            </Button>
          ) : (
            feature.status !== 'done' &&
            onConvertToSpec && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onConvertToSpec(feature);
                }}
              >
                <Play className="h-3 w-3 mr-1" />
                Build
              </Button>
            )
          )}
        </div>
      </Card>
    </div>
  );
}
