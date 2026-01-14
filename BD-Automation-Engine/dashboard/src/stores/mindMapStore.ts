// Mind Map Zustand Store with Tier-Based Expansion
import { create } from 'zustand';
import type { NativeNodeType, RelationshipType } from '../configs/nativeNodeConfigs';

// ============================================================================
// Types
// ============================================================================

export type NodeType = NativeNodeType;

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low' | 'standard';

export interface MindMapNode {
  id: string;
  type: NodeType;
  label: string;
  subtitle?: string;
  icon?: string;
  priority?: PriorityLevel;
  bdScore?: number;
  tier: number;
  clearance?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  // Expansion state
  parentId: string | null;
  relationship?: RelationshipType | string;
  isNative: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  childCount: number;
  loadedChildCount: number;
  // Position (for D3)
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  weight?: number;
  isStrong?: boolean;
}

export interface ExpansionState {
  expandedNodes: Set<string>;
  loadingNodes: Set<string>;
}

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

// ============================================================================
// Store Interface
// ============================================================================

interface MindMapState {
  // Core data
  nodes: Map<string, MindMapNode>;
  edges: MindMapEdge[];

  // Native node context
  nativeNodeType: NativeNodeType;
  nativeNodeId: string | null;

  // UI State
  selectedNodeId: string | null;
  hoveredNodeId: string | null;

  // Expansion
  expansion: ExpansionState;

  // Viewport
  viewport: ViewportState;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  setGraphData: (nodes: MindMapNode[], edges: MindMapEdge[]) => void;
  addNodes: (nodes: MindMapNode[], edges: MindMapEdge[]) => void;
  removeChildNodes: (parentId: string) => void;

