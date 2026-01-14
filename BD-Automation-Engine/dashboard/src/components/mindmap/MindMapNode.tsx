// Mind Map Node Component
// Type-specific styling per entity type from Part 3.2 Node Visual Design
// Supports tier-based expansion with + button

import { memo, useCallback } from 'react';
import type { NodeType, PriorityLevel, MindMapNode as NodeData } from '../../stores/mindMapStore';
import { Loader2 } from 'lucide-react';

// Node type configuration with colors and icons
export const NODE_TYPE_CONFIG: Record<
  NodeType,
  {
    icon: string;
    label: string;
    bgGradient: string;
    borderColor: string;
    textColor: string;
  }
> = {
  JOB: {
    icon: '\uD83C\uDFAF', // Target
    label: 'JOB',
    bgGradient: 'linear-gradient(135deg, #fff5f5, #fed7d7)',
    borderColor: '#e53e3e',
    textColor: '#c53030',
  },
  PROGRAM: {
    icon: '\uD83D\uDCCB', // Clipboard
    label: 'PROGRAM',
    bgGradient: 'linear-gradient(135deg, #ebf8ff, #bee3f8)',
    borderColor: '#3182ce',
    textColor: '#2c5282',
  },
  PRIME: {
    icon: '\uD83C\uDFE2', // Office building
    label: 'PRIME',
    bgGradient: 'linear-gradient(135deg, #f0fff4, #c6f6d5)',
    borderColor: '#38a169',
    textColor: '#276749',
  },
  LOCATION: {
    icon: '\uD83D\uDCCD', // Pin
    label: 'LOCATION',
    bgGradient: 'linear-gradient(135deg, #faf5ff, #e9d8fd)',
    borderColor: '#805ad5',
    textColor: '#553c9a',
  },
  BD_EVENT: {
    icon: '\uD83D\uDCC5', // Calendar
    label: 'EVENT',
    bgGradient: 'linear-gradient(135deg, #fffff0, #fefcbf)',
    borderColor: '#d69e2e',
    textColor: '#975a16',
  },
  CONTACT: {
    icon: '\uD83D\uDC64', // Person
    label: 'CONTACT',
    bgGradient: 'linear-gradient(135deg, #fff5f7, #fed7e2)',
    borderColor: '#d53f8c',
    textColor: '#97266d',
  },
  CUSTOMER: {
    icon: '\uD83C\uDFDB\uFE0F', // Building columns
    label: 'CUSTOMER',
    bgGradient: 'linear-gradient(135deg, #f5f3ff, #ddd6fe)',
    borderColor: '#9f7aea',
    textColor: '#6b46c1',
  },
  PTS_CONTRACTOR: {
    icon: '\uD83D\uDCBC', // Briefcase
    label: 'PTS',
    bgGradient: 'linear-gradient(135deg, #e6fffa, #b2f5ea)',
    borderColor: '#319795',
    textColor: '#234e52',
  },
};

// Priority indicator colors
export const PRIORITY_COLORS: Record<PriorityLevel, { border: string; badge: string; emoji: string }> = {
  critical: { border: '#e53e3e', badge: 'bg-red-600', emoji: '\uD83D\uDD34' },
  high: { border: '#dd6b20', badge: 'bg-orange-500', emoji: '\uD83D\uDFE0' },
  medium: { border: '#d69e2e', badge: 'bg-yellow-500', emoji: '\uD83D\uDFE1' },
  low: { border: '#38a169', badge: 'bg-green-500', emoji: '\uD83D\uDFE2' },
  standard: { border: '#718096', badge: 'bg-gray-500', emoji: '\u26AA' },
};

interface MindMapNodeProps {
  node: NodeData;
  isSelected?: boolean;
  isHovered?: boolean;
  isNative?: boolean;
  canExpand?: boolean;
  isLoading?: boolean;
  onClick?: (node: NodeData) => void;
  onDoubleClick?: (node: NodeData) => void;
  onExpand?: (node: NodeData) => void;
  onCollapse?: (node: NodeData) => void;
  onHover?: (node: NodeData, isHovered: boolean) => void;
  onDragStart?: (e: React.MouseEvent, node: NodeData) => void;
  style?: React.CSSProperties;
}

