import { useState, useEffect, useRef, useMemo, useCallback, type ClipboardEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Send,
  Loader2,
  Plus,
  Sparkles,
  User,
  Bot,
  CheckCircle2,
  AlertCircle,
  Search,
  FileText,
  FolderSearch,
  PanelLeftClose,
  PanelLeft,
  Image as ImageIcon,
  X
} from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import {
  useInsightsStore,
  loadInsightsSession,
  sendMessage,
  newSession,
  switchSession,
  deleteSession,
  renameSession,
  updateModelConfig,
  createTaskFromSuggestion,
  setupInsightsListeners,
  getBase64FromDataUrl
} from '../stores/insights-store';
import { SessionImageLimitError } from '../stores/insights-store';
import { loadTasks } from '../stores/task-store';
import { ChatHistorySidebar } from './ChatHistorySidebar';
import { InsightsModelSelector } from './InsightsModelSelector';
import {
  generateImageId,
  blobToBase64,
  createThumbnail,
  isValidImageMimeType,
  resolveFilename
} from './ImageUpload';
import type { InsightsChatMessage, InsightsModelConfig, ImageAttachment } from '../../shared/types';
import {
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_COLORS,
  TASK_COMPLEXITY_LABELS,
  TASK_COMPLEXITY_COLORS,
  MAX_IMAGES_PER_TASK,
  MAX_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES_DISPLAY
} from '../../shared/constants';

// createSafeLink - factory function that creates a SafeLink component with i18n support
const createSafeLink = (opensInNewWindowText: string) => {
  return function SafeLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    // Validate URL - only allow http, https, and relative links
    const isValidUrl = href && (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('/') ||
      href.startsWith('#')
    );

    if (!isValidUrl) {
      // For invalid or potentially malicious URLs, render as plain text
      return <span className="text-muted-foreground">{children}</span>;
    }

    // External links get security attributes and accessibility indicator
    const isExternal = href?.startsWith('http://') || href?.startsWith('https://');

    return (
      <a
        href={href}
        {...props}
        {...(isExternal && {
          target: '_blank',
          rel: 'noopener noreferrer',
        })}
        className="text-primary hover:underline"
      >
        {children}
        {isExternal && <span className="sr-only"> {opensInNewWindowText}</span>}
      </a>
    );
  };
};


interface InsightsProps {
  projectId: string;
}

