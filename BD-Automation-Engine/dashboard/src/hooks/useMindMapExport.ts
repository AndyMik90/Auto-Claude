import { useCallback } from 'react';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';

export type NodeType = 'JOB' | 'PROGRAM' | 'CONTACT' | 'PRIME' | 'LOCATION' | 'TASK_ORDER' | 'TEAM' | 'BD_EVENT';
export type LayoutMode = 'radial' | 'hierarchical' | 'force';

export interface MindMapNode {
  id: string;
  type: NodeType;
  label: string;
  data: Record<string, unknown>;
  children?: MindMapNode[];
}

export interface MindMapEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface MindMapExportData {
  nativeNode: MindMapNode;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  layout: {
    mode: LayoutMode;
    positions: Record<string, { x: number; y: number }>;
  };
}

// XMind topic structure
interface XMindTopic {
  id: string;
  class: string;
  title: string;
  structureClass?: string;
  notes?: {
    plain: {
      content: string;
    };
  };
  markers?: { markerId: string }[];
  children?: {
    attached: XMindTopic[];
  };
}

interface UseMindMapExportOptions {
  canvasRef: React.RefObject<HTMLElement | null>;
  exportData: MindMapExportData | null;
  fileName?: string;
}

interface UseMindMapExportReturn {
  exportToOPML: () => void;
  exportToJSON: () => void;
  exportToXMind: () => Promise<void>;
  exportToPNG: () => Promise<void>;
  isExporting: boolean;
}

