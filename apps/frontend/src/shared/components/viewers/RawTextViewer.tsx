/**
 * Raw Text Viewer Component
 *
 * Displays raw text content with line numbers.
 * Used as a fallback viewer for unknown file types or when parsing fails.
 *
 * Features:
 * - Line numbers with configurable display
 * - Monospace font for code-like display
 * - Consistent styling with Oscura dark theme
 * - Copy to clipboard functionality
 * - Scrollable content with maxHeight option
 * - Word wrap toggle option
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, WrapText } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for the RawTextViewer component.
 */
export interface RawTextViewerProps {
  /** The text content to display */
  content: string;
  /** Optional filename for display context */
  filename?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show line numbers (default: true) */
  showLineNumbers?: boolean;
  /** Whether to show copy button (default: true) */
  showCopyButton?: boolean;
  /** Maximum height before scrolling (CSS value, e.g., '400px') */
  maxHeight?: string;
  /** Whether to wrap long lines (default: false) */
  wrapLines?: boolean;
  /** Whether to show wrap toggle button (default: true) */
  showWrapToggle?: boolean;
  /** Starting line number (default: 1) */
  startingLineNumber?: number;
  /** Optional highlight line numbers */
  highlightLines?: number[];
}

/**
 * Splits content into lines, preserving empty lines.
 */
function splitLines(content: string): string[] {
  if (!content) return [''];
  return content.split('\n');
}

/**
 * Calculates the width needed for line numbers based on the total line count.
 */
function getLineNumberWidth(totalLines: number): string {
  const digits = Math.max(2, String(totalLines).length);
  return `${digits + 1}ch`;
}

/**
 * Raw Text Viewer component for displaying text with line numbers.
 *
 * @example Basic usage
 * ```tsx
 * <RawTextViewer content={textContent} />
 * ```
 *
 * @example With filename and max height
 * ```tsx
 * <RawTextViewer
 *   content={textContent}
 *   filename="output.log"
 *   maxHeight="400px"
 * />
 * ```
 *
 * @example With highlighted lines
 * ```tsx
 * <RawTextViewer
 *   content={textContent}
 *   highlightLines={[5, 10, 15]}
 * />
 * ```
 */
export function RawTextViewer({
  content,
  filename,
  className,
  showLineNumbers = true,
  showCopyButton = true,
  maxHeight,
  wrapLines: initialWrapLines = false,
  showWrapToggle = true,
  startingLineNumber = 1,
  highlightLines = [],
}: RawTextViewerProps) {
  const { t } = useTranslation(['common']);
  const [copied, setCopied] = React.useState(false);
  const [wrapLines, setWrapLines] = React.useState(initialWrapLines);

  const lines = React.useMemo(() => splitLines(content), [content]);
  const lineNumberWidth = React.useMemo(
    () => getLineNumberWidth(lines.length + startingLineNumber - 1),
    [lines.length, startingLineNumber]
  );

  // Create a set for O(1) lookup of highlighted lines
  const highlightedLineSet = React.useMemo(
    () => new Set(highlightLines),
    [highlightLines]
  );

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

  // Toggle word wrap
  const toggleWrap = React.useCallback(() => {
    setWrapLines((prev) => !prev);
  }, []);

  // Container styles
  const containerStyle: React.CSSProperties = maxHeight
    ? { maxHeight, overflow: 'auto' }
    : {};

  return (
    <div className={cn('relative rounded-lg bg-[#1e1e1e]', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
        {/* Filename display */}
        <div className="text-xs text-muted-foreground truncate">
          {filename || t('common:labels.rawText', 'Raw Text')}
        </div>

        {/* Toolbar buttons */}
        <div className="flex items-center gap-1">
          {showWrapToggle && (
            <button
              type="button"
              onClick={toggleWrap}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
                wrapLines
                  ? 'text-accent bg-accent/20 hover:bg-accent/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              title={
                wrapLines
                  ? t('common:buttons.unwrap', 'Disable word wrap')
                  : t('common:buttons.wrap', 'Enable word wrap')
              }
              aria-label={
                wrapLines
                  ? t('common:buttons.unwrap', 'Disable word wrap')
                  : t('common:buttons.wrap', 'Enable word wrap')
              }
              aria-pressed={wrapLines}
            >
              <WrapText className="h-4 w-4" />
            </button>
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
              aria-label={
                copied ? t('common:labels.success') : t('common:buttons.copy', 'Copy')
              }
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div style={containerStyle} className="overflow-x-auto">
        <div
          className={cn(
            'font-mono text-sm leading-relaxed',
            wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre'
          )}
        >
          {lines.map((line, index) => {
            const lineNumber = startingLineNumber + index;
            const isHighlighted = highlightedLineSet.has(lineNumber);

            return (
              <div
                key={index}
                className={cn(
                  'flex',
                  isHighlighted && 'bg-accent/20'
                )}
              >
                {/* Line number */}
                {showLineNumbers && (
                  <span
                    className={cn(
                      'flex-shrink-0 select-none text-right pr-4 pl-3 py-px',
                      isHighlighted
                        ? 'text-accent/80'
                        : 'text-muted-foreground/40'
                    )}
                    style={{ minWidth: lineNumberWidth }}
                    aria-hidden="true"
                  >
                    {lineNumber}
                  </span>
                )}

                {/* Line content */}
                <span
                  className={cn(
                    'flex-1 py-px pr-4',
                    !showLineNumbers && 'pl-3',
                    'text-foreground/90'
                  )}
                >
                  {line || '\u00A0'} {/* Non-breaking space for empty lines */}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to split content into lines for external use.
 *
 * @example
 * ```tsx
 * const { lines, lineCount } = useTextLines(content);
 * ```
 */
export function useTextLines(content: string) {
  const lines = React.useMemo(() => splitLines(content), [content]);

  return {
    lines,
    lineCount: lines.length,
    isEmpty: lines.length === 1 && lines[0] === '',
  };
}

export default RawTextViewer;
