// Mind Map Canvas Component
// Uses react-force-graph-2d for D3 force layout visualization

import { useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useMindMapStore } from '../../stores/mindMapStore';
import type { MindMapNode } from '../../stores/mindMapStore';
import { useMindMapData, useGraphData } from '../../hooks/useMindMapData';
import { NODE_TYPE_CONFIG, PRIORITY_COLORS } from './MindMapNode';
import NotePanel from './NotePanel';

// Force configuration from Part 3.6
const FORCE_CONFIG = {
  linkDistance: 100,
  chargeStrength: -300,
  collisionRadius: 50,
};

interface MindMapCanvasProps {
  className?: string;
}

// Simple canvas node renderer
function renderNodeToCanvas(
  ctx: CanvasRenderingContext2D,
  node: MindMapNode & { x: number; y: number },
  isSelected: boolean,
  isHovered: boolean,
  globalScale: number
): void {
  const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.JOB;
  const priorityConfig = node.priority ? PRIORITY_COLORS[node.priority] : null;

  // Node dimensions (scaled)
  const baseWidth = 140;
  const baseHeight = 60;
  const width = baseWidth / globalScale;
  const height = baseHeight / globalScale;
  const borderRadius = 8 / globalScale;
  const borderWidth = 4 / globalScale;

  const x = node.x - width / 2;
  const y = node.y - height / 2;

  // Draw shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = (isHovered ? 12 : 6) / globalScale;
  ctx.shadowOffsetY = (isHovered ? 4 : 2) / globalScale;

  // Draw background
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, borderRadius);
  ctx.fill();
  ctx.restore();

  // Draw border
  ctx.strokeStyle = priorityConfig?.border || config.borderColor;
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, borderRadius);
  ctx.stroke();

  // Draw left accent border
  ctx.fillStyle = priorityConfig?.border || config.borderColor;
  ctx.fillRect(x, y + borderRadius, borderWidth, height - borderRadius * 2);

  // Selection ring
  if (isSelected) {
    ctx.strokeStyle = '#3182ce';
    ctx.lineWidth = 3 / globalScale;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(
      x - 4 / globalScale,
      y - 4 / globalScale,
      width + 8 / globalScale,
      height + 8 / globalScale,
      borderRadius + 4 / globalScale
    );
    ctx.stroke();
  }

  // Draw icon and type label
  const fontSize = Math.max(10 / globalScale, 8);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = config.textColor;
  ctx.textBaseline = 'top';

  // Icon
  ctx.font = `${fontSize * 1.2}px sans-serif`;
  ctx.fillText(config.icon, x + 8 / globalScale, y + 8 / globalScale);

  // Type label
  ctx.font = `bold ${fontSize * 0.8}px sans-serif`;
  ctx.fillStyle = config.textColor;
  ctx.fillText(config.label, x + 24 / globalScale, y + 10 / globalScale);

  // BD Score if available
  if (node.bdScore !== undefined) {
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = config.textColor;
    ctx.textAlign = 'right';
    ctx.fillText(String(node.bdScore), x + width - 8 / globalScale, y + 8 / globalScale);
    ctx.textAlign = 'left';
  }

  // Title (truncated)
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = '#1a202c';
  const maxTitleWidth = width - 16 / globalScale;
  let title = node.label;
  while (ctx.measureText(title).width > maxTitleWidth && title.length > 3) {
    title = title.slice(0, -4) + '...';
  }
  ctx.fillText(title, x + 8 / globalScale, y + 28 / globalScale);

  // Subtitle
  if (node.subtitle) {
    ctx.font = `${fontSize * 0.9}px sans-serif`;
    ctx.fillStyle = '#718096';
    let subtitle = node.subtitle;
    while (ctx.measureText(subtitle).width > maxTitleWidth && subtitle.length > 3) {
      subtitle = subtitle.slice(0, -4) + '...';
    }
    ctx.fillText(subtitle, x + 8 / globalScale, y + 44 / globalScale);
  }
}