export function useMindMapExport({
  canvasRef,
  exportData,
  fileName = 'bd-mind-map',
}: UseMindMapExportOptions): UseMindMapExportReturn {
  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const buildOPMLOutline = useCallback((node: MindMapNode, edges: MindMapEdge[], allNodes: MindMapNode[]): string => {
    const childEdges = edges.filter(e => e.source === node.id);
    const childNodes = childEdges
      .map(e => allNodes.find(n => n.id === e.target))
      .filter((n): n is MindMapNode => n !== undefined);

    const noteContent = formatNodeNote(node);
    const noteAttr = noteContent ? ` _note="${escapeXML(noteContent)}"` : '';

    const childrenXML = childNodes
      .map(child => buildOPMLOutline(child, edges, allNodes))
      .join('\n');

    const icon = getNodeIcon(node.type);
    const text = `${icon} ${node.label}`;

    if (childNodes.length > 0) {
      return `<outline text="${escapeXML(text)}"${noteAttr}>
${childrenXML}
</outline>`;
    }

    return `<outline text="${escapeXML(text)}"${noteAttr}/>`;
  }, []);

  const exportToOPML = useCallback(() => {
    if (!exportData) return;

    const { nativeNode, nodes, edges } = exportData;
    const rootOutline = buildOPMLOutline(nativeNode, edges, [nativeNode, ...nodes]);
    const dateCreated = new Date().toISOString();
    const title = `BD Intelligence Mind Map - ${nativeNode.type}: ${nativeNode.label}`;

    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>${escapeXML(title)}</title>
    <dateCreated>${dateCreated}</dateCreated>
  </head>
  <body>
${rootOutline}
  </body>
</opml>`;

    downloadFile(opml, `${fileName}.opml`, 'application/xml');
  }, [exportData, buildOPMLOutline, downloadFile, fileName]);

  const exportToJSON = useCallback(() => {
    if (!exportData) return;

    const jsonExport = {
      mindMap: {
        nativeNode: {
          type: exportData.nativeNode.type,
          id: exportData.nativeNode.id,
          title: exportData.nativeNode.label,
          data: exportData.nativeNode.data,
        },
        nodes: exportData.nodes.map(node => ({
          id: node.id,
          type: node.type,
          data: node.data,
        })),
        edges: exportData.edges.map(edge => ({
          source: edge.source,
          target: edge.target,
          relationship: edge.relationship,
        })),
        layout: exportData.layout,
        metadata: {
          exportDate: new Date().toISOString(),
          version: '1.0',
        },
      },
    };

    const jsonString = JSON.stringify(jsonExport, null, 2);
    downloadFile(jsonString, `${fileName}.json`, 'application/json');
  }, [exportData, downloadFile, fileName]);

  // Build XMind topic structure recursively
  const buildXMindTopic = useCallback((node: MindMapNode, edges: MindMapEdge[], allNodes: MindMapNode[]): XMindTopic => {
    const childEdges = edges.filter(e => e.source === node.id);
    const childNodes = childEdges
      .map(e => allNodes.find(n => n.id === e.target))
      .filter((n): n is MindMapNode => n !== undefined);

    const noteContent = formatNodeNote(node);
    const icon = getNodeIcon(node.type);

    const topic: XMindTopic = {
      id: node.id,
      class: 'topic',
      title: `${icon} ${node.label}`,
      structureClass: 'org.xmind.ui.map.unbalanced',
    };

    // Add notes if available
    if (noteContent) {
      topic.notes = {
        plain: {
          content: noteContent,
        },
      };
    }

    // Add markers based on node type and priority
    const markers: { markerId: string }[] = [];
    if (node.type === 'JOB') {
      markers.push({ markerId: 'priority-1' });
    } else if (node.type === 'CONTACT') {
      markers.push({ markerId: 'people-green' });
    } else if (node.type === 'PROGRAM') {
      markers.push({ markerId: 'task-done' });
    }
    if (markers.length > 0) {
      topic.markers = markers;
    }

    // Add children recursively
    if (childNodes.length > 0) {
      topic.children = {
        attached: childNodes.map(child => buildXMindTopic(child, edges, allNodes)),
      };
    }

    return topic;
  }, []);

  // Export to XMind format (.xmind)
  const exportToXMind = useCallback(async () => {
    if (!exportData) return;

    const { nativeNode, nodes, edges } = exportData;
    const rootTopic = buildXMindTopic(nativeNode, edges, [nativeNode, ...nodes]);
    const sheetId = generateId();
    const timestamp = Date.now();

    // XMind content.json structure
    const contentJson = [
      {
        id: sheetId,
        class: 'sheet',
        title: `BD Mind Map - ${nativeNode.label}`,
        rootTopic: rootTopic,
        theme: {
          id: generateId(),
          importantColors: [
            '#2196F3', // Blue
            '#9C27B0', // Purple
            '#4CAF50', // Green
            '#FF9800', // Orange
            '#F44336', // Red
          ],
        },
      },
    ];

    // Manifest file
    const manifest = {
      'file-entries': {
        'content.json': {},
        'metadata.json': {},
      },
    };

    // Metadata file
    const metadata = {
      creator: {
        name: 'BD Intelligence Dashboard',
        version: '1.0.0',
      },
      created: timestamp,
      modified: timestamp,
    };

    // Create ZIP file with XMind structure
    const zip = new JSZip();
    zip.file('content.json', JSON.stringify(contentJson, null, 2));
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    // Generate the ZIP blob
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.xmind.workbook' });

    // Download the file
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.xmind`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [exportData, buildXMindTopic, fileName]);

  const exportToPNG = useCallback(async () => {
    if (!canvasRef.current) {
      console.error('Canvas ref is not available');
      return;
    }

    try {
      const dataUrl = await toPng(canvasRef.current, {
        quality: 1.0,
        pixelRatio: 2, // High resolution
        backgroundColor: '#111827', // gray-900 background
        style: {
          // Ensure all content is captured
          overflow: 'visible',
        },
        filter: (node: HTMLElement) => {
          // Exclude any elements that shouldn't be in the export
          const excludeClasses = ['context-menu', 'tooltip', 'dropdown'];
          if (node.classList) {
            return !excludeClasses.some(cls => node.classList.contains(cls));
          }
          return true;
        },
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to export PNG:', error);
      throw error;
    }
  }, [canvasRef, fileName]);

  return {
    exportToOPML,
    exportToJSON,
    exportToXMind,
    exportToPNG,
    isExporting: false,
  };
}

// Generate unique ID for XMind elements
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\n/g, '&#10;');
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

function formatNodeNote(node: MindMapNode): string {
  const data = node.data;
  const lines: string[] = [];

  switch (node.type) {
    case 'JOB':
      if (data.location) lines.push(`Location: ${data.location}`);
      if (data.clearance) lines.push(`Clearance: ${data.clearance}`);
      if (data.bd_score) lines.push(`BD Score: ${data.bd_score}`);
      if (data.bd_priority) lines.push(`Priority: ${data.bd_priority}`);
      break;

    case 'PROGRAM':
      if (data.contract_value) lines.push(`Contract Value: $${formatNumber(data.contract_value as number)}`);
      if (data.prime_contractor) lines.push(`Prime: ${data.prime_contractor}`);
      if (data.agency) lines.push(`Agency: ${data.agency}`);
      break;

    case 'CONTACT':
      if (data.title) lines.push(`Title: ${data.title}`);
      if (data.tier) lines.push(`Tier: ${data.tier}`);
      if (data.email) lines.push(`Email: ${data.email}`);
      if (data.phone) lines.push(`Phone: ${data.phone}`);
      if (data.linkedin) lines.push(`LinkedIn: ${data.linkedin}`);
      break;

    case 'PRIME':
      if (data.programs) lines.push(`Programs: ${(data.programs as string[]).length}`);
      if (data.relationship) lines.push(`Relationship: ${data.relationship}`);
      break;

    case 'LOCATION':
      if (data.facility) lines.push(`Facility: ${data.facility}`);
      if (data.job_count) lines.push(`Jobs: ${data.job_count}`);
      if (data.contact_count) lines.push(`Contacts: ${data.contact_count}`);
      break;

    case 'TASK_ORDER':
      if (data.value) lines.push(`Value: $${formatNumber(data.value as number)}`);
      if (data.status) lines.push(`Status: ${data.status}`);
      break;

    case 'TEAM':
      if (data.member_count) lines.push(`Members: ${data.member_count}`);
      if (data.location) lines.push(`Location: ${data.location}`);
      break;

    case 'BD_EVENT':
      if (data.date) lines.push(`Date: ${data.date}`);
      if (data.location) lines.push(`Location: ${data.location}`);
      if (data.attendees) lines.push(`Attendees: ${data.attendees}`);
      break;
  }

  return lines.join('\n');
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

export default useMindMapExport;