export function Insights({ projectId }: InsightsProps) {
  const { t } = useTranslation(['common', 'tasks']);
  const session = useInsightsStore((state) => state.session);
  const sessions = useInsightsStore((state) => state.sessions);
  const status = useInsightsStore((state) => state.status);
  const streamingContent = useInsightsStore((state) => state.streamingContent);
  const currentTool = useInsightsStore((state) => state.currentTool);
  const isLoadingSessions = useInsightsStore((state) => state.isLoadingSessions);

  // Create markdown components with translated accessibility text
  const markdownComponents = useMemo(() => ({
    a: createSafeLink(t('accessibility.opensInNewWindow')),
  }), [t]);

  const [inputValue, setInputValue] = useState('');
  const [creatingTask, setCreatingTask] = useState<string | null>(null);
  const [taskCreated, setTaskCreated] = useState<Set<string>>(new Set());
  const [showSidebar, setShowSidebar] = useState(true);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragOverTextarea, setIsDragOverTextarea] = useState(false);
  const [throttledStreamingContent, setThrottledStreamingContent] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Throttle streaming content updates to reduce ReactMarkdown re-renders
  useEffect(() => {
    if (!streamingContent) {
      setThrottledStreamingContent('');
      return;
    }

    // Clear any pending timeout
    if (streamingTimeoutRef.current) {
      clearTimeout(streamingTimeoutRef.current);
    }

    // Throttle updates to every 100ms during streaming
    const THROTTLE_DELAY_MS = 100;
    streamingTimeoutRef.current = setTimeout(() => {
      setThrottledStreamingContent(streamingContent);
    }, THROTTLE_DELAY_MS);

    return () => {
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
      }
    };
  }, [streamingContent]);

  // Load session and set up listeners on mount
  useEffect(() => {
    loadInsightsSession(projectId);
    const cleanup = setupInsightsListeners();
    return cleanup;
  }, [projectId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, streamingContent]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Reset taskCreated when switching sessions
  useEffect(() => {
    setTaskCreated(new Set());
  }, [session?.id]);

  const handleSend = async () => {
    const message = inputValue.trim();
    if ((!message && images.length === 0) || status.phase === 'thinking' || status.phase === 'streaming') return;

    // Store current values in case of error
    const currentMessage = message;
    const currentImages = images;

    setInputValue('');
    setImages([]);
    setImageError(null);

    try {
      await sendMessage(projectId, currentMessage, undefined, currentImages);
    } catch (error) {
      // Restore user input on error, but only if UI is still empty
      // This prevents clobbering a new draft if the user typed while send was in-flight
      setInputValue(prev => (prev === '' ? currentMessage : prev));
      setImages(prev => (prev.length === 0 ? currentImages : prev));
      if (error instanceof SessionImageLimitError) {
        setImageError(t('tasks:insights.sessionImageLimitError', {
          remaining: error.remaining,
          plural: error.remaining !== 1 ? 's' : ''
        }));
      } else {
        console.error('[Insights] sendMessage failed:', error);
        setImageError(t('tasks:feedback.processingError'));
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * Handle paste event for screenshot support
   */
  const handlePaste = useCallback(async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    // Find image items in clipboard
    const imageItems: DataTransferItem[] = [];
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.type.startsWith('image/')) {
        imageItems.push(item);
      }
    }

    // If no images, allow normal paste behavior
    if (imageItems.length === 0) return;

    // Prevent default paste when we have images
    e.preventDefault();

    setImageError(null);

    // Upfront slot check for performance: avoid processing images we can't use.
    // Note: This uses images.length which may be slightly stale, but the functional
    // setImages below provides atomic correctness even in concurrent scenarios.
    const remainingSlots = MAX_IMAGES_PER_TASK - images.length;
    if (remainingSlots <= 0) {
      setImageError(t('tasks:feedback.maxImagesError', { count: MAX_IMAGES_PER_TASK }));
      return;
    }

    // Process image items (limit upfront to avoid extra base64/thumbnail work)
    const newImages: ImageAttachment[] = [];

    for (const item of imageItems) {
      // Stop processing if we've filled available slots
      if (newImages.length >= remainingSlots) break;
      const file = item.getAsFile();
      if (!file) continue;

      // Check file size for large file warning
      if (file.size > MAX_IMAGE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setImageError(
          t('tasks:images.largeFileWarning', { name: file.name, size: sizeMB })
        );
        // Still allow the upload, just warn
      }

      // Validate image type
      if (!isValidImageMimeType(file.type)) {
        setImageError(t('tasks:feedback.invalidTypeError', { types: ALLOWED_IMAGE_TYPES_DISPLAY }));
        continue;
      }

      try {
        const dataUrl = await blobToBase64(file);
        const thumbnail = await createThumbnail(dataUrl);

        // Generate filename for pasted images (screenshot-timestamp.ext)
        const mimeToExtension: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp',
        };
        const extension = mimeToExtension[file.type] || file.type.split('/')[1] || 'png';
        const timestamp = Date.now();
        const baseFilename = t('tasks:images.screenshotFilename', { timestamp, ext: extension });
        // Resolve filename to avoid duplicates within the current batch
        const resolvedFilename = resolveFilename(baseFilename, newImages.map(img => img.filename));

        newImages.push({
          id: generateImageId(),
          filename: resolvedFilename,
          mimeType: file.type,
          size: file.size,
          data: getBase64FromDataUrl(dataUrl),
          thumbnail
        });
      } catch (error) {
        console.error('[Insights] Failed to process pasted image:', error);
        setImageError(t('tasks:feedback.processingError'));
      }
    }

    if (newImages.length > 0) {
      setImages(prevImages => {
        const remaining = MAX_IMAGES_PER_TASK - prevImages.length;
        if (remaining <= 0) {
          setImageError(t('tasks:feedback.maxImagesError', { count: MAX_IMAGES_PER_TASK }));
          return prevImages;
        }
        // Only add as many images as we have slots for
        const toAdd = newImages.slice(0, remaining);
        if (toAdd.length < newImages.length) {
          setImageError(t('tasks:feedback.maxImagesError', { count: MAX_IMAGES_PER_TASK }));
        }
        return [...prevImages, ...toAdd];
      });
      // Show success feedback
      setPasteSuccess(true);
      setTimeout(() => setPasteSuccess(false), 2000);
    }
  }, [images.length, t]);

  /**
   * Remove an image from the attachments
   */
  const handleRemoveImage = useCallback((imageId: string) => {
    setImages(prevImages => prevImages.filter(img => img.id !== imageId));
    setImageError(null);
  }, []);

  /**
   * Handle drag over textarea for image drops
   */
  const handleTextareaDragOver = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTextarea(true);
  }, []);

  /**
   * Handle drag leave from textarea
   */
  const handleTextareaDragLeave = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTextarea(false);
  }, []);

  /**
   * Handle drop on textarea for images
   */
  const handleTextareaDrop = useCallback(
    async (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOverTextarea(false);

      if (status.phase === 'thinking' || status.phase === 'streaming') return;

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      // Filter for image files
      const imageFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          imageFiles.push(file);
        }
      }

      if (imageFiles.length === 0) return;

      setImageError(null);

      // Upfront slot check for performance: avoid processing images we can't use.
      // Note: This uses images.length which may be slightly stale, but the functional
      // setImages below provides atomic correctness even in concurrent scenarios.
      const remainingSlots = MAX_IMAGES_PER_TASK - images.length;
      if (remainingSlots <= 0) {
        setImageError(t('tasks:feedback.maxImagesError', { count: MAX_IMAGES_PER_TASK }));
        return;
      }

      // Process image files (limit upfront to avoid extra base64/thumbnail work)
      const newImages: ImageAttachment[] = [];

      for (const file of imageFiles) {
        // Stop processing if we've filled available slots
        if (newImages.length >= remainingSlots) break;

        // Check file size for large file warning
        if (file.size > MAX_IMAGE_SIZE) {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
          setImageError(
            t('tasks:images.largeFileWarning', { name: file.name, size: sizeMB })
          );
          // Still allow the upload, just warn
        }

        // Validate image type
        if (!isValidImageMimeType(file.type)) {
          setImageError(t('tasks:feedback.invalidTypeError', { types: ALLOWED_IMAGE_TYPES_DISPLAY }));
          continue;
        }

        try {
          const dataUrl = await blobToBase64(file);
          const thumbnail = await createThumbnail(dataUrl);

          // Resolve filename to avoid duplicates within the current batch
          const resolvedFilename = resolveFilename(file.name, newImages.map(img => img.filename));

          newImages.push({
            id: generateImageId(),
            filename: resolvedFilename,
            mimeType: file.type,
            size: file.size,
            data: getBase64FromDataUrl(dataUrl),
            thumbnail
          });
        } catch (error) {
          console.error('[Insights] Failed to process dropped image:', error);
          setImageError(t('tasks:feedback.processingError'));
        }
      }

      if (newImages.length > 0) {
        setImages(prevImages => {
          const remaining = MAX_IMAGES_PER_TASK - prevImages.length;
          if (remaining <= 0) {
            setImageError(t('tasks:feedback.maxImagesError', { count: MAX_IMAGES_PER_TASK }));
            return prevImages;
          }
          // Only add as many images as we have slots for
          const toAdd = newImages.slice(0, remaining);
          if (toAdd.length < newImages.length) {
            setImageError(t('tasks:feedback.maxImagesError', { count: MAX_IMAGES_PER_TASK }));
          }
          return [...prevImages, ...toAdd];
        });
        // Show success feedback
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
      }
    },
    [images.length, status.phase, t]
  );

  const handleNewSession = async () => {
    await newSession(projectId);
    setTaskCreated(new Set());
    textareaRef.current?.focus();
  };

  const handleSelectSession = async (sessionId: string) => {
    if (sessionId !== session?.id) {
      // Store current state for potential restoration
      const currentImages = images;

      // Clear pending images before switching to prevent sending them to wrong session
      setImages([]);
      setImageError(null);

      try {
        await switchSession(projectId, sessionId);
      } catch (error) {
        // Restore state on failure
        setImages(currentImages);
        // Show error message to user
        console.error('[Insights] switchSession failed:', error);
        setImageError(t('tasks:insights.sessionSwitchError'));
      }
    }
  };

  const handleDeleteSession = async (sessionId: string): Promise<boolean> => {
    return await deleteSession(projectId, sessionId);
  };

  const handleRenameSession = async (sessionId: string, newTitle: string): Promise<boolean> => {
    return await renameSession(projectId, sessionId, newTitle);
  };

  const handleCreateTask = async (message: InsightsChatMessage) => {
    if (!message.suggestedTask) return;

    setCreatingTask(message.id);
    try {
      const task = await createTaskFromSuggestion(
        projectId,
        message.suggestedTask.title,
        message.suggestedTask.description,
        message.suggestedTask.metadata
      );

      if (task) {
        setTaskCreated(prev => new Set(prev).add(message.id));
        // Reload tasks to show the new task in the kanban
        loadTasks(projectId);
      }
    } finally {
      setCreatingTask(null);
    }
  };

  const handleModelConfigChange = async (config: InsightsModelConfig) => {
    // If we have a session, persist the config
    if (session?.id) {
      await updateModelConfig(projectId, session.id, config);
    }
  };

  const isLoading = status.phase === 'thinking' || status.phase === 'streaming';
  const messages = session?.messages || [];

  return (
    <div className="flex h-full">
      {/* Chat History Sidebar */}
      {showSidebar && (
        <ChatHistorySidebar
          sessions={sessions}
          currentSessionId={session?.id || null}
          isLoading={isLoadingSessions}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSidebar(!showSidebar)}
              title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              {showSidebar ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Insights</h2>
              <p className="text-sm text-muted-foreground">
                Ask questions about your codebase
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InsightsModelSelector
              currentConfig={session?.modelConfig}
              onConfigChange={handleModelConfigChange}
              disabled={isLoading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewSession}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>
        </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6 py-4">
        {messages.length === 0 && !throttledStreamingContent ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-foreground">
              {t('tasks:insights.emptyStateTitle')}
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              {t('tasks:insights.emptyStateDescription')}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                t('tasks:insights.suggestionArchitecture'),
                t('tasks:insights.suggestionImprovements'),
                t('tasks:insights.suggestionFeatures'),
                t('tasks:insights.suggestionSecurity')
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setInputValue(suggestion);
                    textareaRef.current?.focus();
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                markdownComponents={markdownComponents}
                onCreateTask={() => handleCreateTask(message)}
                isCreatingTask={creatingTask === message.id}
                taskCreated={taskCreated.has(message.id)}
              />
            ))}

            {/* Streaming message */}
            {(throttledStreamingContent || currentTool) && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="mb-1 text-sm font-medium text-foreground">
                    Assistant
                  </div>
                  {throttledStreamingContent && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {throttledStreamingContent}
                      </ReactMarkdown>
                    </div>
                  )}
                  {/* Tool usage indicator */}
                  {currentTool && (
                    <ToolIndicator name={currentTool.name} input={currentTool.input} />
                  )}
                </div>
              </div>
            )}

            {/* Thinking indicator */}
            {status.phase === 'thinking' && !streamingContent && !currentTool && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            {/* Error message */}
            {status.phase === 'error' && status.error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {status.error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        {/* Image thumbnails display */}
        {images.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative group rounded-md border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  style={{ width: '64px', height: '64px' }}
                  title={image.filename}
                >
                  {image.thumbnail ? (
                    <img
                      src={image.thumbnail}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  {/* Remove button */}
                  <button
                    type="button"
                    className="absolute top-0.5 right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(image.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRemoveImage(image.id);
                      }
                    }}
                    tabIndex={0}
                    aria-label={t('tasks:images.removeImageAriaLabel', { filename: image.filename })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            {/* Image count indicator */}
            <p className="text-xs text-muted-foreground mb-3">
              {t('tasks:images.countIndicator', {
                count: images.length,
                remaining: MAX_IMAGES_PER_TASK - images.length
              })}
            </p>
          </>
        )}

        {/* Paste Success Indicator */}
        {pasteSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-sm text-green-600 mb-2 animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <ImageIcon className="h-4 w-4" />
            {t('tasks:feedback.imageAdded')}
          </div>
        )}

        {/* Error display */}
        {imageError && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-2 text-sm text-destructive mb-2"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{imageError}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDragOver={handleTextareaDragOver}
            onDragLeave={handleTextareaDragLeave}
            onDrop={handleTextareaDrop}
            placeholder="Ask about your codebase..."
            className={cn(
              'min-h-[80px] resize-none',
              isDragOverTextarea && 'ring-2 ring-primary border-primary'
            )}
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={(!inputValue.trim() && images.length === 0) || isLoading}
            className="self-end"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t('tasks:feedback.inputHint')}
        </p>
      </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: InsightsChatMessage;
  markdownComponents: Components;
  onCreateTask: () => void;
  isCreatingTask: boolean;
  taskCreated: boolean;
}

