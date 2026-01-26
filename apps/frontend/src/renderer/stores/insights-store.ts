import { create } from 'zustand';
import type {
  InsightsSession,
  InsightsSessionSummary,
  InsightsChatMessage,
  InsightsChatStatus,
  InsightsStreamChunk,
  InsightsToolUsage,
  InsightsModelConfig,
  TaskMetadata,
  Task,
  ImageAttachment
} from '../../shared/types';

// Maximum number of images across all messages in a session to prevent memory explosion
const MAX_IMAGES_PER_SESSION = 100;

/**
 * Custom error class for session image limit exceeded.
 * Allows component to translate the error message with proper i18n.
 */
export class SessionImageLimitError extends Error {
  constructor(public remaining: number) {
    super('SESSION_IMAGE_LIMIT');
    this.name = 'SessionImageLimitError';
  }
}

interface ToolUsage {
  name: string;
  input?: string;
}

interface InsightsState {
  // Data
  session: InsightsSession | null;
  sessions: InsightsSessionSummary[]; // List of all sessions
  status: InsightsChatStatus;
  pendingMessage: string;
  pendingImages: File[]; // Images selected for attachment
  streamingContent: string; // Accumulates streaming response
  currentTool: ToolUsage | null; // Currently executing tool
  toolsUsed: InsightsToolUsage[]; // Tools used during current response
  isLoadingSessions: boolean;

  // Actions
  setSession: (session: InsightsSession | null) => void;
  setSessions: (sessions: InsightsSessionSummary[]) => void;
  setStatus: (status: InsightsChatStatus) => void;
  setPendingMessage: (message: string) => void;
  addPendingImage: (image: File) => void;
  removePendingImage: (index: number) => void;
  clearPendingImages: () => void;
  addMessage: (message: InsightsChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
  setCurrentTool: (tool: ToolUsage | null) => void;
  addToolUsage: (tool: ToolUsage) => void;
  clearToolsUsed: () => void;
  finalizeStreamingMessage: (suggestedTask?: InsightsChatMessage['suggestedTask']) => void;
  clearSession: () => void;
  setLoadingSessions: (loading: boolean) => void;
}

const initialStatus: InsightsChatStatus = {
  phase: 'idle',
  message: ''
};

export const useInsightsStore = create<InsightsState>((set, _get) => ({
  // Initial state
  session: null,
  sessions: [],
  status: initialStatus,
  pendingMessage: '',
  pendingImages: [],
  streamingContent: '',
  currentTool: null,
  toolsUsed: [],
  isLoadingSessions: false,

  // Actions
  setSession: (session) => set({ session }),

  setSessions: (sessions) => set({ sessions }),

  setStatus: (status) => set({ status }),

  setLoadingSessions: (loading) => set({ isLoadingSessions: loading }),

  setPendingMessage: (message) => set({ pendingMessage: message }),

  addPendingImage: (image) =>
    set((state) => ({
      pendingImages: [...state.pendingImages, image]
    })),

  removePendingImage: (index) =>
    set((state) => ({
      pendingImages: state.pendingImages.filter((_, i) => i !== index)
    })),

  clearPendingImages: () => set({ pendingImages: [] }),

  addMessage: (message) =>
    set((state) => {
      if (!state.session) {
        // Create new session if none exists
        return {
          session: {
            id: `session-${Date.now()}`,
            projectId: '',
            messages: [message],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };
      }

      return {
        session: {
          ...state.session,
          messages: [...state.session.messages, message],
          updatedAt: new Date()
        }
      };
    }),

  updateLastAssistantMessage: (content) =>
    set((state) => {
      if (!state.session || state.session.messages.length === 0) return state;

      const messages = [...state.session.messages];
      const lastIndex = messages.length - 1;
      const lastMessage = messages[lastIndex];

      if (lastMessage.role === 'assistant') {
        messages[lastIndex] = { ...lastMessage, content };
      }

      return {
        session: {
          ...state.session,
          messages,
          updatedAt: new Date()
        }
      };
    }),

  appendStreamingContent: (content) =>
    set((state) => ({
      streamingContent: state.streamingContent + content
    })),

  clearStreamingContent: () => set({ streamingContent: '' }),

  setCurrentTool: (tool) => set({ currentTool: tool }),

  addToolUsage: (tool) =>
    set((state) => ({
      toolsUsed: [
        ...state.toolsUsed,
        {
          name: tool.name,
          input: tool.input,
          timestamp: new Date()
        }
      ]
    })),

  clearToolsUsed: () => set({ toolsUsed: [] }),

  finalizeStreamingMessage: (suggestedTask) =>
    set((state) => {
      const content = state.streamingContent;
      const toolsUsed = state.toolsUsed.length > 0 ? [...state.toolsUsed] : undefined;

      if (!content && !suggestedTask && !toolsUsed) {
        return { streamingContent: '', toolsUsed: [] };
      }

      const newMessage: InsightsChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date(),
        suggestedTask,
        toolsUsed
      };

      if (!state.session) {
        return {
          streamingContent: '',
          toolsUsed: [],
          session: {
            id: `session-${Date.now()}`,
            projectId: '',
            messages: [newMessage],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };
      }

      return {
        streamingContent: '',
        toolsUsed: [],
        session: {
          ...state.session,
          messages: [...state.session.messages, newMessage],
          updatedAt: new Date()
        }
      };
    }),

  clearSession: () =>
    set({
      session: null,
      status: initialStatus,
      pendingMessage: '',
      pendingImages: [],
      streamingContent: '',
      currentTool: null,
      toolsUsed: []
    })
}));

// Helper functions

/**
 * Safely extract base64 data from a data URL
 * @param dataUrl The data URL (e.g., "data:image/png;base64,abc123")
 * @returns The base64 string without the data URL prefix
 * @throws Error if the data URL format is invalid
 */
export function getBase64FromDataUrl(dataUrl: string): string {
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    throw new Error('Invalid data URL format');
  }
  return parts[1];
}

/**
 * Detect MIME type from a data URL
 * @param dataUrl The data URL (e.g., "data:image/png;base64,abc123")
 * @returns The MIME type (e.g., "image/png") or undefined if not found
 */
function detectMimeTypeFromDataUrl(dataUrl: string): string | undefined {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : undefined;
}

/**
 * Compress an image data URL to reduce memory usage
 * Preserves transparency for PNG/WebP, uses JPEG for other formats
 * @param dataUrl The original data URL
 * @param maxWidth Maximum width in pixels (default 1920)
 * @param quality JPEG/quality 0-1 (default 0.8)
 * @returns Object with compressed data URL and output MIME type
 */
async function compressImage(
  dataUrl: string,
  maxWidth = 1920,
  quality = 0.8
): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Detect input MIME type to preserve transparency
      const inputMimeType = detectMimeTypeFromDataUrl(dataUrl);

