import { ExternalLink, Play, TrendingUp, Package, Link, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useRoadmapStore } from '../../stores/roadmap-store';
import {
  ROADMAP_PRIORITY_COLORS,
  ROADMAP_PRIORITY_LABELS,
  ROADMAP_COMPLEXITY_COLORS,
  ROADMAP_IMPACT_COLORS,
} from '../../../shared/constants';
import type { FeatureCardProps } from './types';

export function FeatureCard({
  feature,
  onClick,
  onConvertToSpec,
  onGoToTask,
  hasCompetitorInsight = false,
  onDependencyClick,
  features,
}: FeatureCardProps) {
  const openDependencyDetail = useRoadmapStore(s => s.openDependencyDetail);

  // Calculate reverse dependencies on-the-fly if not present in data
  const reverseDependencies = feature.reverseDependencies ||
    features
      .filter(f => Array.isArray(f.dependencies) && f.dependencies.includes(feature.id))
      .map(f => f.id);

  // Debug: log for troubleshooting
  console.log('[FeatureCard] Reverse Deps Debug:', {
    featureId: feature.id,
    featureTitle: feature.title,
    hasReverseDepsInData: !!feature.reverseDependencies,
    reverseDepsFromData: feature.reverseDependencies,
    calculatedReverseDeps: reverseDependencies,
    totalFeatures: features.length,
    featuresWithDeps: features.filter(f => Array.isArray(f.dependencies) && f.dependencies.length > 0).map(f => ({
      id: f.id,
      title: f.title,
      deps: f.dependencies,
      hasThisFeature: Array.isArray(f.dependencies) && f.dependencies.includes(feature.id)
    }))
  });

  return (
    <Card className="p-4 hover:bg-muted/50 cursor-pointer transition-colors" onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className={ROADMAP_PRIORITY_COLORS[feature.priority]}>
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
                  <Badge variant="outline" className="text-xs text-primary border-primary/50">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Competitor Insight
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>This feature addresses competitor pain points</TooltipContent>
              </Tooltip>
            )}
          </div>
          <h3 className="font-medium">{feature.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{feature.description}</p>

          {/* Dependencies Section */}
          {((feature.dependencies && feature.dependencies.length > 0) || reverseDependencies.length > 0) && (
            <div className="dependencies-section mt-3 pt-3 border-t border-border">
              {/* Dependencies */}
              {feature.dependencies && feature.dependencies.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                    <Package className="w-3 h-3" />
                    <span>Dependencies ({feature.dependencies.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {feature.dependencies.map(depId => {
                      const depFeature = features.find(f => f.id === depId);
                      const isMissing = !depFeature;

                      return (
                        <button
                          key={depId}
                          className={`
                            dependency-chip px-2 py-0.5 rounded-md text-xs font-medium
                            flex items-center gap-1 transition-all
                            ${isMissing
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-300 dark:border-red-700'
                              : 'bg-primary/10 text-primary hover:bg-primary/20 hover:underline cursor-pointer'
                            }
                          `}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (depFeature) {
                              if (onDependencyClick) {
                                onDependencyClick(depId);
                              } else {
                                openDependencyDetail(depId);
                              }
                            }
                          }}
                          disabled={isMissing}
                          title={isMissing ? `Dependency '${depId}' not found in roadmap` : depFeature?.title}
                        >
                          {isMissing && <AlertTriangle className="w-3 h-3" />}
                          <span>{depFeature?.title || depId}</span>
                          {!isMissing && <ChevronRight className="w-2.5 h-2.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reverse Dependencies */}
              {reverseDependencies.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                    <Link className="w-3 h-3" />
                    <span>Required By ({reverseDependencies.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {reverseDependencies.map(depId => {
                      const depFeature = features.find(f => f.id === depId);
                      return (
                        <button
                          key={depId}
                          className="dependency-chip px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 hover:underline cursor-pointer transition-all flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (depFeature) {
                              if (onDependencyClick) {
                                onDependencyClick(depId);
                              } else {
                                openDependencyDetail(depId);
                              }
                            }
                          }}
                          title={depFeature?.title}
                        >
                          <span>{depFeature?.title || depId}</span>
                          <ChevronRight className="w-2.5 h-2.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Validation Warnings */}
              {feature.dependencyValidation?.hasCircular && (
                <div className="mt-2 p-1.5 bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-md flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-400">
                  <RefreshCw className="w-3 h-3" />
                  <span>Circular dependency detected</span>
                </div>
              )}
            </div>
          )}
        </div>
        {feature.linkedSpecId ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onGoToTask(feature.linkedSpecId!);
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Go to Task
          </Button>
        ) : (
          feature.status !== 'done' && (
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
  );
}