  setNativeNode: (type: NativeNodeType, id: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;

  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  setNodeLoading: (nodeId: string, isLoading: boolean) => void;
  setNodeExpanded: (nodeId: string, isExpanded: boolean) => void;

  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  updateAllPositions: (positions: Map<string, { x: number; y: number }>) => void;
  fixNodePosition: (nodeId: string, fx: number | null, fy: number | null) => void;

  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;

  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  reset: () => void;

  // Getters
  getNode: (nodeId: string) => MindMapNode | undefined;
  getConnectedNodes: (nodeId: string) => MindMapNode[];
  getChildNodes: (parentId: string) => MindMapNode[];
  getGraphData: () => { nodes: MindMapNode[]; links: MindMapEdge[] };
  canExpand: (nodeId: string) => boolean;
  isExpanded: (nodeId: string) => boolean;
  isNodeLoading: (nodeId: string) => boolean;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  nodes: new Map<string, MindMapNode>(),
  edges: [] as MindMapEdge[],
  nativeNodeType: 'JOB' as NativeNodeType,
  nativeNodeId: null,
  selectedNodeId: null,
  hoveredNodeId: null,
  expansion: {
    expandedNodes: new Set<string>(),
    loadingNodes: new Set<string>(),
  },
  viewport: {
    zoom: 1,
    panX: 0,
    panY: 0,
  },
  isLoading: false,
  error: null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useMindMapStore = create<MindMapState>((set, get) => ({
  ...initialState,

  // === Data Actions ===
  setGraphData: (nodes, edges) => {
    const nodeMap = new Map<string, MindMapNode>();
    nodes.forEach((node) => {
      nodeMap.set(node.id, node);
    });
    set({
      nodes: nodeMap,
      edges,
      expansion: {
        expandedNodes: new Set(nodes.filter((n) => n.isExpanded).map((n) => n.id)),
        loadingNodes: new Set(),
      },
    });
  },

  addNodes: (newNodes, newEdges) => {
    const { nodes, edges } = get();
    const updatedNodes = new Map(nodes);
    newNodes.forEach((node) => {
      if (!updatedNodes.has(node.id)) {
        updatedNodes.set(node.id, node);
      }
    });

    const existingEdgeIds = new Set(edges.map((e) => e.id));
    const filteredNewEdges = newEdges.filter((e) => !existingEdgeIds.has(e.id));

    set({
      nodes: updatedNodes,
      edges: [...edges, ...filteredNewEdges],
    });
  },

  removeChildNodes: (parentId) => {
    const { nodes, edges } = get();

    // Find all child node IDs
    const childIds = new Set(
      edges.filter((e) => e.source === parentId).map((e) => e.target)
    );

    // Remove children recursively
    const nodesToRemove = new Set<string>();
    const findDescendants = (nodeId: string) => {
      nodesToRemove.add(nodeId);
      edges
        .filter((e) => e.source === nodeId)
        .forEach((e) => findDescendants(e.target));
    };
    childIds.forEach(findDescendants);

    // Filter nodes and edges
    const updatedNodes = new Map(nodes);
    nodesToRemove.forEach((id) => {
      const node = updatedNodes.get(id);
      if (node && !node.isNative) {
        updatedNodes.delete(id);
      }
    });

    const updatedEdges = edges.filter(
      (e) => !nodesToRemove.has(e.target) && e.source !== parentId
    );

    set({ nodes: updatedNodes, edges: updatedEdges });
  },

  // === Native Node ===
  setNativeNode: (type, id) => {
    set({
      nativeNodeType: type,
      nativeNodeId: id,
      selectedNodeId: null,
      hoveredNodeId: null,
      expansion: {
        expandedNodes: new Set(),
        loadingNodes: new Set(),
      },
    });
  },

  // === Selection ===
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),

  // === Expansion ===
  expandNode: (nodeId) => {
    const { expansion, nodes } = get();
    const newExpanded = new Set(expansion.expandedNodes);
    newExpanded.add(nodeId);

    const node = nodes.get(nodeId);
    if (node) {
      const updatedNodes = new Map(nodes);
      updatedNodes.set(nodeId, { ...node, isExpanded: true });
      set({
        nodes: updatedNodes,
        expansion: { ...expansion, expandedNodes: newExpanded },
      });
    }
  },

  collapseNode: (nodeId) => {
    const { expansion, nodes } = get();
    const newExpanded = new Set(expansion.expandedNodes);
    newExpanded.delete(nodeId);

    const node = nodes.get(nodeId);
    if (node) {
      const updatedNodes = new Map(nodes);
      updatedNodes.set(nodeId, { ...node, isExpanded: false });

      // Remove child nodes
      get().removeChildNodes(nodeId);

      set({
        expansion: { ...expansion, expandedNodes: newExpanded },
      });
    }
  },

  setNodeLoading: (nodeId, isLoading) => {
    const { expansion, nodes } = get();
    const newLoading = new Set(expansion.loadingNodes);

    if (isLoading) {
      newLoading.add(nodeId);
    } else {
      newLoading.delete(nodeId);
    }

    const node = nodes.get(nodeId);
    if (node) {
      const updatedNodes = new Map(nodes);
      updatedNodes.set(nodeId, { ...node, isLoading });
      set({
        nodes: updatedNodes,
        expansion: { ...expansion, loadingNodes: newLoading },
      });
    }
  },

  setNodeExpanded: (nodeId, isExpanded) => {
    const { nodes } = get();
    const node = nodes.get(nodeId);
    if (node) {
      const updatedNodes = new Map(nodes);
      updatedNodes.set(nodeId, { ...node, isExpanded });
      set({ nodes: updatedNodes });
    }
  },

  // === Positions ===
  updateNodePosition: (nodeId, x, y) => {
    const { nodes } = get();
    const node = nodes.get(nodeId);
    if (node) {
      const updatedNodes = new Map(nodes);
      updatedNodes.set(nodeId, { ...node, x, y });
      set({ nodes: updatedNodes });
    }
  },

  updateAllPositions: (positions) => {
    const { nodes } = get();
    const updatedNodes = new Map(nodes);
    positions.forEach((pos, nodeId) => {
      const node = updatedNodes.get(nodeId);
      if (node) {
        updatedNodes.set(nodeId, { ...node, x: pos.x, y: pos.y });
      }
    });
    set({ nodes: updatedNodes });
  },

  fixNodePosition: (nodeId, fx, fy) => {
    const { nodes } = get();
    const node = nodes.get(nodeId);
    if (node) {
      const updatedNodes = new Map(nodes);
      updatedNodes.set(nodeId, { ...node, fx, fy });
      set({ nodes: updatedNodes });
    }
  },

  // === Viewport ===
  setZoom: (zoom) => {
    const { viewport } = get();
    set({ viewport: { ...viewport, zoom } });
  },

  setPan: (x, y) => {
    const { viewport } = get();
    set({ viewport: { ...viewport, panX: x, panY: y } });
  },

  // === Loading ===
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // === Reset ===
  reset: () => set(initialState),

  // === Getters ===
  getNode: (nodeId) => get().nodes.get(nodeId),

  getConnectedNodes: (nodeId) => {
    const { nodes, edges } = get();
    const connectedIds = new Set<string>();

    edges.forEach((edge) => {
      if (edge.source === nodeId) connectedIds.add(edge.target);
      if (edge.target === nodeId) connectedIds.add(edge.source);
    });

    return Array.from(connectedIds)
      .map((id) => nodes.get(id))
      .filter((n): n is MindMapNode => n !== undefined);
  },

  getChildNodes: (parentId) => {
    const { nodes, edges } = get();
    const childIds = edges
      .filter((e) => e.source === parentId)
      .map((e) => e.target);

    return childIds
      .map((id) => nodes.get(id))
      .filter((n): n is MindMapNode => n !== undefined);
  },

  getGraphData: () => {
    const { nodes, edges } = get();
    return {
      nodes: Array.from(nodes.values()),
      links: edges,
    };
  },

  canExpand: (nodeId) => {
    const node = get().nodes.get(nodeId);
    if (!node) return false;
    return !node.isExpanded && node.childCount > node.loadedChildCount;
  },

  isExpanded: (nodeId) => get().expansion.expandedNodes.has(nodeId),

  isNodeLoading: (nodeId) => get().expansion.loadingNodes.has(nodeId),
}));
