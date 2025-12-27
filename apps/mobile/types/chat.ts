/**
 * Chat Types
 * Defines types for AI chat sessions and messages
 */

/**
 * Message role
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message status
 */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

/**
 * Tool call status
 */
export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Tool call - represents AI tool usage
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments?: Record<string, unknown>;
  result?: string;
  status: ToolCallStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/**
 * Chat message
 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;

  // Streaming state
  isStreaming?: boolean;
  streamedContent?: string;

  // Tool usage
  toolCalls?: ToolCall[];

  // Metadata
  createdAt: string;
  completedAt?: string;
  tokenCount?: number;

  // Error handling
  error?: string;
}

/**
 * Chat session
 */
export interface ChatSession {
  id: string;
  name: string;
  projectId?: string;
  messages: ChatMessage[];

  // Session state
  isActive: boolean;
  isLoading?: boolean;

  // AI configuration
  claudeProfileId?: string;
  systemPrompt?: string;

  // Context
  contextFiles?: string[];
  contextMemoryKeys?: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;

  // Statistics
  messageCount: number;
  totalTokens?: number;
}

/**
 * Chat session creation input
 */
export interface ChatSessionCreateInput {
  name?: string;
  projectId?: string;
  claudeProfileId?: string;
  systemPrompt?: string;
}

/**
 * Chat session update input
 */
export interface ChatSessionUpdateInput {
  name?: string;
  claudeProfileId?: string;
  systemPrompt?: string;
  contextFiles?: string[];
  contextMemoryKeys?: string[];
}

/**
 * Send message input
 */
export interface SendMessageInput {
  sessionId: string;
  content: string;
  attachments?: MessageAttachment[];
}

/**
 * Message attachment (files, images, etc.)
 */
export interface MessageAttachment {
  id: string;
  type: 'file' | 'image' | 'code';
  name: string;
  content?: string;
  path?: string;
  mimeType?: string;
}

/**
 * Claude profile for AI configuration
 */
export interface ClaudeProfile {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat session filter options
 */
export interface ChatSessionFilters {
  projectId?: string;
  search?: string;
  isActive?: boolean;
}

/**
 * Quick prompt suggestion
 */
export interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  category: 'code' | 'debug' | 'explain' | 'review' | 'other';
}
