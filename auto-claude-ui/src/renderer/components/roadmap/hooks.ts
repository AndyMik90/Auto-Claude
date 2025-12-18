import { useEffect, useState } from 'react';
import { useRoadmapStore, loadRoadmap, generateRoadmap, refreshRoadmap, stopRoadmap } from '../../stores/roadmap-store';
import type { RoadmapFeature } from '../../../shared/types';

/**
 * Hook to manage roadmap data and loading
 */
export function useRoadmapData(projectId: string) {
  const roadmap = useRoadmapStore((state) => state.roadmap);
  const competitorAnalysis = useRoadmapStore((state) => state.competitorAnalysis);
  const generationStatus = useRoadmapStore((state) => state.generationStatus);

  useEffect(() => {
    loadRoadmap(projectId);
  }, [projectId]);

  return {
    roadmap,
    competitorAnalysis,
    generationStatus,
  };
}

/**
 * Hook to manage feature actions (convert, link, etc.)
 */
export function useFeatureActions() {
  const updateFeatureLinkedSpec = useRoadmapStore((state) => state.updateFeatureLinkedSpec);

  const convertFeatureToSpec = async (
    projectId: string,
    feature: RoadmapFeature,
    selectedFeature: RoadmapFeature | null,
    setSelectedFeature: (feature: RoadmapFeature | null) => void
  ) => {
    const result = await window.electronAPI.convertFeatureToSpec(projectId, feature.id);
    if (result.success && result.data) {
      updateFeatureLinkedSpec(feature.id, result.data.specId);
      if (selectedFeature?.id === feature.id) {
        setSelectedFeature({
          ...feature,
          linkedSpecId: result.data.specId,
          status: 'planned',
        });
      }
    }
  };

  return {
    convertFeatureToSpec,
  };
}

/**
 * Hook to manage roadmap generation actions
 */
export function useRoadmapGeneration(projectId: string) {
  const [pendingAction, setPendingAction] = useState<'generate' | 'refresh' | null>(null);
  const [showCompetitorDialog, setShowCompetitorDialog] = useState(false);

  const handleGenerate = () => {
    setPendingAction('generate');
    setShowCompetitorDialog(true);
  };

  const handleRefresh = () => {
    setPendingAction('refresh');
    setShowCompetitorDialog(true);
  };

  const handleCompetitorDialogAccept = () => {
    if (pendingAction === 'generate') {
      generateRoadmap(projectId, true); // Enable competitor analysis
    } else if (pendingAction === 'refresh') {
      refreshRoadmap(projectId, true); // Enable competitor analysis
    }
    setPendingAction(null);
  };

  const handleCompetitorDialogDecline = () => {
    if (pendingAction === 'generate') {
      generateRoadmap(projectId, false); // Disable competitor analysis
    } else if (pendingAction === 'refresh') {
      refreshRoadmap(projectId, false); // Disable competitor analysis
    }
    setPendingAction(null);
  };

  const handleStop = async () => {
    await stopRoadmap(projectId);
  };

  return {
    pendingAction,
    showCompetitorDialog,
    setShowCompetitorDialog,
    handleGenerate,
    handleRefresh,
    handleCompetitorDialogAccept,
    handleCompetitorDialogDecline,
    handleStop,
  };
}
