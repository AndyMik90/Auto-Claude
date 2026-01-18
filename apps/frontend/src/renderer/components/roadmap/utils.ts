import type { RoadmapFeature, CompetitorAnalysis, CompetitorPainPoint } from '../../../shared/types';

/**
 * Get competitor insights for a specific feature
 */
export function getCompetitorInsightsForFeature(
  feature: RoadmapFeature,
  competitorAnalysis: CompetitorAnalysis | null
): CompetitorPainPoint[] {
  if (!competitorAnalysis || !feature.competitorInsightIds || feature.competitorInsightIds.length === 0) {
    return [];
  }

  const insights: CompetitorPainPoint[] = [];
  for (const competitor of competitorAnalysis.competitors) {
    for (const painPoint of competitor.painPoints) {
      if (feature.competitorInsightIds.includes(painPoint.id)) {
        insights.push(painPoint);
      }
    }
  }
  return insights;
}

/**
 * Check if a feature has competitor insights
 */
export function hasCompetitorInsight(feature: RoadmapFeature): boolean {
  return !!feature.competitorInsightIds && feature.competitorInsightIds.length > 0;
}

/**
 * Calculate reverse dependencies (features that depend on the given feature).
 *
 * This function handles both cases:
 * 1. When reverseDependencies is already populated in the data
 * 2. When it needs to be calculated on-the-fly (for backward compatibility)
 *
 * @param feature - The feature to get reverse dependencies for
 * @param allFeatures - All features in the roadmap (required for on-the-fly calculation)
 * @returns Array of feature IDs that depend on the given feature
 */
export function getReverseDependencies(
  feature: RoadmapFeature,
  allFeatures: RoadmapFeature[]
): string[] {
  // Use pre-calculated reverseDependencies if available and non-empty
  if (feature.reverseDependencies && feature.reverseDependencies.length > 0) {
    return feature.reverseDependencies;
  }

  // Fallback: calculate on-the-fly by filtering all features
  // This handles cases where roadmap was generated before reverse dependencies were tracked
  return allFeatures
    .filter((f) => Array.isArray(f.dependencies) && f.dependencies.includes(feature.id))
    .map((f) => f.id);
}