      // Use PNG or WebP for formats with transparency, JPEG for others
      // JPEG doesn't support transparency and will turn transparent pixels black
      let outputMimeType = 'image/jpeg';
      if (inputMimeType === 'image/png' || inputMimeType === 'image/webp') {
        outputMimeType = inputMimeType; // Preserve original format for transparency
      }

      // Clean up image object to prevent memory leak (consistent with error path)
      img.src = '';

      resolve({
        dataUrl: canvas.toDataURL(outputMimeType, quality),
        mimeType: outputMimeType
      });
    };
    img.onerror = () => {
      // Clean up image object to prevent memory leak
      img.src = '';
      reject(new Error('Failed to load image'));
    };
    img.src = dataUrl;
  });
}

/**
 * Convert File objects to ImageAttachment format with compression
 */
async function convertFilesToImageAttachments(files: File[]): Promise<ImageAttachment[]> {
  const attachments: ImageAttachment[] = [];

  for (const file of files) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Compress image before storing to reduce memory usage
    const compressed = await compressImage(dataUrl);

    // Calculate compressed size from base64 string
    // Base64 length to bytes: Math.ceil((b64Length * 3) / 4) minus padding
    const compressedBase64 = getBase64FromDataUrl(compressed.dataUrl);
    const compressedSize = Math.ceil((compressedBase64.length * 3) / 4);

    const attachment: ImageAttachment = {
      id: crypto.randomUUID(),
      filename: file.name,
      mimeType: compressed.mimeType, // Use the actual output MIME type from compression
      size: compressedSize, // Track compressed size, not original file size
      data: compressedBase64 // Store compressed base64 without prefix
    };
    // Mark as compressed to avoid re-compression
    (attachment as ImageAttachment & { _compressed?: boolean })._compressed = true;
    attachments.push(attachment);
  }

  return attachments;
}

/**
 * Ensure ImageAttachment[] is compressed (re-compresses if needed)
 * This handles cases where ImageAttachments might come from external sources
 * or are being re-used without going through the initial compression.
 */
async function ensureImageAttachmentsCompressed(attachments: ImageAttachment[]): Promise<ImageAttachment[]> {
  const result: ImageAttachment[] = [];

  for (const attachment of attachments) {
    // Check if already compressed (has the _compressed flag)
    const isCompressed = (attachment as ImageAttachment & { _compressed?: boolean })._compressed;

    if (isCompressed) {
      // Already compressed, just copy as-is
      result.push(attachment);
    } else {
      // Reconstruct data URL from attachment
      const dataUrl = `data:${attachment.mimeType};base64,${attachment.data}`;

      // Compress to ensure consistent sizing and format
      const compressed = await compressImage(dataUrl);

      // Calculate compressed size from base64 string
      // Base64 length to bytes: Math.ceil((b64Length * 3) / 4) minus padding
      const compressedBase64 = getBase64FromDataUrl(compressed.dataUrl);
      const compressedSize = Math.ceil((compressedBase64.length * 3) / 4);

      result.push({
        ...attachment,
        mimeType: compressed.mimeType,
        size: compressedSize,
        data: compressedBase64
      });
    }
  }

  return result;
}

