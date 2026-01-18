/**
 * Markdown Viewer Component
 *
 * Displays Markdown content with syntax highlighting for code blocks and
 * optional table of contents navigation. Uses react-markdown with remark-gfm
 * for GitHub Flavored Markdown support.
 *
 * Features:
 * - react-markdown for rendering
 * - Syntax highlighting with PrismLight (smaller bundle)
 * - vscDarkPlus theme for Oscura dark theme compatibility
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - Table of contents (TOC) with collapsible navigation
 * - Copy to clipboard functionality
 * - Heading anchor links
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Register commonly used languages for code blocks
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import yamlLang from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import jsonLang from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';

import { Copy, Check, List, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateToc, type TocEntry } from '../../parsers/markdown';

// Register languages for syntax highlighting
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('yaml', yamlLang);
SyntaxHighlighter.registerLanguage('yml', yamlLang);
SyntaxHighlighter.registerLanguage('json', jsonLang);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);

/**
 * Props for the MarkdownViewer component.
 */
export interface MarkdownViewerProps {
  /** The Markdown content to display */
  content: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the table of contents (default: true) */
  showToc?: boolean;
  /** Whether to show copy button (default: true) */
  showCopyButton?: boolean;
  /** Maximum height before scrolling (CSS value, e.g., '400px') */
  maxHeight?: string;
  /** Whether to enable heading anchor links (default: true) */
  showHeadingLinks?: boolean;
  /** Minimum heading level for TOC (default: 1) */
  tocMinLevel?: number;
  /** Maximum heading level for TOC (default: 3) */
  tocMaxLevel?: number;
  /** Callback when TOC is generated */
  onTocGenerated?: (toc: TocEntry[]) => void;
}

/**
 * Custom styles for code blocks to match Oscura theme
 */
const codeBlockStyle: React.CSSProperties = {
  margin: 0,
  borderRadius: '0.375rem',
  fontSize: '0.875rem',
  lineHeight: '1.5',
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
};

/**
 * TOC Item component for rendering nested TOC entries
 */
interface TocItemProps {
  entry: TocEntry;
  depth: number;
  onNavigate: (slug: string) => void;
}

