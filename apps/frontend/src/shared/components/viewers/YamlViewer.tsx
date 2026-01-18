/**
 * YAML Viewer Component
 *
 * Displays YAML content with syntax highlighting using react-syntax-highlighter.
 * Parses YAML for validation and displays errors with location information.
 * Falls back to raw content display when parsing fails.
 *
 * Features:
 * - Syntax highlighting with PrismLight (smaller bundle)
 * - vscDarkPlus theme for Oscura dark theme compatibility
 * - Error display with line/column information
 * - Raw content fallback on parse errors
 * - Copy to clipboard functionality
 * - Line numbers
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import yamlLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { AlertCircle, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseYaml, formatYamlError, type YamlParseResult } from '../../parsers/yaml';

// Register YAML language for syntax highlighting
SyntaxHighlighter.registerLanguage('yaml', yamlLanguage);

/**
 * Props for the YamlViewer component.
 */
export interface YamlViewerProps {
  /** The YAML content to display */
  content: string;
  /** Optional filename for error context */
  filename?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show line numbers (default: true) */
  showLineNumbers?: boolean;
  /** Whether to show copy button (default: true) */
  showCopyButton?: boolean;
  /** Maximum height before scrolling (CSS value, e.g., '400px') */
  maxHeight?: string;
  /** Callback when parsing completes (success or failure) */
  onParseComplete?: (result: YamlParseResult) => void;
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
 * YAML Viewer component with syntax highlighting and error handling.
 *
 * @example Basic usage
 * ```tsx
 * <YamlViewer content={yamlContent} />
 * ```
 *
 * @example With error callback
 * ```tsx
 * <YamlViewer
 *   content={yamlContent}
 *   filename="config.yaml"
 *   onParseComplete={(result) => {
 *     if (!result.success) {
 *       console.error('Parse error:', result.error);
 *     }
 *   }}
 * />
 * ```
 */
export function YamlViewer({
  content,
  filename,
  className,
  showLineNumbers = true,
  showCopyButton = true,
  maxHeight,
  onParseComplete,
}: YamlViewerProps) {
  const { t } = useTranslation(['common', 'errors']);
  const [copied, setCopied] = React.useState(false);
  const [parseResult, setParseResult] = React.useState<YamlParseResult | null>(null);

  // Parse YAML content on mount and when content changes
  React.useEffect(() => {
    const result = parseYaml(content, { filename });
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
      console.warn('Failed to copy to clipboard');
    }
  }, [content]);

  // Container styles
  const containerStyle: React.CSSProperties = maxHeight
    ? { maxHeight, overflow: 'auto' }
    : {};

  return (
    <div className={cn('relative rounded-lg bg-[#1e1e1e]', className)}>
      {/* Copy button */}
      {showCopyButton && (
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'absolute right-2 top-2 z-10 p-1.5 rounded-md transition-colors',
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

      {/* Error banner */}
      {parseResult && !parseResult.success && (
        <div
          className={cn(
            'flex items-start gap-2 px-4 py-3 rounded-t-lg',
            'bg-destructive/10 border-b border-destructive/20',
            'text-destructive text-sm'
          )}
          role="alert"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t('errors:parseError', 'Parse Error')}</p>
            <p className="text-xs opacity-90 mt-0.5 break-words">
              {formatYamlError(parseResult)}
            </p>
          </div>
        </div>
      )}

      {/* YAML content with syntax highlighting */}
      <div style={containerStyle} className="overflow-x-auto">
        <SyntaxHighlighter
          language="yaml"
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
      </div>
    </div>
  );
}

/**
 * Hook to parse YAML content and get the result.
 * Useful when you need to access parsed data or error info separately.
 *
 * @example
 * ```tsx
 * const { result, isValid, error } = useYamlParser(content);
 * if (isValid) {
 *   console.log('Parsed data:', result.data);
 * }
 * ```
 */
export function useYamlParser<T = unknown>(content: string, filename?: string) {
  const [result, setResult] = React.useState<YamlParseResult<T> | null>(null);

  React.useEffect(() => {
    const parseResult = parseYaml<T>(content, { filename });
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

export default YamlViewer;