function MessageBubble({
  message,
  markdownComponents,
  onCreateTask,
  isCreatingTask,
  taskCreated
}: MessageBubbleProps) {
  const { t } = useTranslation(['tasks']);
  const isUser = message.role === 'user';

  return (
    <div className="flex gap-3">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-muted' : 'bg-primary/10'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        <div className="text-sm font-medium text-foreground">
          {isUser ? 'You' : 'Assistant'}
        </div>

        {/* Image attachments display */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.images.map((image) => (
              <button
                type="button"
                key={image.id}
                className="relative group rounded-md border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 focus:ring-2 focus:ring-primary/50 transition-all"
                style={{ width: '120px', height: '120px' }}
                title={image.filename}
                onClick={() => {
                  // Open full-size image in new tab
                  // Guard against missing data - fallback to thumbnail or skip if neither available
                  if (image.data) {
                    const fullSizeUrl = `data:${image.mimeType};base64,${image.data}`;
                    window.open(fullSizeUrl, '_blank');
                  } else if (image.thumbnail) {
                    // Fallback to thumbnail if full-size data is missing
                    window.open(image.thumbnail, '_blank');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    // Guard against missing data - fallback to thumbnail or skip if neither available
                    if (image.data) {
                      const fullSizeUrl = `data:${image.mimeType};base64,${image.data}`;
                      window.open(fullSizeUrl, '_blank');
                    } else if (image.thumbnail) {
                      // Fallback to thumbnail if full-size data is missing
                      window.open(image.thumbnail, '_blank');
                    }
                  }
                }}
                aria-label={t('tasks:images.viewFullSizeAriaLabel', { filename: image.filename })}
              >
                {image.thumbnail ? (
                  <img
                    src={image.thumbnail}
                    alt={t('tasks:images.thumbnailAlt', { filename: image.filename })}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <div className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          isUser && '[&_]:whitespace-pre-wrap'
        )}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Tool usage history for assistant messages */}
        {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
          <ToolUsageHistory tools={message.toolsUsed} />
        )}

        {/* Task suggestion card */}
        {message.suggestedTask && (
          <Card className="mt-3 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  Suggested Task
                </span>
              </div>
              <h4 className="mb-2 font-medium text-foreground">
                {message.suggestedTask.title}
              </h4>
              <p className="mb-3 text-sm text-muted-foreground">
                {message.suggestedTask.description}
              </p>
              {message.suggestedTask.metadata && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {message.suggestedTask.metadata.category && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        TASK_CATEGORY_COLORS[message.suggestedTask.metadata.category]
                      )}
                    >
                      {TASK_CATEGORY_LABELS[message.suggestedTask.metadata.category] ||
                        message.suggestedTask.metadata.category}
                    </Badge>
                  )}
                  {message.suggestedTask.metadata.complexity && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        TASK_COMPLEXITY_COLORS[message.suggestedTask.metadata.complexity]
                      )}
                    >
                      {TASK_COMPLEXITY_LABELS[message.suggestedTask.metadata.complexity] ||
                        message.suggestedTask.metadata.complexity}
                    </Badge>
                  )}
                </div>
              )}
              <Button
                size="sm"
                onClick={onCreateTask}
                disabled={isCreatingTask || taskCreated}
              >
                {isCreatingTask ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : taskCreated ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Task Created
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Tool usage history component for showing tools used in completed messages
interface ToolUsageHistoryProps {
  tools: Array<{
    name: string;
    input?: string;
    timestamp: Date;
  }>;
}

function ToolUsageHistory({ tools }: ToolUsageHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (tools.length === 0) return null;

  // Group tools by name for summary
  const toolCounts = tools.reduce((acc, tool) => {
    acc[tool.name] = (acc[tool.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'Read':
        return FileText;
      case 'Glob':
        return FolderSearch;
      case 'Grep':
        return Search;
      default:
        return FileText;
    }
  };

  const getToolColor = (toolName: string) => {
    switch (toolName) {
      case 'Read':
        return 'text-blue-500';
      case 'Glob':
        return 'text-amber-500';
      case 'Grep':
        return 'text-green-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1">
          {Object.entries(toolCounts).map(([name, count]) => {
            const Icon = getToolIcon(name);
            return (
              <span key={name} className={cn('flex items-center gap-0.5', getToolColor(name))}>
                <Icon className="h-3 w-3" />
                <span>{count}</span>
              </span>
            );
          })}
        </span>
        <span>{tools.length} tool{tools.length !== 1 ? 's' : ''} used</span>
        <span className="text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1 rounded-md border border-border bg-muted/30 p-2">
          {tools.map((tool, index) => {
            const Icon = getToolIcon(tool.name);
            return (
              <div
                key={`${tool.name}-${index}`}
                className="flex items-center gap-2 text-xs"
              >
                <Icon className={cn('h-3 w-3 shrink-0', getToolColor(tool.name))} />
                <span className="font-medium">{tool.name}</span>
                {tool.input && (
                  <span className="text-muted-foreground truncate max-w-[250px]">
                    {tool.input}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Tool indicator component for showing what the AI is currently doing
interface ToolIndicatorProps {
  name: string;
  input?: string;
}

function ToolIndicator({ name, input }: ToolIndicatorProps) {
  // Get friendly name and icon for each tool
  const getToolInfo = (toolName: string) => {
    switch (toolName) {
      case 'Read':
        return {
          icon: FileText,
          label: 'Reading file',
          color: 'text-blue-500 bg-blue-500/10'
        };
      case 'Glob':
        return {
          icon: FolderSearch,
          label: 'Searching files',
          color: 'text-amber-500 bg-amber-500/10'
        };
      case 'Grep':
        return {
          icon: Search,
          label: 'Searching code',
          color: 'text-green-500 bg-green-500/10'
        };
      default:
        return {
          icon: Loader2,
          label: toolName,
          color: 'text-primary bg-primary/10'
        };
    }
  };

  const { icon: Icon, label, color } = getToolInfo(name);

  return (
    <div className={cn(
      'mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
      color
    )}>
      <Icon className="h-4 w-4 animate-pulse" />
      <span className="font-medium">{label}</span>
      {input && (
        <span className="text-muted-foreground truncate max-w-[300px]">
          {input}
        </span>
      )}
    </div>
  );
}
