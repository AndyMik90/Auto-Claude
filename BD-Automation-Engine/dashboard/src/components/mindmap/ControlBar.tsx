import { useState, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  Palette,
  Layout,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  ChevronDown,
  X,
  Sparkles,
} from 'lucide-react';
import type { NodeType } from './ContextMenu';

export type LayoutMode = 'radial' | 'hierarchical' | 'force';
export type ColorByOption = 'bd_priority' | 'tier' | 'branch' | 'type' | 'none';

export interface ControlBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: { nodeId: string; label: string; type: NodeType }[];
  onSearchResultClick: (nodeId: string) => void;
  filterByType: NodeType[] | null;
  onFilterChange: (types: NodeType[] | null) => void;
  colorBy: ColorByOption;
  onColorByChange: (option: ColorByOption) => void;
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitToView: () => void;
  onExportOPML: () => void;
  onExportJSON: () => void;
  onExportXMind: () => void;
  onExportPNG: () => void;
  onOpenAIGenerator?: () => void;
}

const NODE_TYPES: { value: NodeType; label: string; icon: string }[] = [
  { value: 'JOB', label: 'Jobs', icon: '🎯' },
  { value: 'PROGRAM', label: 'Programs', icon: '📋' },
  { value: 'CONTACT', label: 'Contacts', icon: '👤' },
  { value: 'PRIME', label: 'Primes', icon: '🏢' },
  { value: 'LOCATION', label: 'Locations', icon: '📍' },
  { value: 'TASK_ORDER', label: 'Task Orders', icon: '📦' },
  { value: 'TEAM', label: 'Teams', icon: '👥' },
  { value: 'BD_EVENT', label: 'BD Events', icon: '📅' },
];

const COLOR_OPTIONS: { value: ColorByOption; label: string }[] = [
  { value: 'bd_priority', label: 'BD Priority' },
  { value: 'tier', label: 'Contact Tier' },
  { value: 'branch', label: 'Branch/Service' },
  { value: 'type', label: 'Node Type' },
  { value: 'none', label: 'Default' },
];

const LAYOUT_OPTIONS: { value: LayoutMode; label: string; description: string }[] = [
  { value: 'radial', label: 'Radial', description: 'Circular layout around center' },
  { value: 'hierarchical', label: 'Hierarchical', description: 'Top-down tree layout' },
  { value: 'force', label: 'Force-Directed', description: 'Physics-based clustering' },
];

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  align?: 'left' | 'right';
}

