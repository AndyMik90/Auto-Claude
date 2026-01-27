import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';
import { Loader2, Copy, Check, AlertCircle, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import type { PromptContext, PromptInfo } from '../../shared/types';

export interface PromptInspectionModalProps {
  /** The context determines which prompts are shown */
  context: PromptContext;
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * A modal component that displays agent prompts for inspection.
 * Shows a list of context-appropriate prompts with content preview.
 */
export function PromptInspectionModal({
  context,
  open,
  onOpenChange,
}: PromptInspectionModalProps) {
  const { t } = useTranslation('dialogs');
  const { toast } = useToast();

  // State for prompt list
  const [prompts, setPrompts] = useState<PromptInfo[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // State for selected prompt content
  const [selectedPrompt, setSelectedPrompt] = useState<PromptInfo | null>(null);
  const [promptContent, setPromptContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // State for copy button
  const [hasCopied, setHasCopied] = useState(false);

  // Refs for preventing race conditions and cleanup
  const currentRequestRef = useRef<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Load prompt list when modal opens or context changes
  useEffect(() => {
    if (open) {
      // Reset state before loading new list to prevent stale data
      setSelectedPrompt(null);
      setPromptContent('');
      setContentError(null);
      setHasCopied(false);
      loadPromptList();
    } else {
      // Reset state when modal closes
      setSelectedPrompt(null);
      setPromptContent('');
      setContentError(null);
      setHasCopied(false);
    }
  }, [open, context]);

  // Load prompt list from IPC
  const loadPromptList = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);

    try {
      const result = await window.electronAPI.getPromptList(context);
      if (result.success && result.data) {
        setPrompts(result.data);
        // Auto-select first prompt if available
        if (result.data.length > 0) {
          setSelectedPrompt(result.data[0]);
        }
      } else {
        setListError(result.error || t('promptInspection.loadError', { defaultValue: 'Failed to load prompts' }));
      }
    } catch (error) {
      setListError(error instanceof Error ? error.message : t('promptInspection.loadError', { defaultValue: 'Failed to load prompts' }));
    } finally {
      setIsLoadingList(false);
    }
  }, [context, t]);

  // Load prompt content from IPC with race condition protection
  const loadPromptContent = useCallback(async (filename: string) => {
    // Track current request to prevent stale responses from overwriting
    currentRequestRef.current = filename;
    setIsLoadingContent(true);
    setContentError(null);
    setPromptContent('');

    try {
      const result = await window.electronAPI.readPrompt(filename);

      // Only update state if this is still the current request
      if (currentRequestRef.current !== filename) {
        return; // Stale request, ignore response
      }

      if (result.success && result.data) {
        setPromptContent(result.data);
      } else {
        setContentError(result.error || t('promptInspection.contentError', { defaultValue: 'Failed to load prompt content' }));
      }
    } catch (error) {
      // Only update state if this is still the current request
      if (currentRequestRef.current !== filename) {
        return; // Stale request, ignore response
      }
      setContentError(error instanceof Error ? error.message : t('promptInspection.contentError', { defaultValue: 'Failed to load prompt content' }));
    } finally {
      // Only update loading state if this is still the current request
      if (currentRequestRef.current === filename) {
        setIsLoadingContent(false);
      }
    }
  }, [t]);

  // Load prompt content when selected prompt changes
  useEffect(() => {
    if (selectedPrompt) {
      loadPromptContent(selectedPrompt.filename);
    }
  }, [selectedPrompt, loadPromptContent]);

  // Copy prompt content to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    if (!promptContent) return;

    try {
      await navigator.clipboard.writeText(promptContent);
      setHasCopied(true);
      toast({
        title: t('promptInspection.copied', { defaultValue: 'Copied!' }),
        description: t('promptInspection.copiedDescription', { defaultValue: 'Prompt content copied to clipboard' }),
        duration: 2000,
      });

      // Clear any existing timeout
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      // Reset copy state after 2 seconds
      copyTimeoutRef.current = setTimeout(() => {
        setHasCopied(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      toast({
        title: t('promptInspection.copyError', { defaultValue: 'Copy failed' }),
        description: error instanceof Error ? error.message : t('promptInspection.copyErrorDescription', { defaultValue: 'Failed to copy to clipboard' }),
        variant: 'destructive',
        duration: 3000,
      });
    }
  }, [promptContent, toast, t]);

  // Get context-specific title
  const getContextTitle = () => {
    if (context === 'roadmap') {
      return t('promptInspection.titleRoadmap', { defaultValue: 'Roadmap Agent Prompts' });
    }
    return t('promptInspection.titleKanban', { defaultValue: 'Task Pipeline Agent Prompts' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {getContextTitle()}
          </DialogTitle>
          <DialogDescription>
            {t('promptInspection.description', { defaultValue: 'View the prompts used by agents in this context' })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Prompt List Sidebar */}
          <div className="w-64 border-r border-border flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t('promptInspection.selectPrompt', { defaultValue: 'Select a prompt' })}
              </h3>
            </div>
            <ScrollArea className="flex-1">
              {isLoadingList ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : listError ? (
                <div className="p-4 text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p className="text-sm text-destructive">{listError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={loadPromptList}
                  >
                    {t('promptInspection.retry', { defaultValue: 'Retry' })}
                  </Button>
                </div>
              ) : prompts.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  {t('promptInspection.noPrompts', { defaultValue: 'No prompts available' })}
                </div>
              ) : (
                <div className="p-2">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt.filename}
                      onClick={() => setSelectedPrompt(prompt)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg transition-colors',
                        'hover:bg-accent',
                        selectedPrompt?.filename === prompt.filename
                          ? 'bg-accent border border-border'
                          : 'border border-transparent'
                      )}
                    >
                      <div className="font-medium text-sm">{prompt.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {prompt.description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Prompt Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Content Header with Copy Button */}
            {selectedPrompt && (
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">{selectedPrompt.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedPrompt.filename}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyToClipboard}
                  disabled={!promptContent || isLoadingContent}
                >
                  {hasCopied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      {t('promptInspection.copied', { defaultValue: 'Copied!' })}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      {t('promptInspection.copyToClipboard', { defaultValue: 'Copy' })}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Content Display */}
            <ScrollArea className="flex-1 p-4">
              {!selectedPrompt ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">{t('promptInspection.selectPromptHint', { defaultValue: 'Select a prompt to view its content' })}</p>
                  </div>
                </div>
              ) : isLoadingContent ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : contentError ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                    <p className="text-sm text-destructive mb-3">{contentError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadPromptContent(selectedPrompt.filename)}
                    >
                      {t('promptInspection.retry', { defaultValue: 'Retry' })}
                    </Button>
                  </div>
                </div>
              ) : (
                <pre className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">
                  {promptContent}
                </pre>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
