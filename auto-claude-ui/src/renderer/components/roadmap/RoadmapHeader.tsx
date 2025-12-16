import { Target, Users, BarChart3, RefreshCw, Plus } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { getFeatureStats } from '../../stores/roadmap-store';
import { ROADMAP_PRIORITY_COLORS } from '../../../shared/constants';
import type { RoadmapHeaderProps } from './types';

export function RoadmapHeader({ roadmap, onAddFeature, onRefresh }: RoadmapHeaderProps) {
  const stats = getFeatureStats(roadmap);

  return (
    <div className="shrink-0 border-b border-border p-4 bg-card/50">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{roadmap.projectName}</h2>
            <Badge variant="outline">{roadmap.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">{roadmap.vision}</p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onAddFeature}>
                <Plus className="h-4 w-4 mr-1" />
                Add Feature
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add a new feature to the roadmap</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Regenerate Roadmap</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Target Audience */}
      <div className="mt-4 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Target:</span>
          <span className="font-medium">{roadmap.targetAudience.primary}</span>
        </div>
        {roadmap.targetAudience.secondary.length > 0 && (
          <div className="text-muted-foreground">
            +{roadmap.targetAudience.secondary.length} more personas
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            <span className="font-semibold">{stats.total}</span>
            <span className="text-muted-foreground"> features</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">
            <span className="font-semibold">{roadmap.phases.length}</span>
            <span className="text-muted-foreground"> phases</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {Object.entries(stats.byPriority).map(([priority, count]) => (
            <Badge
              key={priority}
              variant="outline"
              className={`text-xs ${ROADMAP_PRIORITY_COLORS[priority]}`}
            >
              {count} {priority}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