function Dropdown({ trigger, children, isOpen, onToggle, align = 'left' }: DropdownProps) {
  return (
    <div className="relative">
      <div onClick={onToggle}>{trigger}</div>
      {isOpen && (
        <div
          className={`absolute z-50 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-xl py-1 min-w-[180px]
            ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function ControlBar({
  searchQuery,
  onSearchChange,
  searchResults,
  onSearchResultClick,
  filterByType,
  onFilterChange,
  colorBy,
  onColorByChange,
  layoutMode,
  onLayoutModeChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitToView,
  onExportOPML,
  onExportJSON,
  onExportXMind,
  onExportPNG,
  onOpenAIGenerator,
}: ControlBarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const handleFilterToggle = useCallback((type: NodeType) => {
    if (!filterByType) {
      onFilterChange([type]);
    } else if (filterByType.includes(type)) {
      const newTypes = filterByType.filter(t => t !== type);
      onFilterChange(newTypes.length > 0 ? newTypes : null);
    } else {
      onFilterChange([...filterByType, type]);
    }
  }, [filterByType, onFilterChange]);

  const clearFilters = useCallback(() => {
    onFilterChange(null);
  }, [onFilterChange]);

  const filterLabel = useMemo(() => {
    if (!filterByType || filterByType.length === 0) {
      return 'All Types';
    }
    if (filterByType.length === 1) {
      return NODE_TYPES.find(t => t.value === filterByType[0])?.label ?? 'Filter';
    }
    return `${filterByType.length} Types`;
  }, [filterByType]);

  const showSearchResults = searchFocused && searchQuery.length > 0 && searchResults.length > 0;

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-900 border-b border-gray-700">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="Search nodes... (Cmd+F)"
            className="w-full pl-9 pr-8 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && (
          <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-xl max-h-64 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={result.nodeId}
                onClick={() => {
                  onSearchResultClick(result.nodeId);
                  onSearchChange('');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700"
              >
                <span>{getNodeIcon(result.type)}</span>
                <span className="flex-1 truncate">{result.label}</span>
                <span className="text-xs text-gray-500">{result.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-5 border-l border-gray-700" />

      {/* Filter by Type */}
      <Dropdown
        isOpen={filterOpen}
        onToggle={() => setFilterOpen(!filterOpen)}
        trigger={
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">
            <Filter className="w-4 h-4" />
            <span>{filterLabel}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        }
      >
        <div className="px-3 py-2 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase">Filter by Type</span>
            {filterByType && filterByType.length > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {NODE_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => handleFilterToggle(type.value)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
          >
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center text-xs
                ${filterByType?.includes(type.value)
                  ? 'bg-blue-600 border-blue-500'
                  : 'border-gray-600'
                }`}
            >
              {filterByType?.includes(type.value) && '✓'}
            </div>
            <span>{type.icon}</span>
            <span>{type.label}</span>
          </button>
        ))}
      </Dropdown>

      {/* Color By */}
      <Dropdown
        isOpen={colorOpen}
        onToggle={() => setColorOpen(!colorOpen)}
        trigger={
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">
            <Palette className="w-4 h-4" />
            <span>Color</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        }
      >
        <div className="px-3 py-2 border-b border-gray-700">
          <span className="text-xs font-medium text-gray-400 uppercase">Color By</span>
        </div>
        {COLOR_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onColorByChange(option.value);
              setColorOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-700 transition-colors
              ${colorBy === option.value ? 'text-blue-400' : 'text-gray-200'}`}
          >
            <div
              className={`w-2 h-2 rounded-full
                ${colorBy === option.value ? 'bg-blue-400' : 'bg-transparent'}`}
            />
            <span>{option.label}</span>
          </button>
        ))}
      </Dropdown>

      {/* Layout Mode */}
      <Dropdown
        isOpen={layoutOpen}
        onToggle={() => setLayoutOpen(!layoutOpen)}
        trigger={
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">
            <Layout className="w-4 h-4" />
            <span>Layout</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        }
      >
        <div className="px-3 py-2 border-b border-gray-700">
          <span className="text-xs font-medium text-gray-400 uppercase">Layout Mode</span>
        </div>
        {LAYOUT_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onLayoutModeChange(option.value);
              setLayoutOpen(false);
            }}
            className={`w-full flex flex-col px-3 py-2 text-left hover:bg-gray-700 transition-colors
              ${layoutMode === option.value ? 'text-blue-400' : 'text-gray-200'}`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full
                  ${layoutMode === option.value ? 'bg-blue-400' : 'bg-transparent'}`}
              />
              <span className="text-sm font-medium">{option.label}</span>
            </div>
            <span className="text-xs text-gray-500 ml-4">{option.description}</span>
          </button>
        ))}
      </Dropdown>

      <div className="h-5 border-l border-gray-700" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomReset}
          className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors min-w-[48px]"
          title="Reset Zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onZoomIn}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onFitToView}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Fit to View (Cmd+0)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div className="h-5 border-l border-gray-700" />

      {/* Export */}
      <Dropdown
        isOpen={exportOpen}
        onToggle={() => setExportOpen(!exportOpen)}
        align="right"
        trigger={
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        }
      >
        <div className="px-3 py-2 border-b border-gray-700">
          <span className="text-xs font-medium text-gray-400 uppercase">Export Format</span>
        </div>
        <button
          onClick={() => {
            onExportXMind();
            setExportOpen(false);
          }}
          className="w-full flex flex-col px-3 py-2 text-left text-gray-200 hover:bg-gray-700"
        >
          <span className="text-sm font-medium">XMind (.xmind)</span>
          <span className="text-xs text-gray-500">Native XMind format with full styling</span>
        </button>
        <button
          onClick={() => {
            onExportOPML();
            setExportOpen(false);
          }}
          className="w-full flex flex-col px-3 py-2 text-left text-gray-200 hover:bg-gray-700"
        >
          <span className="text-sm font-medium">OPML</span>
          <span className="text-xs text-gray-500">Import into XMind, OmniOutliner</span>
        </button>
        <button
          onClick={() => {
            onExportJSON();
            setExportOpen(false);
          }}
          className="w-full flex flex-col px-3 py-2 text-left text-gray-200 hover:bg-gray-700"
        >
          <span className="text-sm font-medium">JSON</span>
          <span className="text-xs text-gray-500">Full data export with metadata</span>
        </button>
        <button
          onClick={() => {
            onExportPNG();
            setExportOpen(false);
          }}
          className="w-full flex flex-col px-3 py-2 text-left text-gray-200 hover:bg-gray-700"
        >
          <span className="text-sm font-medium">PNG Image</span>
          <span className="text-xs text-gray-500">High-resolution canvas snapshot</span>
        </button>
      </Dropdown>

      {/* Reset View */}
      <button
        onClick={onFitToView}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
        title="Reset View"
      >
        <RotateCcw className="w-4 h-4" />
      </button>

      {/* AI Generator */}
      {onOpenAIGenerator && (
        <>
          <div className="h-5 border-l border-gray-700" />
          <button
            onClick={onOpenAIGenerator}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-md transition-all"
            title="AI Mind Map Generator"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Generate</span>
          </button>
        </>
      )}
    </div>
  );
}

function getNodeIcon(type: NodeType): string {
  switch (type) {
    case 'JOB': return '🎯';
    case 'PROGRAM': return '📋';
    case 'CONTACT': return '👤';
    case 'PRIME': return '🏢';
    case 'LOCATION': return '📍';
    case 'TASK_ORDER': return '📦';
    case 'TEAM': return '👥';
    case 'BD_EVENT': return '📅';
    default: return '📄';
  }
}

export default ControlBar;
