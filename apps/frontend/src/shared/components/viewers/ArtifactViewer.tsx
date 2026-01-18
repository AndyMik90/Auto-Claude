/**
 * Artifact Viewer Component
 *
 * Unified viewer component that automatically detects file types and routes
 * to the appropriate specialized viewer (YAML, JSON, Markdown, or Raw Text).
 *
 * Features:
 * - Automatic file type detection from filename extension
 * - Content-based detection fallback for unknown extensions
 * - Manual type override option
 * - Consistent styling across all viewer types
 * - Loading state support
 * - Error boundary for viewer failures
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, FileText, FileJson, FileCode, FileType } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  detectFileType,
  getFileTypeDisplayName,
  type ArtifactFileType,
} from '../../utils/file-type';
import { YamlViewer, type YamlViewerProps } from './YamlViewer';
import { JsonViewer, type JsonViewerProps, type JsonViewMode } from './JsonViewer';
import { MarkdownViewer, type MarkdownViewerProps } from './MarkdownViewer';
import { RawTextViewer, type RawTextViewerProps } from './RawTextViewer';

/**
 * Props for the ArtifactViewer component.
 */
export interface ArtifactViewerProps {
  /** The content to display */
  content: string;
  /** Optional filename for type detection and display */
  filename?: string;
  /** Force a specific file type (bypasses auto-detection) */
  forceType?: ArtifactFileType;
  /** Additional CSS classes */
  className?: string;
  /** Maximum height before scrolling (CSS value, e.g., '400px') */
  maxHeight?: string;
  /** Whether to show copy button (default: true) */
  showCopyButton?: boolean;
  /** Whether to show line numbers for applicable viewers (default: true) */
  showLineNumbers?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Error message to display instead of content */
  error?: string;
  /** Callback when type detection completes */
  onTypeDetected?: (type: ArtifactFileType) => void;
  /** YAML-specific props */
  yamlProps?: Partial<Omit<YamlViewerProps, 'content' | 'filename' | 'className' | 'maxHeight' | 'showCopyButton' | 'showLineNumbers'>>;
  /** JSON-specific props */
  jsonProps?: Partial<Omit<JsonViewerProps, 'content' | 'filename' | 'className' | 'maxHeight' | 'showCopyButton' | 'showLineNumbers'>>;
  /** Markdown-specific props */
  markdownProps?: Partial<Omit<MarkdownViewerProps, 'content' | 'className' | 'maxHeight' | 'showCopyButton'>>;
  /** Raw text-specific props */
  rawTextProps?: Partial<Omit<RawTextViewerProps, 'content' | 'filename' | 'className' | 'maxHeight' | 'showCopyButton' | 'showLineNumbers'>>;
}

/**
 * Get the icon for a file type
 */
function getFileTypeIcon(type: ArtifactFileType) {
  switch (type) {
    case 'yaml':
      return FileCode;
    case 'json':
      return FileJson;
    case 'markdown':
      return FileType;
    case 'text':
    default:
      return FileText;
  }
}

/**
 * Loading skeleton component
 */
function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg bg-[#1e1e1e] p-4', className)}>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted/30 rounded w-3/4" />
        <div className="h-4 bg-muted/30 rounded w-1/2" />
        <div className="h-4 bg-muted/30 rounded w-5/6" />
        <div className="h-4 bg-muted/30 rounded w-2/3" />
        <div className="h-4 bg-muted/30 rounded w-1/4" />
      </div>
    </div>
  );
}

/**
 * Error display component
 */
