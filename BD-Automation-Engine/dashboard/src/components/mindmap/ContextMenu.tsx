import { useEffect, useRef, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Target,
  Focus,
  Eye,
  EyeOff,
  Copy,
  Link,
  Mail,
  Plus,
  FileDown,
  FileText,
  CheckSquare,
  ClipboardList,
  MessageSquare,
  Tag,
  MessageCircle,
  Image,
  Hash,
} from 'lucide-react';

export type NodeType = 'JOB' | 'PROGRAM' | 'CONTACT' | 'PRIME' | 'LOCATION' | 'TASK_ORDER' | 'TEAM' | 'BD_EVENT';

export interface MindMapNode {
  id: string;
  type: NodeType;
  label: string;
  data: Record<string, unknown>;
  expanded?: boolean;
  linkedInUrl?: string;
  email?: string;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuProps {
  visible: boolean;
  position: ContextMenuPosition;
  node: MindMapNode | null;
  onClose: () => void;
  onExpandAll: (nodeId: string) => void;
  onCollapse: (nodeId: string) => void;
  onSetAsNative: (nodeId: string) => void;
  onFocus: (nodeId: string) => void;
  onShowOnlyType: (type: NodeType) => void;
  onHide: (nodeId: string) => void;
  onCopyDetails: (node: MindMapNode) => void;
  onCopyLinkedIn: (url: string) => void;
  onCopyEmail: (email: string) => void;
  onAddToCallSheet: (nodeId: string) => void;
  onExportBranch: (nodeId: string) => void;
  onInsertAttachment: (nodeId: string, type: AttachmentType) => void;
}

export type AttachmentType =
  | 'note'
  | 'todo'
  | 'task'
  | 'hyperlink'
  | 'callout'
  | 'label'
  | 'comment'
  | 'image'
  | 'equation';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
}

