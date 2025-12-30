import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  FileJson,
  Loader2,
  AlertCircle,
  FolderOpen,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import type { Task } from '../../../shared/types';
import type { FileNode } from '../../../shared/types/project';

interface TaskFilesProps {
  task: Task;
}

// File extensions to display
const ALLOWED_EXTENSIONS = ['.md', '.json'];

// Get icon for file type
function getFileIcon(filename: string) {
  if (filename.endsWith('.json')) {
    return <FileJson className="h-4 w-4 text-amber-500" />;
  }
  return <FileText className="h-4 w-4 text-blue-500" />;
}

export function TaskFiles({ task }: TaskFilesProps) {
  const { t } = useTranslation(['tasks']);

  // State for file listing
  const [files, setFiles] = useState<FileNode[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  // State for file content
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Load files from spec directory
  const loadFiles = useCallback(async () => {
    if (!task.specsPath) return;

    setIsLoadingFiles(true);
    setFilesError(null);

    try {
      const result = await window.electronAPI.listDirectory(task.specsPath);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load directory');
      }

      // Filter to only show allowed file types
      const filteredFiles = result.data.filter(
        (file) => !file.isDirectory && ALLOWED_EXTENSIONS.some(ext => file.name.endsWith(ext))
      );

      // Sort files: spec.md first, then alphabetically
      filteredFiles.sort((a, b) => {
        if (a.name === 'spec.md') return -1;
        if (b.name === 'spec.md') return 1;
        return a.name.localeCompare(b.name);
      });

      setFiles(filteredFiles);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingFiles(false);
    }
  }, [task.specsPath]);

  // Load file content
  const loadFileContent = useCallback(async (filePath: string) => {
    setSelectedFile(filePath);
    setIsLoadingContent(true);
    setContentError(null);
    setFileContent(null);

    try {
      const result = await window.electronAPI.readFile(filePath);
      if (!result.success || result.data === undefined) {
        throw new Error(result.error || 'Failed to read file');
      }
      setFileContent(result.data);
    } catch (err) {
      setContentError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  // Load files on mount and when specsPath changes
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Handle no specsPath
  if (!task.specsPath) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center py-12">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {t('tasks:files.noSpecPath')}
          </p>
        </div>
      </div>
    );
  }

  // Render file content based on type
  const renderContent = () => {
    if (!selectedFile) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('tasks:files.selectFile')}</p>
          </div>
        </div>
      );
    }

    if (isLoadingContent) {
      return (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (contentError) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm text-destructive mb-2">{t('tasks:files.errorLoadingContent')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadFileContent(selectedFile)}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('tasks:files.retry')}
            </Button>
          </div>
        </div>
      );
    }

    if (fileContent === null) return null;

    // Render JSON with formatting
    if (selectedFile.endsWith('.json')) {
      try {
        const formatted = JSON.stringify(JSON.parse(fileContent), null, 2);
        return (
          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words p-4">
            {formatted}
          </pre>
        );
      } catch {
        // If JSON parsing fails, show raw content
        return (
          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words p-4">
            {fileContent}
          </pre>
        );
      }
    }

    // Render markdown/text files
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none p-4">
        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words bg-transparent border-0 p-0">
          {fileContent}
        </pre>
      </div>
    );
  };

  return (
    <div className="h-full flex">
      {/* File list sidebar */}
      <div className="w-48 border-r border-border flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filesError ? (
              <div className="text-center py-4">
                <AlertCircle className="h-5 w-5 mx-auto mb-2 text-destructive" />
                <p className="text-xs text-destructive mb-2">{t('tasks:files.errorLoading')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadFiles}
                  className="text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {t('tasks:files.retry')}
                </Button>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">{t('tasks:files.noFiles')}</p>
              </div>
            ) : (
              files.map((file) => (
                <button
                  key={file.path}
                  onClick={() => loadFileContent(file.path)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
                    'hover:bg-secondary/50',
                    selectedFile === file.path && 'bg-secondary'
                  )}
                >
                  {getFileIcon(file.name)}
                  <span className="text-xs font-medium truncate flex-1">
                    {file.name}
                  </span>
                  {selectedFile === file.path && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* File content area */}
      <div className="flex-1 min-w-0">
        <ScrollArea className="h-full">
          {renderContent()}
        </ScrollArea>
      </div>
    </div>
  );
}