function ErrorDisplay({ error, className }: { error: string; className?: string }) {
  const { t } = useTranslation(['errors', 'common']);

  return (
    <div
      className={cn(
        'rounded-lg bg-[#1e1e1e] p-4',
        'border border-destructive/30',
        className
      )}
    >
      <div className="flex items-start gap-3 text-destructive">
        <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {t('errors:loadError', 'Failed to load content')}
          </p>
          <p className="text-sm opacity-80 mt-1 break-words">{error}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty content display component
 */
function EmptyContent({ filename, className }: { filename?: string; className?: string }) {
  const { t } = useTranslation(['common']);

  return (
    <div
      className={cn(
        'rounded-lg bg-[#1e1e1e] p-8',
        'flex flex-col items-center justify-center text-center',
        className
      )}
    >
      <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">
        {filename
          ? t('common:labels.emptyFile', { filename, defaultValue: `${filename} is empty` })
          : t('common:labels.noContent', 'No content to display')}
      </p>
    </div>
  );
}

/**
 * File type badge component for displaying detected type
 */
export function FileTypeBadge({
  type,
  filename,
  className,
}: {
  type: ArtifactFileType;
  filename?: string;
  className?: string;
}) {
  const Icon = getFileTypeIcon(type);
  const displayName = getFileTypeDisplayName(type);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md',
        'bg-muted/30 text-xs text-muted-foreground',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{displayName}</span>
      {filename && (
        <>
          <span className="text-muted-foreground/50">•</span>
          <span className="truncate max-w-[150px]" title={filename}>
            {filename}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Unified Artifact Viewer component with automatic file type detection.
 *
 * Automatically detects the content type based on filename extension or content
 * analysis, and renders the appropriate specialized viewer.
 *
 * @example Basic usage with filename
 * ```tsx
 * <ArtifactViewer content={fileContent} filename="config.yaml" />
 * ```
 *
 * @example With forced type
 * ```tsx
 * <ArtifactViewer content={jsonContent} forceType="json" />
 * ```
 *
 * @example With custom viewer props
 * ```tsx
 * <ArtifactViewer
 *   content={content}
 *   filename="plan.json"
 *   jsonProps={{ defaultViewMode: 'tree', defaultExpandDepth: 3 }}
 * />
 * ```
 *
 * @example With loading state
 * ```tsx
 * <ArtifactViewer content="" isLoading={true} />
 * ```
 *
 * @example With error display
 * ```tsx
 * <ArtifactViewer content="" error="File not found" />
 * ```
 */
export function ArtifactViewer({
  content,
  filename,
  forceType,
  className,
  maxHeight,
  showCopyButton = true,
  showLineNumbers = true,
  isLoading = false,
  error,
  onTypeDetected,
  yamlProps,
  jsonProps,
  markdownProps,
  rawTextProps,
}: ArtifactViewerProps) {
  // Detect file type
  const detectedType = React.useMemo(() => {
    if (forceType) {
      return forceType;
    }
    return detectFileType(filename, content);
  }, [forceType, filename, content]);

  // Notify parent of detected type
  React.useEffect(() => {
    onTypeDetected?.(detectedType);
  }, [detectedType, onTypeDetected]);

  // Handle loading state
  if (isLoading) {
    return <LoadingSkeleton className={className} />;
  }

  // Handle error state
  if (error) {
    return <ErrorDisplay error={error} className={className} />;
  }

  // Handle empty content
  if (!content || content.trim() === '') {
    return <EmptyContent filename={filename} className={className} />;
  }

  // Render appropriate viewer based on detected type
  switch (detectedType) {
    case 'yaml':
      return (
        <YamlViewer
          content={content}
          filename={filename}
          className={className}
          maxHeight={maxHeight}
          showCopyButton={showCopyButton}
          showLineNumbers={showLineNumbers}
          {...yamlProps}
        />
      );

    case 'json':
      return (
        <JsonViewer
          content={content}
          filename={filename}
          className={className}
          maxHeight={maxHeight}
          showCopyButton={showCopyButton}
          showLineNumbers={showLineNumbers}
          {...jsonProps}
        />
      );

    case 'markdown':
      return (
        <MarkdownViewer
          content={content}
          className={className}
          maxHeight={maxHeight}
          showCopyButton={showCopyButton}
          {...markdownProps}
        />
      );

    case 'text':
    default:
      return (
        <RawTextViewer
          content={content}
          filename={filename}
          className={className}
          maxHeight={maxHeight}
          showCopyButton={showCopyButton}
          showLineNumbers={showLineNumbers}
          {...rawTextProps}
        />
      );
  }
}

/**
 * Hook to detect the file type of content.
 * Useful when you need type information separately from the viewer.
 *
 * @example
 * ```tsx
 * const { type, displayName, icon: Icon } = useArtifactType('config.yaml', content);
 * ```
 */
export function useArtifactType(filename?: string, content?: string, forceType?: ArtifactFileType) {
  const type = React.useMemo(() => {
    if (forceType) {
      return forceType;
    }
    return detectFileType(filename, content);
  }, [forceType, filename, content]);

  return {
    type,
    displayName: getFileTypeDisplayName(type),
    icon: getFileTypeIcon(type),
    isYaml: type === 'yaml',
    isJson: type === 'json',
    isMarkdown: type === 'markdown',
    isText: type === 'text',
  };
}

/**
 * Helper function to get the appropriate viewer component for a file type.
 * Useful for conditional rendering or lazy loading.
 *
 * @example
 * ```tsx
 * const ViewerComponent = getViewerForType('json');
 * // ViewerComponent === JsonViewer
 * ```
 */
export function getViewerForType(type: ArtifactFileType) {
  switch (type) {
    case 'yaml':
      return YamlViewer;
    case 'json':
      return JsonViewer;
    case 'markdown':
      return MarkdownViewer;
    case 'text':
    default:
      return RawTextViewer;
  }
}

// Re-export types for convenience
export type { ArtifactFileType };
export type { JsonViewMode };

export default ArtifactViewer;
