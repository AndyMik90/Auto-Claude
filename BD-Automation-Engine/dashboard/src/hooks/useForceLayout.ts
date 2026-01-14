// useForceLayout.ts - D3 Force Simulation for Mind Map Layout
// Automatically recalculates positions when nodes are expanded/collapsed

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { useMindMapStore } from '../stores/mindMapStore';

// ============================================================================
// Types
// ============================================================================

interface SimNode extends SimulationNodeDatum {
  id: string;
  tier: number;
  isNative: boolean;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
}

export interface ForceLayoutConfig {
  centerX: number;
  centerY: number;
  chargeStrength: number;
  linkDistance: number;
  linkStrength: number;
  collisionRadius: number;
  alphaDecay: number;
  velocityDecay: number;
  tierRadialStrength: number;
  tierRadialRadius: number[];
}

const DEFAULT_CONFIG: ForceLayoutConfig = {
  centerX: 0,
  centerY: 0,
  chargeStrength: -400,
  linkDistance: 120,
  linkStrength: 0.5,
  collisionRadius: 70,
  alphaDecay: 0.02,
  velocityDecay: 0.3,
  tierRadialStrength: 0.3,
  tierRadialRadius: [0, 150, 280, 400, 520], // Radius per tier
};

// ============================================================================
// Hook
// ============================================================================

export interface UseForceLayoutOptions {
  width: number;
  height: number;
  config?: Partial<ForceLayoutConfig>;
  onTick?: (nodes: Map<string, { x: number; y: number }>) => void;
  onEnd?: () => void;
}

export interface UseForceLayoutReturn {
  isSimulating: boolean;
  restart: () => void;
  stop: () => void;
  reheat: () => void;
  fixNode: (nodeId: string, x: number, y: number) => void;
  releaseNode: (nodeId: string) => void;
  setConfig: (config: Partial<ForceLayoutConfig>) => void;
}

export function useForceLayout({
  width,
  height,
  config: userConfig,
  onTick,
  onEnd,
}: UseForceLayoutOptions): UseForceLayoutReturn {
  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const configRef = useRef<ForceLayoutConfig>({ ...DEFAULT_CONFIG, ...userConfig });

  // Get graph data from store
  const nodes = useMindMapStore((state) => state.nodes);
  const edges = useMindMapStore((state) => state.edges);
  const updateAllPositions = useMindMapStore((state) => state.updateAllPositions);
  const fixNodePosition = useMindMapStore((state) => state.fixNodePosition);

  // Update config
  const setConfig = useCallback((newConfig: Partial<ForceLayoutConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig };
    // Restart simulation with new config
    if (simulationRef.current) {
      initSimulation();
    }
  }, []);

  // Initialize simulation
  const initSimulation = useCallback(() => {
    const config = configRef.current;
    const centerX = width / 2 + config.centerX;
    const centerY = height / 2 + config.centerY;

    // Convert store data to simulation format
    const simNodes: SimNode[] = Array.from(nodes.values()).map((node) => ({
      id: node.id,
      tier: node.tier,
      isNative: node.isNative,
      x: node.x ?? centerX + (Math.random() - 0.5) * 100,
      y: node.y ?? centerY + (Math.random() - 0.5) * 100,
      fx: node.fx,
      fy: node.fy,
      vx: node.vx ?? 0,
      vy: node.vy ?? 0,
    }));

    // Fix native node at center
    const nativeNode = simNodes.find((n) => n.isNative);
    if (nativeNode) {
      nativeNode.fx = centerX;
      nativeNode.fy = centerY;
    }

    const simLinks: SimLink[] = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    }));

    // Stop existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Create new simulation
    const simulation = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((d) => {
            // Shorter links for lower tiers
            const sourceNode = d.source as SimNode;
            const targetNode = d.target as SimNode;
            const maxTier = Math.max(sourceNode.tier || 0, targetNode.tier || 0);
            return config.linkDistance + maxTier * 20;
          })
          .strength(config.linkStrength)
      )
      .force('charge', forceManyBody().strength(config.chargeStrength))
      .force('center', forceCenter(centerX, centerY).strength(0.05))
      .force('collision', forceCollide<SimNode>().radius(config.collisionRadius))
      // Radial force to organize by tier
      .force(
        'radialX',
        forceX<SimNode>(centerX).strength((d) => {
          if (d.isNative) return 0;
          return config.tierRadialStrength * 0.3;
        })
      )
      .force(
        'radialY',
        forceY<SimNode>(centerY).strength((d) => {
          if (d.isNative) return 0;
          return config.tierRadialStrength * 0.3;
        })
      )
      .alphaDecay(config.alphaDecay)
      .velocityDecay(config.velocityDecay);

    // Handle tick events
    simulation.on('tick', () => {
      setIsSimulating(true);

      // Update positions in store
      const positions = new Map<string, { x: number; y: number }>();
      simNodes.forEach((node) => {
        if (node.x !== undefined && node.y !== undefined) {
          positions.set(node.id, { x: node.x, y: node.y });
        }
      });

      updateAllPositions(positions);
      onTick?.(positions);
    });

    // Handle simulation end
    simulation.on('end', () => {
      setIsSimulating(false);
      onEnd?.();
    });

    simulationRef.current = simulation;
    return simulation;
  }, [nodes, edges, width, height, updateAllPositions, onTick, onEnd]);

  // Initialize on mount and when data changes
  useEffect(() => {
    if (nodes.size > 0) {
      initSimulation();
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [nodes.size, edges.length, initSimulation]);

  // Restart simulation
  const restart = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart();
    } else {
      initSimulation();
    }
  }, [initSimulation]);

  // Stop simulation
  const stop = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
      setIsSimulating(false);
    }
  }, []);

  // Reheat simulation (gentle restart)
  const reheat = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(0.3).restart();
    }
  }, []);

  // Fix a node at a specific position
  const fixNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      if (simulationRef.current) {
        const node = simulationRef.current.nodes().find((n) => n.id === nodeId);
        if (node) {
          node.fx = x;
          node.fy = y;
          fixNodePosition(nodeId, x, y);
          simulationRef.current.alpha(0.3).restart();
        }
      }
    },
    [fixNodePosition]
  );

  // Release a fixed node
  const releaseNode = useCallback(
    (nodeId: string) => {
      if (simulationRef.current) {
        const node = simulationRef.current.nodes().find((n) => n.id === nodeId);
        if (node) {
          node.fx = null;
          node.fy = null;
          fixNodePosition(nodeId, null, null);
          simulationRef.current.alpha(0.3).restart();
        }
      }
    },
    [fixNodePosition]
  );

  return {
    isSimulating,
    restart,
    stop,
    reheat,
    fixNode,
    releaseNode,
    setConfig,
  };
}

