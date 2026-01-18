/**
 * JSON Viewer Component
 *
 * Displays JSON content with syntax highlighting and collapsible tree structure.
 * Parses JSON for validation and displays errors with location information.
 * Falls back to raw content display when parsing fails.
 *
 * Features:
 * - Syntax highlighting with PrismLight (smaller bundle)
 * - vscDarkPlus theme for Oscura dark theme compatibility
 * - Collapsible tree view for nested objects/arrays
 * - Status color-coding for status fields (pending, in_progress, completed)
 * - Error display with line/column information
 * - Raw content fallback on parse errors
 * - Copy to clipboard functionality
 * - Line numbers
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import jsonLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import { AlertCircle, Copy, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseJson, formatJsonError, type JsonParseResult } from '../../parsers/json';

// Register JSON language for syntax highlighting
SyntaxHighlighter.registerLanguage('json', jsonLanguage);

/**
 * View mode for displaying JSON content.
 */
export type JsonViewMode = 'tree' | 'raw';

/**
 * Props for the JsonViewer component.
 */
export interface JsonViewerProps {
  /** The JSON content to display */
  content: string;
  /** Optional filename for error context */
  filename?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show line numbers in raw mode (default: true) */
  showLineNumbers?: boolean;
  /** Whether to show copy button (default: true) */
  showCopyButton?: boolean;
  /** Maximum height before scrolling (CSS value, e.g., '400px') */
  maxHeight?: string;
  /** Initial view mode (default: 'tree') */
  defaultViewMode?: JsonViewMode;
  /** Whether to allow switching between tree and raw view (default: true) */
  allowViewModeSwitch?: boolean;
  /** Initial expansion depth for tree view (default: 2) */
  defaultExpandDepth?: number;
  /** Callback when parsing completes (success or failure) */
  onParseComplete?: (result: JsonParseResult) => void;
}

/**
 * Custom styles to match Oscura theme
 */
const customStyle: React.CSSProperties = {
  margin: 0,
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
  lineHeight: '1.5',
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
};

/**
 * Status colors for status fields
 */
const STATUS_COLORS: Record<string, string> = {
  pending: 'text-muted-foreground',
  in_progress: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-destructive',
  blocked: 'text-warning',
  skipped: 'text-muted-foreground opacity-60',
};

/**
 * Props for the TreeNode component
 */
interface TreeNodeProps {
  keyName: string | null;
  value: unknown;
  depth: number;
  defaultExpandDepth: number;
  isLast: boolean;
}

/**
 * Renders a single node in the JSON tree
 */
