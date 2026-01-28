import { useTranslation } from 'react-i18next';
import { Target, Users, BarChart3, RefreshCw, Plus, TrendingUp } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { getFeatureStats } from '../../stores/roadmap-store';
import { ROADMAP_PRIORITY_COLORS } from '../../../shared/constants';
import type { RoadmapHeaderProps } from './types';

export function RoadmapHeader({ roadmap, competitorAnalysis, onAddFeature, onRefresh, onViewCompetitorAnalysis }: RoadmapHeaderProps) {
  const { t } = useTranslation('roadmap');
  const stats = getFeatureStats(roadmap);

  return (
    <div className="shrink-0 border-b border-border p-4 bg-card/50">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{roadmap.projectName}</h2>
            <Badge variant="outline">{t(`status.${roadmap.status}`, { defaultValue: roadmap.status })}</Badge>
            {competitorAnalysis && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                    onClick={onViewCompetitorAnalysis}
                  >
                    <TrendingUp className="h-3 w-3" />
                    {t('header.competitorAnalysis')}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div className="space-y-2">
                    <div className="font-semibold">{t('header.clickToView')}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('header.analysisSummary', {
                        competitors: competitorAnalysis.competitors.length,
                        painPoints: competitorAnalysis.competitors.reduce((sum, c) => sum + c.painPoints.length, 0)
                      })}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">{roadmap.vision}</p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onAddFeature}>
                <Plus className="h-4 w-4 mr-1" />
                {t('actions.addFeature')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('actions.addFeatureTooltip')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onRefresh} aria-label={t('actions.regenerateTooltip')}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('actions.regenerateTooltip')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Target Audience */}
      {roadmap.targetAudience && (
        <div className="mt-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('header.target')}</span>
            <span className="font-medium">{roadmap.targetAudience.primary}</span>
          </div>
          {roadmap.targetAudience.secondary?.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-muted-foreground cursor-help underline decoration-dotted">
                  {t('header.morePersonas', { count: roadmap.targetAudience.secondary.length })}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-md">
                <div className="space-y-1">
                  <div className="font-semibold mb-2">{t('header.secondaryPersonas')}</div>
                  {roadmap.targetAudience.secondary.map((persona) => (
                    <div key={persona} className="text-sm">• {persona}</div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            <span className="font-semibold">{stats.total}</span>
            <span className="text-muted-foreground"> {t('header.stats.features')}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">
            <span className="font-semibold">{roadmap.phases.length}</span>
            <span className="text-muted-foreground"> {t('header.stats.phases')}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {Object.entries(stats.byPriority).map(([priority, count]) => (
            <Badge
              key={priority}
              variant="outline"
              className={`text-xs ${ROADMAP_PRIORITY_COLORS[priority]}`}
            >
              {count} {t(`priorities.${priority}`, { defaultValue: priority })}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