// ============================================================================
// Simple Layout Utilities (fallback when D3 is not available)
// ============================================================================

export interface LayoutNode {
  id: string;
  tier: number;
  isNative: boolean;
  x?: number;
  y?: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

/**
 * Simple radial layout for nodes without D3
 * Places nodes in concentric circles based on tier
 */
export function calculateRadialLayout(
  nodes: LayoutNode[],
  _edges: LayoutEdge[],
  centerX: number,
  centerY: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Group nodes by tier
  const tiers = new Map<number, LayoutNode[]>();
  nodes.forEach((node) => {
    const tier = node.tier ?? 0;
    if (!tiers.has(tier)) {
      tiers.set(tier, []);
    }
    tiers.get(tier)!.push(node);
  });

  // Place native node at center
  const nativeNode = nodes.find((n) => n.isNative);
  if (nativeNode) {
    positions.set(nativeNode.id, { x: centerX, y: centerY });
  }

  // Calculate positions for each tier
  const tierRadii = [0, 150, 280, 400, 520, 640];

  tiers.forEach((tierNodes, tier) => {
    if (tier === 0) return; // Native node already placed

    const radius = tierRadii[tier] ?? tierRadii[tierRadii.length - 1] + (tier - tierRadii.length + 1) * 120;
    const angleStep = (2 * Math.PI) / tierNodes.length;

    tierNodes.forEach((node, index) => {
      if (node.isNative) return;

      const angle = angleStep * index - Math.PI / 2; // Start from top
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      positions.set(node.id, { x, y });
    });
  });

  return positions;
}

/**
 * Calculate layout after node expansion
 * Animates new nodes from parent position
 */
export function calculateExpansionLayout(
  parentId: string,
  newNodes: LayoutNode[],
  existingPositions: Map<string, { x: number; y: number }>,
  centerX: number,
  centerY: number
): Map<string, { x: number; y: number }> {
  const positions = new Map(existingPositions);
  const parentPos = positions.get(parentId) ?? { x: centerX, y: centerY };

  // Calculate angle from center to parent
  const parentAngle = Math.atan2(parentPos.y - centerY, parentPos.x - centerX);

  // Spread new nodes in an arc around the parent
  const spreadAngle = Math.PI / 3; // 60 degrees spread
  const childRadius = 100; // Distance from parent

  newNodes.forEach((node, index) => {
    const angleOffset =
      newNodes.length === 1
        ? 0
        : ((index / (newNodes.length - 1)) * 2 - 1) * spreadAngle;
    const angle = parentAngle + angleOffset;

    const x = parentPos.x + childRadius * Math.cos(angle);
    const y = parentPos.y + childRadius * Math.sin(angle);

    positions.set(node.id, { x, y });
  });

  return positions;
}

export default useForceLayout;
