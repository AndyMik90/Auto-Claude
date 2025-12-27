/**
 * ChatMessage Component
 * Displays a chat message supporting user and assistant messages
 * Includes streaming animation for in-progress responses and tool usage indicators
 */

import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import { Surface, Text, Avatar, Chip, ActivityIndicator } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { ChatMessage as ChatMessageType, ToolCall, ToolCallStatus } from '../types';
import { colors, spacing, borderRadius, shadows } from '../theme';

/**
 * Props for the ChatMessage component
 */
interface ChatMessageProps {
  /** The message to display */
  message: ChatMessageType;
  /** Whether to show the avatar (for consecutive messages) */
  showAvatar?: boolean;
  /** Whether this message is the last in the list */
  isLast?: boolean;
  /** Called when a tool call is tapped for more details */
  onToolCallPress?: (toolCall: ToolCall) => void;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Get the icon for a tool call
 */
const getToolIcon = (toolName: string): string => {
  const iconMap: Record<string, string> = {
    read_file: 'file-document-outline',
    write_file: 'file-edit-outline',
    grep: 'magnify',
    bash: 'console-line',
    create_task: 'plus-circle-outline',
    list_files: 'folder-open-outline',
    search: 'text-search',
    edit: 'pencil-outline',
  };
  return iconMap[toolName] || 'function';
};

/**
 * Get color for tool call status
 */
const getToolStatusColor = (status: ToolCallStatus): string => {
  const colorMap: Record<ToolCallStatus, string> = {
    pending: colors.text.muted,
    running: colors.status.info,
    completed: colors.status.success,
    failed: colors.status.error,
  };
  return colorMap[status];
};

/**
 * Get display label for tool call status
 */
const getToolStatusLabel = (status: ToolCallStatus): string => {
  const labels: Record<ToolCallStatus, string> = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Done',
    failed: 'Failed',
  };
  return labels[status];
};

/**
 * Streaming cursor animation component
 */
const StreamingCursor: React.FC = () => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.cursor, { opacity }]} accessibilityElementsHidden>
      <View style={styles.cursorInner} />
    </Animated.View>
  );
};

/**
 * Streaming dots animation component for loading state
 */
const StreamingDots: React.FC = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createDotAnimation = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    const animation1 = createDotAnimation(dot1, 0);
    const animation2 = createDotAnimation(dot2, 150);
    const animation3 = createDotAnimation(dot3, 300);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [dot1, dot2, dot3]);

  const translateY = (dot: Animated.Value) =>
    dot.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -4],
    });

  return (
    <View
      style={styles.dotsContainer}
      accessibilityLabel="Generating response"
      accessibilityRole="progressbar"
    >
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: translateY(dot1) }] }]}
      />
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: translateY(dot2) }] }]}
      />
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: translateY(dot3) }] }]}
      />
    </View>
  );
};

/**
 * Tool call indicator component
 */
const ToolCallIndicator: React.FC<{
  toolCall: ToolCall;
  onPress?: (toolCall: ToolCall) => void;
}> = ({ toolCall, onPress }) => {
  const statusColor = useMemo(() => getToolStatusColor(toolCall.status), [toolCall.status]);
  const icon = useMemo(() => getToolIcon(toolCall.name), [toolCall.name]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(toolCall);
    }
  }, [onPress, toolCall]);

  return (
    <Chip
      mode="flat"
      style={[styles.toolChip, { borderColor: `${statusColor}40` }]}
      textStyle={[styles.toolChipText, { color: statusColor }]}
      icon={() => (
        <View style={styles.toolIconContainer}>
          {toolCall.status === 'running' ? (
            <ActivityIndicator size={12} color={statusColor} />
          ) : (
            <Icon name={icon} size={14} color={statusColor} />
          )}
        </View>
      )}
      onPress={handlePress}
      compact
      accessibilityLabel={`Tool ${toolCall.name} - ${getToolStatusLabel(toolCall.status)}`}
      accessibilityRole="button"
      accessibilityHint="Tap to view tool details"
    >
      {toolCall.name}
    </Chip>
  );
};

