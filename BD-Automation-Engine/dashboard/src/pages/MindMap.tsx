// Mind Map Page Component
// Integrates MindMapCanvas with NativeNodeTabs for switching between entity views

import { useEffect, useCallback, useState, useMemo } from 'react';
import { Search, Network } from 'lucide-react';
import { MindMapCanvas } from '../components/mindmap/MindMapCanvas';
import { NativeNodeTabs } from '../components/mindmap/NativeNodeTabs';
import { useMindMapStore } from '../stores/mindMapStore';
import { useData } from '../hooks/useData';
import type { NativeNodeType } from '../configs/nativeNodeConfigs';

interface MindMapProps {
  // Initial entity to focus on (passed from other pages via navigation)
  initialEntityType?: NativeNodeType;
  initialEntityId?: string;
  initialEntityLabel?: string;
}

// Entity picker component when no entity is selected
function EntityPicker({
  entityType,
  onSelect,
}: {
  entityType: NativeNodeType;
  onSelect: (id: string, label: string) => void;
}) {
  const { data, loading } = useData();
  const [search, setSearch] = useState('');

  const entities = useMemo(() => {
    if (!data) return [];

    switch (entityType) {
      case 'JOB':
        return data.jobs
          .filter((j) => j.title)
          .slice(0, 100)
          .map((j) => ({ id: j.id, label: j.title, subtitle: j.company }));
      case 'PROGRAM':
        return data.programs
          .filter((p) => p.name)
          .slice(0, 100)
          .map((p) => ({ id: p.id, label: p.name, subtitle: p.prime_contractor }));
      case 'CONTACT':
        const allContacts = Object.values(data.contacts).flat();
        return allContacts
          .filter((c) => c.name || c.first_name)
          .slice(0, 100)
          .map((c) => ({ id: c.id, label: c.name || c.first_name || 'Unknown', subtitle: c.title }));
      default:
        return [];
    }
  }, [data, entityType]);

  const filtered = useMemo(() => {
    if (!search) return entities.slice(0, 20);
    const lower = search.toLowerCase();
    return entities.filter((e) => e.label.toLowerCase().includes(lower)).slice(0, 20);
  }, [entities, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-6">
        <Network className="h-12 w-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-slate-800">Select a {entityType.toLowerCase().replace('_', ' ')} to explore</h2>
        <p className="text-sm text-slate-500 mt-1">Click on an entity below to visualize its connections</p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder={`Search ${entityType.toLowerCase()}s...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-slate-500">No entities found</div>
        ) : (
          filtered.map((entity) => (
            <button
              key={entity.id}
              onClick={() => onSelect(entity.id, entity.label)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-3"
            >
              <Network className="h-5 w-5 text-purple-500 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-slate-900 truncate">{entity.label}</div>
                {entity.subtitle && (
                  <div className="text-sm text-slate-500 truncate">{entity.subtitle}</div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {entities.length > 20 && (
        <p className="text-xs text-slate-400 text-center mt-3">
          Showing {filtered.length} of {entities.length} entities. Use search to find more.
        </p>
      )}
    </div>
  );
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

      {/* Mind Map Canvas or Entity Picker */}
      <div className="flex-1 overflow-hidden">
        {nativeNodeId ? (
          <MindMapCanvas className="h-full" />
        ) : (
          <EntityPicker
            entityType={nativeNodeType}
            onSelect={(id, _label) => setNativeNode(nativeNodeType, id)}
          />
        )}
      </div>
    </div>
  );
}

export default MindMap;