interface SubMenuProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function MenuItem({ icon, label, onClick, disabled, shortcut }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors
        ${disabled
          ? 'text-gray-500 cursor-not-allowed'
          : 'text-gray-200 hover:bg-gray-700 hover:text-white'
        }`}
    >
      <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-gray-500 ml-4">{shortcut}</span>
      )}
    </button>
  );
}

function SubMenu({ icon, label, children }: SubMenuProps) {
  return (
    <div className="relative group/submenu">
      <button className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors">
        <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronRight className="w-3 h-3 text-gray-500" />
      </button>
      <div className="absolute left-full top-0 ml-0.5 hidden group-hover/submenu:block">
        <div className="bg-gray-800 border border-gray-700 rounded-md shadow-xl py-1 min-w-[180px]">
          {children}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-700 my-1" />;
}

export function ContextMenu({
  visible,
  position,
  node,
  onClose,
  onExpandAll,
  onCollapse,
  onSetAsNative,
  onFocus,
  onShowOnlyType,
  onHide,
  onCopyDetails,
  onCopyLinkedIn,
  onCopyEmail,
  onAddToCallSheet,
  onExportBranch,
  onInsertAttachment,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      onClose();
    }
  }, [onClose]);

  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [visible, handleClickOutside, handleEscape]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (visible && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = position.x;
      let adjustedY = position.y;

      if (position.x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }
      if (position.y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      menu.style.left = `${adjustedX}px`;
      menu.style.top = `${adjustedY}px`;
    }
  }, [visible, position]);

  if (!visible || !node) return null;

  const isContact = node.type === 'CONTACT';
  const hasLinkedIn = Boolean(node.linkedInUrl);
  const hasEmail = Boolean(node.email);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-700 rounded-md shadow-xl py-1 min-w-[220px]"
      style={{ left: position.x, top: position.y }}
    >
      {/* Node Header */}
      <div className="px-3 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span>{getNodeIcon(node.type)}</span>
          <span className="font-medium truncate max-w-[180px]">{node.label}</span>
        </div>
      </div>

      {/* Expand/Collapse */}
      <div className="py-1">
        <MenuItem
          icon={<ChevronRight className="w-4 h-4" />}
          label="Expand All Connections"
          onClick={() => handleAction(() => onExpandAll(node.id))}
        />
        <MenuItem
          icon={<ChevronDown className="w-4 h-4" />}
          label="Collapse"
          onClick={() => handleAction(() => onCollapse(node.id))}
          disabled={!node.expanded}
        />
      </div>

      <Divider />

      {/* View Controls */}
      <div className="py-1">
        <MenuItem
          icon={<Target className="w-4 h-4" />}
          label="Set as Native Node"
          onClick={() => handleAction(() => onSetAsNative(node.id))}
        />
        <MenuItem
          icon={<Focus className="w-4 h-4" />}
          label="Focus (Hide Others)"
          onClick={() => handleAction(() => onFocus(node.id))}
        />
        <MenuItem
          icon={<Eye className="w-4 h-4" />}
          label="Show Only This Type"
          onClick={() => handleAction(() => onShowOnlyType(node.type))}
        />
        <MenuItem
          icon={<EyeOff className="w-4 h-4" />}
          label="Hide This Node"
          onClick={() => handleAction(() => onHide(node.id))}
        />
      </div>

      <Divider />

      {/* Copy Actions */}
      <div className="py-1">
        <MenuItem
          icon={<Copy className="w-4 h-4" />}
          label="Copy Details"
          onClick={() => handleAction(() => onCopyDetails(node))}
        />
        {isContact && (
          <>
            <MenuItem
              icon={<Link className="w-4 h-4" />}
              label="Copy LinkedIn URL"
              onClick={() => handleAction(() => onCopyLinkedIn(node.linkedInUrl!))}
              disabled={!hasLinkedIn}
            />
            <MenuItem
              icon={<Mail className="w-4 h-4" />}
              label="Copy Email"
              onClick={() => handleAction(() => onCopyEmail(node.email!))}
              disabled={!hasEmail}
            />
          </>
        )}
      </div>

      <Divider />

      {/* BD Actions */}
      <div className="py-1">
        {isContact && (
          <MenuItem
            icon={<Plus className="w-4 h-4" />}
            label="Add to Call Sheet"
            onClick={() => handleAction(() => onAddToCallSheet(node.id))}
          />
        )}
        <MenuItem
          icon={<FileDown className="w-4 h-4" />}
          label="Export This Branch"
          onClick={() => handleAction(() => onExportBranch(node.id))}
        />
      </div>

      <Divider />

      {/* Insert Attachments Submenu */}
      <div className="py-1">
        <SubMenu icon={<Plus className="w-4 h-4" />} label="Insert...">
          <MenuItem
            icon={<FileText className="w-4 h-4" />}
            label="Note"
            shortcut="N"
            onClick={() => handleAction(() => onInsertAttachment(node.id, 'note'))}
          />
          <MenuItem
            icon={<CheckSquare className="w-4 h-4" />}
            label="To-Do"
            shortcut="T"
            onClick={() => handleAction(() => onInsertAttachment(node.id, 'todo'))}
          />
          <MenuItem
            icon={<ClipboardList className="w-4 h-4" />}
            label="Task"
            shortcut="⇧T"
            onClick={() => handleAction(() => onInsertAttachment(node.id, 'task'))}
          />
          <MenuItem
            icon={<Link className="w-4 h-4" />}
            label="Hyperlink"
            shortcut="⌘K"
            onClick={() => handleAction(() => onInsertAttachment(node.id, 'hyperlink'))}
          />
          <MenuItem
            icon={<MessageSquare className="w-4 h-4" />}
            label="Callout"
            shortcut="C"
            onClick={() => handleAction(() => onInsertAttachment(node.id, 'callout'))}
          />
          <MenuItem
            icon={<Tag className="w-4 h-4" />}
            label="Label"
            shortcut="L"
            onClick={() => handleAction(() => onInsertAttachment(node.id, 'label'))}
          />
          <MenuItem
            icon={<MessageCircle className="w-4 h-4" />}
            label="Comment"
            shortcut="/"
            onClick={() => handleAction(() => onInsertAttachment(node.id, 'comment'))}
          />
          <MenuItem
            icon={<Image className="w-4 h-4" />}
            label="Image"
            onClick={() => handleAction(() => onInsertAttachment(node.id, 'image'))}
          />
          <MenuItem
            icon={<Hash className="w-4 h-4" />}
            label="Equation"
            onClick={() => handleAction(() => onInsertAttachment(node.id, 'equation'))}
          />
        </SubMenu>
      </div>
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

export default ContextMenu;