export async function loadInsightsSessions(projectId: string): Promise<void> {
  const store = useInsightsStore.getState();
  store.setLoadingSessions(true);

  try {
    const result = await window.electronAPI.listInsightsSessions(projectId);
    if (result.success && result.data) {
      store.setSessions(result.data);
    } else {
      store.setSessions([]);
    }
  } finally {
    store.setLoadingSessions(false);
  }
}

export async function loadInsightsSession(projectId: string): Promise<void> {
  const result = await window.electronAPI.getInsightsSession(projectId);
  if (result.success && result.data) {
    useInsightsStore.getState().setSession(result.data);
  } else {
    useInsightsStore.getState().setSession(null);
  }
  // Also load the sessions list
  await loadInsightsSessions(projectId);
}

export async function sendMessage(
  projectId: string,
  message: string,
  modelConfig?: InsightsModelConfig,
  images?: File[] | ImageAttachment[]
): Promise<void> {
  const store = useInsightsStore.getState();
  const session = store.session;

  // Count existing images in session to prevent memory explosion
  const existingImageCount = session?.messages.reduce(
    (count, msg) => count + (msg.images?.length || 0),
    0
  ) || 0;

  // Check if adding images would exceed the session-wide limit
  if (images && images.length > 0) {
    const newTotal = existingImageCount + images.length;
    if (newTotal > MAX_IMAGES_PER_SESSION) {
      const remaining = MAX_IMAGES_PER_SESSION - existingImageCount;
      throw new SessionImageLimitError(remaining);
    }
  }

  // Convert images to ImageAttachment format if provided
  // Accepts both File[] and ImageAttachment[] for flexibility
  let imageAttachments: ImageAttachment[] | undefined;
  if (images && images.length > 0) {
    // Validate homogeneous array - all elements must be same type
    const firstIsFile = images[0] instanceof File;
    const allSameType = images.every(img => (img instanceof File) === firstIsFile);
    if (!allSameType) {
      throw new Error('Mixed image types not allowed: all elements must be either File or ImageAttachment');
    }

    // Check if images are File objects using instanceof File (robust type check)
    if (firstIsFile) {
      // Convert File[] to ImageAttachment[]
      imageAttachments = await convertFilesToImageAttachments(images as File[]);
    } else {
      // Already ImageAttachment[] - ensure they are compressed
      imageAttachments = await ensureImageAttachmentsCompressed(images as ImageAttachment[]);
    }
  }

  // Add user message to session
  const userMessage: InsightsChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: message,
    timestamp: new Date(),
    images: imageAttachments
  };
  store.addMessage(userMessage);

  // Clear pending and set status
  store.setPendingMessage('');
  store.clearPendingImages();
  store.clearStreamingContent();
  store.clearToolsUsed(); // Clear tools from previous response
  store.setStatus({
    phase: 'thinking',
    message: 'Processing your message...'
  });

  // Use provided modelConfig, or fall back to session's config
  const configToUse = modelConfig || session?.modelConfig;

  // Send to main process with optional image attachments
  window.electronAPI.sendInsightsMessage(
    projectId,
    message,
    configToUse,
    imageAttachments
  );
}

export async function clearSession(projectId: string): Promise<void> {
  const result = await window.electronAPI.clearInsightsSession(projectId);
  if (result.success) {
    useInsightsStore.getState().clearSession();
    // Reload sessions list and current session
    await loadInsightsSession(projectId);
  }
}

export async function newSession(projectId: string): Promise<void> {
  const result = await window.electronAPI.newInsightsSession(projectId);
  if (result.success && result.data) {
    useInsightsStore.getState().setSession(result.data);
    // Reload sessions list
    await loadInsightsSessions(projectId);
  }
}

export async function switchSession(projectId: string, sessionId: string): Promise<void> {
  const result = await window.electronAPI.switchInsightsSession(projectId, sessionId);
  if (result.success && result.data) {
    useInsightsStore.getState().setSession(result.data);
    // Reset streaming state when switching sessions
    useInsightsStore.getState().clearStreamingContent();
    useInsightsStore.getState().clearToolsUsed();
    useInsightsStore.getState().setCurrentTool(null);
    useInsightsStore.getState().setStatus({ phase: 'idle', message: '' });
  } else {
    throw new Error(result.error || 'Failed to switch session');
  }
}