/**
 * ChatMessage Component
 * Renders a single chat message with support for user/assistant roles,
 * streaming animations, and tool call indicators
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showAvatar = true,
  isLast = false,
  onToolCallPress,
  testID,
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isStreaming = message.isStreaming && message.status === 'streaming';
  const hasContent = message.content.length > 0 || (message.streamedContent && message.streamedContent.length > 0);
  const displayContent = message.streamedContent || message.content;
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const hasError = message.status === 'error' || !!message.error;

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    const role = isUser ? 'You' : 'Assistant';
    const status = isStreaming ? ', currently typing' : '';
    const toolInfo = hasToolCalls
      ? `, used ${message.toolCalls?.length} tool${message.toolCalls?.length === 1 ? '' : 's'}`
      : '';
    return `${role} said: ${displayContent || 'Empty message'}${status}${toolInfo}`;
  }, [isUser, isStreaming, hasToolCalls, message.toolCalls?.length, displayContent]);

  return (
    <View
      style={[
        styles.container,
        isUser && styles.containerUser,
        isLast && styles.containerLast,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      testID={testID}
    >
      {/* Avatar for assistant messages */}
      {isAssistant && showAvatar && (
        <View style={styles.avatarContainer}>
          <Avatar.Icon
            size={32}
            icon="robot"
            style={styles.avatar}
            color={colors.accent.primary}
          />
        </View>
      )}

      {/* Spacer for assistant messages without avatar */}
      {isAssistant && !showAvatar && <View style={styles.avatarSpacer} />}

      {/* Message bubble */}
      <Surface
        style={[
          styles.bubble,
          isUser && styles.bubbleUser,
          isAssistant && styles.bubbleAssistant,
          isStreaming && styles.bubbleStreaming,
          hasError && styles.bubbleError,
        ]}
        elevation={0}
      >
        {/* Message content */}
        {hasContent ? (
          <View style={styles.contentContainer}>
            <Text
              style={[
                styles.messageText,
                isUser && styles.messageTextUser,
                hasError && styles.messageTextError,
              ]}
              selectable
            >
              {displayContent}
              {isStreaming && <StreamingCursor />}
            </Text>
          </View>
        ) : isStreaming ? (
          <StreamingDots />
        ) : null}

        {/* Error indicator */}
        {hasError && message.error && (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={14} color={colors.status.error} />
            <Text style={styles.errorText} numberOfLines={2}>
              {message.error}
            </Text>
          </View>
        )}

        {/* Tool calls section */}
        {hasToolCalls && (
          <View style={styles.toolCallsContainer}>
            <View style={styles.toolCallsHeader}>
              <Icon
                name="cog-outline"
                size={12}
                color={colors.text.muted}
                style={styles.toolCallsIcon}
              />
              <Text style={styles.toolCallsLabel}>
                {message.toolCalls?.length === 1 ? 'Tool used' : 'Tools used'}
              </Text>
            </View>
            <View style={styles.toolCallsList}>
              {message.toolCalls?.map((toolCall) => (
                <ToolCallIndicator
                  key={toolCall.id}
                  toolCall={toolCall}
                  onPress={onToolCallPress}
                />
              ))}
            </View>
          </View>
        )}

        {/* Timestamp (for completed messages) */}
        {!isStreaming && message.completedAt && (
          <Text
            style={[styles.timestamp, isUser && styles.timestampUser]}
            accessibilityLabel={`Sent at ${new Date(message.completedAt).toLocaleTimeString()}`}
          >
            {new Date(message.completedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        )}
      </Surface>

      {/* Spacer for user messages */}
      {isUser && <View style={styles.userSpacer} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  containerUser: {
    justifyContent: 'flex-end',
  },
  containerLast: {
    marginBottom: spacing.md,
  },
  avatarContainer: {
    marginRight: spacing.xs,
    marginBottom: 4,
  },
  avatar: {
    backgroundColor: colors.surface.primary,
  },
  avatarSpacer: {
    width: 40, // Avatar size + margin
  },
  userSpacer: {
    width: 8,
  },
  bubble: {
    maxWidth: '80%',
    minWidth: 60,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    ...shadows.small,
  },
  bubbleUser: {
    backgroundColor: colors.accent.primary,
    borderBottomRightRadius: borderRadius.sm,
    marginLeft: spacing.xl,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface.primary,
    borderBottomLeftRadius: borderRadius.sm,
    marginRight: spacing.xl,
  },
  bubbleStreaming: {
    borderWidth: 1,
    borderColor: colors.accent.primary + '40',
  },
  bubbleError: {
    borderWidth: 1,
    borderColor: colors.status.error + '40',
  },
  contentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  messageText: {
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextUser: {
    color: colors.text.inverse,
  },
  messageTextError: {
    color: colors.text.primary,
  },
  cursor: {
    marginLeft: 2,
    marginBottom: 4,
  },
  cursorInner: {
    width: 2,
    height: 16,
    backgroundColor: colors.accent.primary,
    borderRadius: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    gap: 4,
    paddingHorizontal: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent.primary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.status.error + '40',
    gap: spacing.xs,
  },
  errorText: {
    color: colors.status.error,
    fontSize: 12,
    flex: 1,
  },
  toolCallsContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.divider,
  },
  toolCallsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  toolCallsIcon: {
    marginRight: spacing.xs,
  },
  toolCallsLabel: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toolCallsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  toolChip: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    height: 28,
  },
  toolChipText: {
    fontSize: 11,
    marginVertical: 0,
    marginHorizontal: 0,
  },
  toolIconContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timestamp: {
    color: colors.text.muted,
    fontSize: 10,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  timestampUser: {
    color: colors.text.inverse + 'AA',
  },
});

export default ChatMessage;
