// Mind Map Page Component
// Integrates MindMapCanvas with NativeNodeTabs for switching between entity views

import { useEffect, useCallback } from 'react';
import { MindMapCanvas } from '../components/mindmap/MindMapCanvas';
import { NativeNodeTabs } from '../components/mindmap/NativeNodeTabs';
import { useMindMapStore } from '../stores/mindMapStore';
import type { NativeNodeType } from '../configs/nativeNodeConfigs';

interface MindMapProps {
  // Initial entity to focus on (passed from other pages via navigation)
  initialEntityType?: NativeNodeType;
  initialEntityId?: string;
  initialEntityLabel?: string;
}

export function MindMap({
  initialEntityType,
  initialEntityId,
  initialEntityLabel,
}: MindMapProps) {
  const nativeNodeType = useMindMapStore((state) => state.nativeNodeType);
  const nativeNodeId = useMindMapStore((state) => state.nativeNodeId);
  const setNativeNode = useMindMapStore((state) => state.setNativeNode);
  const isLoading = useMindMapStore((state) => state.isLoading);

  // Set initial entity if provided from navigation
  useEffect(() => {
    if (initialEntityType && initialEntityId) {
      setNativeNode(initialEntityType, initialEntityId);
    }
  }, [initialEntityType, initialEntityId, setNativeNode]);

  // Handle native node type change from tabs
  const handleTypeChange = useCallback(
    (type: NativeNodeType) => {
      // When switching tabs, clear the current node selection
      // The canvas will show empty state until a node is selected
      setNativeNode(type, '');
    },
    [setNativeNode]
  );

  return (
    <div className="h-full flex flex-col bg-slate-100">
      {/* Header with Native Node Tabs */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mind Map</h1>
          <p className="text-sm text-slate-500">
            {nativeNodeId
              ? `Exploring ${nativeNodeType.toLowerCase().replace('_', ' ')} connections`
              : 'Select an entity to explore its relationships'}
          </p>
        </div>
        <NativeNodeTabs
          activeType={nativeNodeType}
          onTypeChange={handleTypeChange}
          disabled={isLoading}
        />
      </div>

      {/* Entity Info Banner (when navigated from another page) */}
      {initialEntityLabel && nativeNodeId && (
        <div className="px-6 py-2 bg-blue-50 border-b border-blue-200">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Focused on:</span> {initialEntityLabel}
          </p>
        </div>
      )}

      {/* Mind Map Canvas */}
      <div className="flex-1 overflow-hidden">
        <MindMapCanvas className="h-full" />
      </div>
    </div>
  );
}

export default MindMap;