export async function deleteSession(projectId: string, sessionId: string): Promise<boolean> {
  const result = await window.electronAPI.deleteInsightsSession(projectId, sessionId);
  if (result.success) {
    // Reload sessions list and current session
    await loadInsightsSession(projectId);
    return true;
  }
  return false;
}

export async function renameSession(projectId: string, sessionId: string, newTitle: string): Promise<boolean> {
  const result = await window.electronAPI.renameInsightsSession(projectId, sessionId, newTitle);
  if (result.success) {
    // Reload sessions list to reflect the change
    await loadInsightsSessions(projectId);
    return true;
  }
  return false;
}

export async function updateModelConfig(projectId: string, sessionId: string, modelConfig: InsightsModelConfig): Promise<boolean> {
  const result = await window.electronAPI.updateInsightsModelConfig(projectId, sessionId, modelConfig);
  if (result.success) {
    // Update local session state
    const store = useInsightsStore.getState();
    if (store.session?.id === sessionId) {
      store.setSession({
        ...store.session,
        modelConfig,
        updatedAt: new Date()
      });
    }
    // Reload sessions list to reflect the change
    await loadInsightsSessions(projectId);
    return true;
  }
  return false;
}

export async function createTaskFromSuggestion(
  projectId: string,
  title: string,
  description: string,
  metadata?: TaskMetadata
): Promise<Task | null> {
  const result = await window.electronAPI.createTaskFromInsights(
    projectId,
    title,
    description,
    metadata
  );

  if (result.success && result.data) {
    return result.data;
  }
  return null;
}

// IPC listener setup - call this once when the app initializes
export function setupInsightsListeners(): () => void {
  const store = useInsightsStore.getState;

  // Listen for streaming chunks
  const unsubStreamChunk = window.electronAPI.onInsightsStreamChunk(
    (_projectId, chunk: InsightsStreamChunk) => {
      switch (chunk.type) {
        case 'text':
          if (chunk.content) {
            // Add separator between thoughts when detecting double newline followed by double newline
            // Stricter heuristic: require last content to end with \n\n AND new content to start with \n\n
            const contentToAdd = chunk.content;
            const lastContent = store().streamingContent;
            const needsSeparator = lastContent.endsWith('\n\n') && contentToAdd.startsWith('\n\n');

            store().appendStreamingContent(
              needsSeparator ? '\n\n---\n\n' + contentToAdd : contentToAdd
            );
            store().setCurrentTool(null); // Clear tool when receiving text
            store().setStatus({
              phase: 'streaming',
              message: 'Receiving response...'
            });
          }
          break;
        case 'tool_start':
          if (chunk.tool) {
            store().setCurrentTool({
              name: chunk.tool.name,
              input: chunk.tool.input
            });
            // Record this tool usage for history
            store().addToolUsage({
              name: chunk.tool.name,
              input: chunk.tool.input
            });
            store().setStatus({
              phase: 'streaming',
              message: `Using ${chunk.tool.name}...`
            });
          }
          break;
        case 'tool_end':
          store().setCurrentTool(null);
          break;
        case 'task_suggestion':
          // Finalize the message with task suggestion
          store().setCurrentTool(null);
          store().finalizeStreamingMessage(chunk.suggestedTask);
          break;
        case 'done':
          // Finalize any remaining content
          store().setCurrentTool(null);
          store().finalizeStreamingMessage();
          store().setStatus({
            phase: 'complete',
            message: ''
          });
          break;
        case 'error':
          store().setCurrentTool(null);
          store().setStatus({
            phase: 'error',
            error: chunk.error
          });
          break;
      }
    }
  );

  // Listen for status updates
  const unsubStatus = window.electronAPI.onInsightsStatus((_projectId, status) => {
    store().setStatus(status);
  });

  // Listen for errors
  const unsubError = window.electronAPI.onInsightsError((_projectId, error) => {
    store().setStatus({
      phase: 'error',
      error
    });
  });

  // Listen for session updates (e.g., after assistant message saved with auto-generated title)
  const unsubSessionUpdated = window.electronAPI.onInsightsSessionUpdated(
    (_projectId, session: InsightsSession) => {
      // Update current session if it matches
      const currentSession = store().session;
      if (currentSession?.id === session.id) {
        store().setSession(session);
      }
      // Also refresh sessions list for sidebar
      loadInsightsSessions(session.projectId).catch((err) => {
        console.error('Failed to refresh sessions list after update:', err);
      });
    }
  );

  // Return cleanup function
  return () => {
    unsubStreamChunk();
    unsubStatus();
    unsubError();
    unsubSessionUpdated();
  };
}