function TreeNode({ keyName, value, depth, defaultExpandDepth, isLast }: TreeNodeProps) {
  const isExpanded = depth < defaultExpandDepth;
  const [expanded, setExpanded] = React.useState(isExpanded);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const isStatus = keyName === 'status' && typeof value === 'string';
  const isEmpty = isObject && Object.keys(value as object).length === 0;

  const toggleExpand = () => setExpanded(!expanded);

  const renderValue = () => {
    if (value === null) {
      return <span className="text-muted-foreground italic">null</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="text-blue-400">{value.toString()}</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-[#b5cea8]">{value}</span>;
    }

    if (typeof value === 'string') {
      // Special handling for status fields
      if (isStatus) {
        const statusColor = STATUS_COLORS[value] || 'text-foreground';
        return <span className={cn('font-medium', statusColor)}>"{value}"</span>;
      }
      return <span className="text-[#ce9178]">"{value}"</span>;
    }

    if (isEmpty) {
      return <span className="text-muted-foreground">{isArray ? '[]' : '{}'}</span>;
    }

    return null;
  };

  const indent = depth * 16;

  // Render primitive value
  if (!isObject || isEmpty) {
    return (
      <div
        className="flex items-start py-0.5 hover:bg-muted/30 rounded transition-colors"
        style={{ paddingLeft: indent + 20 }}
      >
        {keyName !== null && (
          <>
            <span className="text-[#9cdcfe]">"{keyName}"</span>
            <span className="text-muted-foreground mx-1">:</span>
          </>
        )}
        {renderValue()}
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    );
  }

  // Render object/array
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [i.toString(), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);

  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : '}';

  return (
    <div>
      <div
        className="flex items-start py-0.5 hover:bg-muted/30 rounded cursor-pointer transition-colors"
        style={{ paddingLeft: indent }}
        onClick={toggleExpand}
        onKeyDown={(e) => e.key === 'Enter' && toggleExpand()}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
      >
        <span className="w-5 flex-shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        {keyName !== null && (
          <>
            <span className="text-[#9cdcfe]">"{keyName}"</span>
            <span className="text-muted-foreground mx-1">:</span>
          </>
        )}
        <span className="text-muted-foreground">{bracketOpen}</span>
        {!expanded && (
          <>
            <span className="text-muted-foreground mx-1">
              {entries.length} {entries.length === 1 ? 'item' : 'items'}
            </span>
            <span className="text-muted-foreground">{bracketClose}</span>
            {!isLast && <span className="text-muted-foreground">,</span>}
          </>
        )}
      </div>
      {expanded && (
        <>
          {entries.map(([key, val], index) => (
            <TreeNode
              key={key}
              keyName={isArray ? null : key}
              value={val}
              depth={depth + 1}
              defaultExpandDepth={defaultExpandDepth}
              isLast={index === entries.length - 1}
            />
          ))}
          <div
            className="py-0.5"
            style={{ paddingLeft: indent + 20 }}
          >
            <span className="text-muted-foreground">{bracketClose}</span>
            {!isLast && <span className="text-muted-foreground">,</span>}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * JSON Viewer component with syntax highlighting, tree view, and error handling.
 *
 * @example Basic usage
 * ```tsx
 * <JsonViewer content={jsonContent} />
 * ```
 *
 * @example With tree view and custom expansion depth
 * ```tsx
 * <JsonViewer
 *   content={jsonContent}
 *   defaultViewMode="tree"
 *   defaultExpandDepth={3}
 * />
 * ```
 *
 * @example With error callback
 * ```tsx
 * <JsonViewer
 *   content={jsonContent}
 *   filename="config.json"
 *   onParseComplete={(result) => {
 *     if (!result.success) {
 *       console.error('Parse error:', result.error);
 *     }
 *   }}
 * />
 * ```
 */
export function JsonViewer({
  content,
  filename,
  className,
  showLineNumbers = true,
  showCopyButton = true,
  maxHeight,
  defaultViewMode = 'tree',
  allowViewModeSwitch = true,
  defaultExpandDepth = 2,
  onParseComplete,
}: JsonViewerProps) {
  const { t } = useTranslation(['common', 'errors']);
  const [copied, setCopied] = React.useState(false);
  const [parseResult, setParseResult] = React.useState<JsonParseResult | null>(null);
  const [viewMode, setViewMode] = React.useState<JsonViewMode>(defaultViewMode);

  // Parse JSON content on mount and when content changes
  React.useEffect(() => {
    const result = parseJson(content, { filename });
    setParseResult(result);
    onParseComplete?.(result);
  }, [content, filename, onParseComplete]);

  // Handle copy to clipboard
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some contexts
    }
  }, [content]);

  // Container styles
  const containerStyle: React.CSSProperties = maxHeight
    ? { maxHeight, overflow: 'auto' }
    : {};

  // If parse failed, show error and fall back to raw view
  const canShowTree = parseResult?.success && parseResult.data !== undefined;

  return (
    <div className={cn('relative rounded-lg bg-[#1e1e1e]', className)}>
      {/* Toolbar: View mode toggle and copy button */}
      <div className="flex items-center justify-end gap-2 px-2 py-1.5 border-b border-border/50">
        {allowViewModeSwitch && canShowTree && (
          <div className="flex rounded-md bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={cn(
                'px-2 py-0.5 text-xs rounded transition-colors',
                viewMode === 'tree'
                  ? 'bg-accent/30 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('common:labels.tree', 'Tree')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={cn(
                'px-2 py-0.5 text-xs rounded transition-colors',
                viewMode === 'raw'
                  ? 'bg-accent/30 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('common:labels.raw', 'Raw')}
            </button>
          </div>
        )}
        {showCopyButton && (
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background'
            )}
            title={copied ? t('common:labels.success') : t('common:buttons.copy', 'Copy')}
            aria-label={copied ? t('common:labels.success') : t('common:buttons.copy', 'Copy')}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Error banner */}
      {parseResult && !parseResult.success && (
        <div
          className={cn(
            'flex items-start gap-2 px-4 py-3',
            'bg-destructive/10 border-b border-destructive/20',
            'text-destructive text-sm'
          )}
          role="alert"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t('errors:parseError', 'Parse Error')}</p>
            <p className="text-xs opacity-90 mt-0.5 break-words">
              {formatJsonError(parseResult)}
            </p>
          </div>
        </div>
      )}

      {/* Content area */}
      <div style={containerStyle} className="overflow-x-auto">
        {canShowTree && viewMode === 'tree' ? (
          <div
            className="p-3 font-mono text-sm leading-relaxed"
            role="tree"
            aria-label={t('common:labels.jsonTree', 'JSON Tree')}
          >
            <TreeNode
              keyName={null}
              value={parseResult.data}
              depth={0}
              defaultExpandDepth={defaultExpandDepth}
              isLast={true}
            />
          </div>
        ) : (
          <SyntaxHighlighter
            language="json"
            style={vscDarkPlus}
            showLineNumbers={showLineNumbers}
            customStyle={customStyle}
            lineNumberStyle={{
              minWidth: '2.5em',
              paddingRight: '1em',
              color: 'rgba(255, 255, 255, 0.3)',
              textAlign: 'right',
              userSelect: 'none',
            }}
            wrapLongLines={false}
            PreTag="div"
          >
            {content || ''}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to parse JSON content and get the result.
 * Useful when you need to access parsed data or error info separately.
 *
 * @example
 * ```tsx
 * const { result, isValid, error } = useJsonParser(content);
 * if (isValid) {
 *   console.log('Parsed data:', result.data);
 * }
 * ```
 */
export function useJsonParser<T = unknown>(content: string, filename?: string) {
  const [result, setResult] = React.useState<JsonParseResult<T> | null>(null);

  React.useEffect(() => {
    const parseResult = parseJson<T>(content, { filename });
    setResult(parseResult);
  }, [content, filename]);

  return {
    result,
    isValid: result?.success ?? false,
    data: result?.data,
    error: result?.error,
    errorLocation: result?.errorLocation,
    rawContent: result?.rawContent ?? content,
  };
}

export default JsonViewer;
