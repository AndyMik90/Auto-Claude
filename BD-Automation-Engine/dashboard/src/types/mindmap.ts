// Mind Map Type Definitions

import type { NativeNodeType, RelationshipType } from '../configs/nativeNodeConfigs';

// ============================================================================
// Core Node Types
// ============================================================================

export interface MindMapNode {
  id: string;
  type: NativeNodeType;
  label: string;
  data: Record<string, unknown>;
  tier: number;
  parentId: string | null;
  relationship: RelationshipType | null;
  isNative: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  childCount: number;
  loadedChildCount: number;
  x?: number;
  y?: number;
  fx?: number | null; // Fixed x position for D3
  fy?: number | null; // Fixed y position for D3
  vx?: number; // Velocity x for D3
  vy?: number; // Velocity y for D3
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  relationship: RelationshipType;
  label?: string;
}

export interface MindMapGraph {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

// ============================================================================
// Expansion State
// ============================================================================

export interface ExpansionState {
  expandedNodes: Set<string>;
  loadingNodes: Set<string>;
  visibleTiers: Map<string, number>; // nodeId -> visible tier level
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface LayoutState {
  positions: Map<string, NodePosition>;
  zoom: number;
  panX: number;
  panY: number;
}

// ============================================================================
// Selection & Interaction
// ============================================================================

export interface SelectionState {
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
}

export interface InteractionState extends SelectionState {
  isDragging: boolean;
  dragNodeId: string | null;
}

// ============================================================================
// Mind Map State
// ============================================================================

export interface MindMapState {
  nativeNodeType: NativeNodeType;
  nativeNodeId: string | null;
  graph: MindMapGraph;
  expansion: ExpansionState;
  layout: LayoutState;
  interaction: InteractionState;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Actions
// ============================================================================

export type MindMapAction =
  | { type: 'SET_NATIVE_NODE'; payload: { nodeType: NativeNodeType; nodeId: string } }
  | { type: 'SET_GRAPH'; payload: MindMapGraph }
  | { type: 'ADD_NODES'; payload: { nodes: MindMapNode[]; edges: MindMapEdge[] } }
  | { type: 'EXPAND_NODE'; payload: string }
  | { type: 'COLLAPSE_NODE'; payload: string }
  | { type: 'SET_NODE_LOADING'; payload: { nodeId: string; isLoading: boolean } }
  | { type: 'SET_NODE_POSITION'; payload: { nodeId: string; position: NodePosition } }
  | { type: 'UPDATE_POSITIONS'; payload: Map<string, NodePosition> }
  | { type: 'SELECT_NODE'; payload: string | null }
  | { type: 'HOVER_NODE'; payload: string | null }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_PAN'; payload: { x: number; y: number } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'START_DRAG'; payload: string }
  | { type: 'END_DRAG' }
  | { type: 'RESET' };

// ============================================================================
// Component Props
// ============================================================================

export interface MindMapCanvasProps {
  width: number;
  height: number;
  graph: MindMapGraph;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  zoom: number;
  panX: number;
  panY: number;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  onNodeExpand: (nodeId: string) => void;
  onNodeCollapse: (nodeId: string) => void;
  onNodeDrag: (nodeId: string, x: number, y: number) => void;
  onZoom: (zoom: number) => void;
  onPan: (x: number, y: number) => void;
}

export interface MindMapNodeProps {
  node: MindMapNode;
  isSelected: boolean;
  isHovered: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onClick: () => void;
  onHover: (isHovered: boolean) => void;
  onDrag: (x: number, y: number) => void;
}

// ============================================================================
// Layout Configuration
// ============================================================================

export interface ForceLayoutConfig {
  centerForce: number;
  chargeStrength: number;
  linkDistance: number;
  collisionRadius: number;
  alphaDecay: number;
  velocityDecay: number;
}

export const DEFAULT_FORCE_CONFIG: ForceLayoutConfig = {
  centerForce: 0.1,
  chargeStrength: -300,
  linkDistance: 120,
  collisionRadius: 60,
  alphaDecay: 0.0228,
  velocityDecay: 0.4,
};

// ============================================================================
// Progressive Loading Config
// ============================================================================

export const PROGRESSIVE_LOADING_CONFIG = {
  maxNodesPerTier: 20,
  maxTotalNodes: 100,
  loadDelay: 150, // ms delay between tier loads
  animationDuration: 300,
} as const;
