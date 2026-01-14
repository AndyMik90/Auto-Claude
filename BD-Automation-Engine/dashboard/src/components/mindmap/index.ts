// Mind Map Component Exports

// Phase A: Core Node Components
export { MindMapNode, NODE_TYPE_CONFIG, PRIORITY_COLORS, renderNodeToCanvas } from './MindMapNode';
export { NativeNodeTabs, NativeNodeTabsCompact, NativeNodeDropdown } from './NativeNodeTabs';

// Phase B/C: Canvas and Panel Components
export { MindMapCanvas } from './MindMapCanvas';
export { NotePanel } from './NotePanel';

// Phase D: Advanced Features
export { ContextMenu } from './ContextMenu';
export type { ContextMenuProps, ContextMenuPosition, AttachmentType } from './ContextMenu';

export { ControlBar } from './ControlBar';
export type { ControlBarProps, LayoutMode, ColorByOption } from './ControlBar';

export { AIMapGenerator } from './AIMapGenerator';
export type { AIMapGeneratorProps } from './AIMapGenerator';

export { AttachmentPanel } from './AttachmentPanel';
export type {
  AttachmentPanelProps,
  Attachment,
  NoteAttachment,
  TodoAttachment,
  TaskAttachment,
  CalloutAttachment,
  CommentAttachment,
  CalloutType,
  TaskPriority,
  TaskStatus,
} from './AttachmentPanel';

// Re-export types
export type { MindMapNode as MindMapNodeData } from '../../stores/mindMapStore';
export type { NativeNodeType } from '../../configs/nativeNodeConfigs';