function TocItem({ entry, depth, onNavigate }: TocItemProps) {
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = entry.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(entry.slug);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <li className="list-none">
      <div
        className={cn(
          'flex items-center gap-1 py-0.5 rounded transition-colors',
          'hover:bg-muted/30'
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        {hasChildren && (
          <button
            type="button"
            onClick={toggleExpand}
            className="p-0.5 text-muted-foreground hover:text-foreground"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
        {!hasChildren && <span className="w-4" />}
        <a
          href={`#${entry.slug}`}
          onClick={handleClick}
          className={cn(
            'text-sm text-muted-foreground hover:text-foreground',
            'truncate flex-1 transition-colors'
          )}
          title={entry.text}
        >
          {entry.text}
        </a>
      </div>
      {hasChildren && expanded && (
        <ul className="m-0 p-0">
          {entry.children.map((child) => (
            <TocItem
              key={child.slug}
              entry={child}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Table of Contents component
 */
interface TableOfContentsProps {
  toc: TocEntry[];
  onNavigate: (slug: string) => void;
  className?: string;
}

function TableOfContents({ toc, onNavigate, className }: TableOfContentsProps) {
  const { t } = useTranslation(['common']);
  const [collapsed, setCollapsed] = React.useState(false);

  if (toc.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn(
        'border-r border-border/50 bg-background/50',
        'overflow-hidden transition-all',
        className
      )}
      aria-label="Table of contents"
    >
      <div className="p-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center gap-2 w-full text-left',
            'text-sm font-medium text-muted-foreground hover:text-foreground',
            'transition-colors'
          )}
        >
          <List className="h-4 w-4" />
          <span>{t('common:labels.tableOfContents', 'Contents')}</span>
          {collapsed ? (
            <ChevronRight className="h-4 w-4 ml-auto" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-auto" />
          )}
        </button>
        {!collapsed && (
          <ul className="mt-2 m-0 p-0 max-h-[60vh] overflow-y-auto">
            {toc.map((entry) => (
              <TocItem
                key={entry.slug}
                entry={entry}
                depth={0}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}

/**
 * Markdown Viewer component with syntax highlighting, TOC, and copy functionality.
 *
 * @example Basic usage
 * ```tsx
 * <MarkdownViewer content={markdownContent} />
 * ```
 *
 * @example With TOC disabled
 * ```tsx
 * <MarkdownViewer content={markdownContent} showToc={false} />
 * ```
 *
 * @example With custom TOC levels
 * ```tsx
 * <MarkdownViewer
 *   content={markdownContent}
 *   tocMinLevel={2}
 *   tocMaxLevel={4}
 * />
 * ```
 */
export function MarkdownViewer({
  content,
  className,
  showToc = true,
  showCopyButton = true,
  maxHeight,
  showHeadingLinks = true,
  tocMinLevel = 1,
  tocMaxLevel = 3,
  onTocGenerated,
}: MarkdownViewerProps) {
  const { t } = useTranslation(['common']);
  const [copied, setCopied] = React.useState(false);
  const [toc, setToc] = React.useState<TocEntry[]>([]);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Generate TOC when content changes
  React.useEffect(() => {
    const generatedToc = generateToc(content, {
      minLevel: tocMinLevel,
      maxLevel: tocMaxLevel,
    });
    setToc(generatedToc);
    onTocGenerated?.(generatedToc);
  }, [content, tocMinLevel, tocMaxLevel, onTocGenerated]);

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

  // Handle TOC navigation
  const handleNavigate = React.useCallback((slug: string) => {
    const element = document.getElementById(slug);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Container styles
  const containerStyle: React.CSSProperties = maxHeight
    ? { maxHeight, overflow: 'auto' }
    : {};

  const hasToc = showToc && toc.length > 0;

  return (
    <div className={cn('relative rounded-lg bg-[#1e1e1e] overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2 px-2 py-1.5 border-b border-border/50">
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

      {/* Main content area with optional TOC */}
      <div className={cn('flex', hasToc && 'divide-x divide-border/50')}>
        {/* TOC sidebar */}
        {hasToc && (
          <TableOfContents
            toc={toc}
            onNavigate={handleNavigate}
            className="w-56 flex-shrink-0"
          />
        )}

        {/* Markdown content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-x-auto"
          style={containerStyle}
        >
          <article
            className={cn(
              'prose prose-invert prose-sm max-w-none p-4',
              // Prose customizations for Oscura theme
              'prose-headings:text-foreground prose-headings:font-semibold',
              'prose-p:text-muted-foreground prose-p:leading-relaxed',
              'prose-a:text-accent prose-a:no-underline hover:prose-a:underline',
              'prose-strong:text-foreground prose-strong:font-semibold',
              'prose-code:text-accent prose-code:bg-muted/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
              'prose-code:before:content-none prose-code:after:content-none',
              'prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0',
              'prose-blockquote:border-l-accent prose-blockquote:text-muted-foreground',
              'prose-ul:text-muted-foreground prose-ol:text-muted-foreground',
              'prose-li:text-muted-foreground prose-li:marker:text-muted-foreground',
              'prose-hr:border-border/50',
              'prose-table:text-muted-foreground',
              'prose-th:text-foreground prose-th:font-medium',
              'prose-td:text-muted-foreground'
            )}
          >
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom heading rendering with anchor links
                h1: ({ children, ...props }) => (
                  <HeadingWithAnchor level={1} showLink={showHeadingLinks} {...props}>
                    {children}
                  </HeadingWithAnchor>
                ),
                h2: ({ children, ...props }) => (
                  <HeadingWithAnchor level={2} showLink={showHeadingLinks} {...props}>
                    {children}
                  </HeadingWithAnchor>
                ),
                h3: ({ children, ...props }) => (
                  <HeadingWithAnchor level={3} showLink={showHeadingLinks} {...props}>
                    {children}
                  </HeadingWithAnchor>
                ),
                h4: ({ children, ...props }) => (
                  <HeadingWithAnchor level={4} showLink={showHeadingLinks} {...props}>
                    {children}
                  </HeadingWithAnchor>
                ),
                h5: ({ children, ...props }) => (
                  <HeadingWithAnchor level={5} showLink={showHeadingLinks} {...props}>
                    {children}
                  </HeadingWithAnchor>
                ),
                h6: ({ children, ...props }) => (
                  <HeadingWithAnchor level={6} showLink={showHeadingLinks} {...props}>
                    {children}
                  </HeadingWithAnchor>
                ),
                // Custom code block rendering with syntax highlighting
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';
                  const codeString = String(children).replace(/\n$/, '');

                  // Check if this is an inline code block
                  const isInline = !className && !codeString.includes('\n');

                  if (isInline) {
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }

                  return (
                    <div className="relative group my-4">
                      {language && (
                        <div className="absolute top-0 right-0 px-2 py-1 text-xs text-muted-foreground bg-muted/30 rounded-bl-md rounded-tr-md">
                          {language}
                        </div>
                      )}
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={language || 'text'}
                        customStyle={codeBlockStyle}
                        showLineNumbers={codeString.split('\n').length > 3}
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
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  );
                },
                // Custom link rendering to open external links in new tab
                a({ href, children, ...props }) {
                  const isExternal = href?.startsWith('http');
                  return (
                    <a
                      href={href}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      {...props}
                    >
                      {children}
                    </a>
                  );
                },
                // Custom table rendering for better styling
                table({ children, ...props }) {
                  return (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full border-collapse" {...props}>
                        {children}
                      </table>
                    </div>
                  );
                },
                th({ children, ...props }) {
                  return (
                    <th
                      className="border border-border/50 px-4 py-2 text-left bg-muted/30"
                      {...props}
                    >
                      {children}
                    </th>
                  );
                },
                td({ children, ...props }) {
                  return (
                    <td className="border border-border/50 px-4 py-2" {...props}>
                      {children}
                    </td>
                  );
                },
              }}
            >
              {content || ''}
            </Markdown>
          </article>
        </div>
      </div>
    </div>
  );
}

/**
 * Heading component with anchor link support
 */
interface HeadingWithAnchorProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  showLink: boolean;
  children: React.ReactNode;
}

function HeadingWithAnchor({ level, showLink, children, ...props }: HeadingWithAnchorProps) {
  // Generate slug from children text content
  const text = React.Children.toArray(children)
    .map((child) => (typeof child === 'string' ? child : ''))
    .join('');

  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const Tag = `h${level}` as const;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = `${window.location.href.split('#')[0]}#${slug}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <Tag id={slug} className="group relative scroll-mt-4" {...props}>
      {children}
      {showLink && (
        <a
          href={`#${slug}`}
          onClick={handleCopyLink}
          className={cn(
            'absolute -left-5 top-1/2 -translate-y-1/2',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'text-muted-foreground hover:text-foreground'
          )}
          aria-label={`Link to ${text}`}
          title="Copy link to heading"
        >
          <Link2 className="h-4 w-4" />
        </a>
      )}
    </Tag>
  );
}

/**
 * Hook to parse Markdown content and get TOC information.
 * Useful when you need to access TOC separately from the viewer.
 *
 * @example
 * ```tsx
 * const { toc, headings } = useMarkdownToc(content);
 * ```
 */
export function useMarkdownToc(content: string, options?: { minLevel?: number; maxLevel?: number }) {
  const { minLevel = 1, maxLevel = 6 } = options || {};

  const [toc, setToc] = React.useState<TocEntry[]>([]);

  React.useEffect(() => {
    const generatedToc = generateToc(content, { minLevel, maxLevel });
    setToc(generatedToc);
  }, [content, minLevel, maxLevel]);

  return {
    toc,
    hasContent: toc.length > 0,
  };
}

export default MarkdownViewer;