export const MindMapNode = memo(function MindMapNode({
  node,
  isSelected = false,
  isHovered = false,
  isNative = false,
  canExpand = false,
  isLoading = false,
  onClick,
  onDoubleClick,
  onExpand,
  onCollapse,
  onHover,
  onDragStart,
  style,
}: MindMapNodeProps) {
  const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.JOB;
  const priorityConfig = node.priority ? PRIORITY_COLORS[node.priority] : null;
  const isExpanded = node.isExpanded;
  const nodeIsLoading = isLoading || node.isLoading;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(node);
  }, [onClick, node]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(node);
  }, [onDoubleClick, node]);

  const handleExpandToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeIsLoading) return;

    if (isExpanded) {
      onCollapse?.(node);
    } else {
      onExpand?.(node);
    }
  }, [nodeIsLoading, isExpanded, onCollapse, onExpand, node]);

  const handleMouseEnter = useCallback(() => {
    onHover?.(node, true);
  }, [onHover, node]);

  const handleMouseLeave = useCallback(() => {
    onHover?.(node, false);
  }, [onHover, node]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (onDragStart) {
      onDragStart(e, node);
    }
  }, [onDragStart, node]);

  return (
    <div
      className={`
        absolute rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        ${isHovered ? 'scale-105 shadow-lg' : 'shadow-md'}
        ${isNative ? 'border-2 min-w-[180px]' : 'min-w-[120px]'}
        ${nodeIsLoading ? 'opacity-80' : ''}
      `}
      style={{
        ...style,
        background: config.bgGradient,
        borderLeft: `4px solid ${priorityConfig?.border || config.borderColor}`,
        borderColor: isNative ? config.borderColor : undefined,
        maxWidth: '200px',
        transform: 'translate(-50%, -50%)',
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1">
          <span className="text-sm">{config.icon}</span>
          <span
            className="text-[10px] font-bold uppercase tracking-wide"
            style={{ color: config.textColor }}
          >
            {config.label}
          </span>
        </div>
        {node.bdScore !== undefined && (
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded bg-white/50"
            style={{ color: config.textColor }}
          >
            {node.bdScore}
          </span>
        )}
        {node.tier !== undefined && (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
            T{node.tier}
          </span>
        )}
      </div>

      {/* Title */}
      <div
        className="font-semibold text-sm leading-tight truncate"
        style={{ color: config.textColor }}
        title={node.label}
      >
        {node.label}
      </div>

      {/* Subtitle */}
      {node.subtitle && (
        <div className="text-xs text-gray-600 truncate mt-0.5" title={node.subtitle}>
          {node.subtitle}
        </div>
      )}

      {/* Tags */}
      {node.tags && node.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {node.clearance && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-white">
              {node.clearance}
            </span>
          )}
          {node.priority && priorityConfig && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/70 flex items-center gap-0.5">
              {priorityConfig.emoji}
              <span className="capitalize">{node.priority}</span>
            </span>
          )}
        </div>
      )}

      {/* Expand/Collapse Button - Only show if can expand or is expanded */}
      {(canExpand || isExpanded || node.childCount > 0) && (
        <button
          className={`
            absolute -bottom-3 left-1/2 -translate-x-1/2
            w-7 h-7 rounded-full
            flex items-center justify-center
            text-white text-sm font-bold
            transition-all duration-200
            shadow-md border-2 border-white
            ${nodeIsLoading ? 'bg-blue-400 cursor-wait' : ''}
            ${!nodeIsLoading && isExpanded ? 'bg-blue-600 hover:bg-blue-700' : ''}
            ${!nodeIsLoading && !isExpanded ? 'bg-slate-600 hover:bg-blue-600' : ''}
          `}
          onClick={handleExpandToggle}
          disabled={nodeIsLoading}
          title={
            nodeIsLoading
              ? 'Loading...'
              : isExpanded
              ? 'Collapse connections'
              : `Expand ${node.childCount} connections`
          }
        >
          {nodeIsLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isExpanded ? (
            '-'
          ) : (
            '+'
          )}
        </button>
      )}

      {/* Child count badge (when not expanded) */}
      {!isExpanded && node.childCount > 0 && node.loadedChildCount > 0 && (
        <div className="absolute -top-1 -right-1">
          <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center inline-block">
            {node.loadedChildCount}
          </span>
        </div>
      )}

      {/* Native node indicator */}
      {isNative && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2">
          <span className="bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
            Native
          </span>
        </div>
      )}
    </div>
  );
});

// Simple node renderer for canvas (returns drawing instructions)
export function renderNodeToCanvas(
  ctx: CanvasRenderingContext2D,
  node: NodeData & { x: number; y: number },
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
    ctx.roundRect(x - 4 / globalScale, y - 4 / globalScale, width + 8 / globalScale, height + 8 / globalScale, borderRadius + 4 / globalScale);
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

export default MindMapNode;