export function MindMapCanvas({ className = '' }: MindMapCanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Load data
  const { isLoading, error, reload, nodeCount, edgeCount } = useMindMapData();

  // Store state
  const selectedNodeId = useMindMapStore((state) => state.selectedNodeId);
  const hoveredNodeId = useMindMapStore((state) => state.hoveredNodeId);
  const setSelectedNode = useMindMapStore((state) => state.setSelectedNode);
  const setHoveredNode = useMindMapStore((state) => state.setHoveredNode);
  const nativeNodeId = useMindMapStore((state) => state.nativeNodeId);
  const viewport = useMindMapStore((state) => state.viewport);

  // Get graph data
  const graphData = useGraphData();

  // Handle container resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(width, 400),
          height: Math.max(height, 300),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Configure force simulation
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge')?.strength(FORCE_CONFIG.chargeStrength);
      graphRef.current.d3Force('link')?.distance(FORCE_CONFIG.linkDistance);
      graphRef.current.d3Force('collision')?.radius(FORCE_CONFIG.collisionRadius);
    }
  }, []);

  // Node click handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node.id);
  }, [setSelectedNode]);

  // Node hover handlers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeHover = useCallback((node: any | null) => {
    setHoveredNode(node?.id || null);
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'grab';
    }
  }, [setHoveredNode]);

  // Node drag handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeDrag = useCallback((node: any) => {
    // Update fixed position during drag
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  // Node drag end handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeDragEnd = useCallback((node: any) => {
    // Keep position fixed after drag
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  // Background click to deselect
  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  // Custom node canvas renderer
  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isSelected = node.id === selectedNodeId;
      const isHovered = node.id === hoveredNodeId;

      if (typeof node.x !== 'number' || typeof node.y !== 'number') return;

      renderNodeToCanvas(
        ctx,
        node as MindMapNode & { x: number; y: number },
        isSelected,
        isHovered,
        globalScale
      );
    },
    [selectedNodeId, hoveredNodeId]
  );

  // Node pointer area for interaction
  const nodePointerAreaPaint = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = 70 / globalScale;
      if (typeof node.x !== 'number' || typeof node.y !== 'number') return;

      ctx.fillStyle = color;
      ctx.fillRect(node.x - size, node.y - size / 2, size * 2, size);
    },
    []
  );

  // Link color based on relationship strength
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getLinkColor = useCallback((link: any) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    // Highlight links connected to selected or hovered node
    if (sourceId === selectedNodeId || targetId === selectedNodeId) {
      return '#3182ce';
    }
    if (sourceId === hoveredNodeId || targetId === hoveredNodeId) {
      return '#63b3ed';
    }

    // Strong vs weak relationships
    if (link.isStrong) {
      return '#718096';
    }
    return '#cbd5e0';
  }, [selectedNodeId, hoveredNodeId]);

  // Link width based on weight
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getLinkWidth = useCallback((link: any) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    if (sourceId === selectedNodeId || targetId === selectedNodeId) {
      return 3;
    }
    if (sourceId === hoveredNodeId || targetId === hoveredNodeId) {
      return 2;
    }
    return link.isStrong ? 2 : 1;
  }, [selectedNodeId, hoveredNodeId]);

  // Link dash pattern for weak relationships
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getLinkLineDash = useCallback((link: any) => {
    return link.isStrong ? [] : [5, 5];
  }, []);

  // Center graph on native node
  useEffect(() => {
    if (graphRef.current && nativeNodeId) {
      const node = graphData.nodes.find((n) => n.id === nativeNodeId);
      if (node && typeof node.x === 'number' && typeof node.y === 'number') {
        graphRef.current.centerAt(node.x, node.y, 500);
        graphRef.current.zoom(1.5, 500);
      }
    }
  }, [nativeNodeId, graphData.nodes]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading mind map data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center p-6 max-w-md">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Failed to Load Data</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={reload}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (nodeCount === 0) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center p-6">
          <div className="text-gray-400 text-4xl mb-4">{'\uD83D\uDDFA\uFE0F'}</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Mind Map Data</h3>
          <p className="text-gray-600">
            Select a job, program, or contact to start exploring connections
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full ${className}`}>
      {/* Graph Canvas */}
      <div ref={containerRef} className="flex-1 relative bg-gray-50">
        {/* Stats overlay */}
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm px-3 py-2 text-xs text-gray-600">
          <span className="font-medium">{nodeCount}</span> nodes |{' '}
          <span className="font-medium">{edgeCount}</span> edges
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1">
          <button
            onClick={() => graphRef.current?.zoom(viewport.zoom * 1.2, 200)}
            className="w-8 h-8 bg-white rounded shadow hover:bg-gray-50 text-gray-700 font-bold"
          >
            +
          </button>
          <button
            onClick={() => graphRef.current?.zoom(viewport.zoom / 1.2, 200)}
            className="w-8 h-8 bg-white rounded shadow hover:bg-gray-50 text-gray-700 font-bold"
          >
            -
          </button>
          <button
            onClick={() => graphRef.current?.zoomToFit(400, 50)}
            className="w-8 h-8 bg-white rounded shadow hover:bg-gray-50 text-gray-700 text-xs"
            title="Fit to view"
          >
            {'\u2922'}
          </button>
        </div>

        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width - 320}
          height={dimensions.height}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          graphData={graphData as any}
          nodeId="id"
          nodeLabel={(node: MindMapNode) => `${NODE_TYPE_CONFIG[node.type]?.icon || ''} ${node.label}`}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
          linkSource="source"
          linkTarget="target"
          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          linkLineDash={getLinkLineDash}
          linkDirectionalArrowLength={0}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onNodeDrag={handleNodeDrag}
          onNodeDragEnd={handleNodeDragEnd}
          onBackgroundClick={handleBackgroundClick}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          warmupTicks={50}
          cooldownTicks={100}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />
      </div>

      {/* Note Panel */}
      <NotePanel />
    </div>
  );
}

export default MindMapCanvas;
