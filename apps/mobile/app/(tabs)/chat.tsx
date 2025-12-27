/**
 * Chat Screen (Insights)
 * AI chat interface with multi-session support
 * Includes session sidebar/drawer, message list with streaming support, and input field
 */

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  TextInput as RNTextInput,
} from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  TextInput,
  Divider,
  Portal,
  Modal,
  Menu,
  ActivityIndicator,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ChatMessage, EmptyState } from '../../components';
import {
  useChatStore,
  useCurrentSession,
  useCurrentMessages,
  useRecentSessions,
  useIsStreaming,
} from '../../stores/chatStore';
import type { ChatSession, ChatMessage as ChatMessageType } from '../../types';
import { colors, spacing, borderRadius, shadows } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.8;
const MAX_DRAWER_WIDTH = 320;

/**
 * Mock streaming responses for simulating AI responses
 */
const MOCK_RESPONSES = [
  `I understand you're asking about this. Let me help you with that.

Based on my analysis, here are the key points:

1. **First consideration** - This is an important aspect to keep in mind
2. **Second consideration** - This relates to the overall architecture
3. **Third consideration** - This affects performance and maintainability

Would you like me to elaborate on any of these points?`,
  `Great question! Here's what I found after analyzing the codebase:

The implementation follows a clean architecture pattern with:
- **Separation of concerns** between UI and business logic
- **Type-safe interfaces** for all data models
- **Efficient state management** using Zustand stores

I can help you dive deeper into any of these areas.`,
  `I've investigated this and here are my findings:

\`\`\`typescript
// Example implementation
const solution = {
  approach: 'modular',
  complexity: 'medium',
  maintainability: 'high'
};
\`\`\`

This approach should work well for your use case. Let me know if you need more details!`,
  `Based on the context you've provided, I recommend the following approach:

1. Start by identifying the root cause
2. Create a minimal reproduction
3. Apply the fix incrementally
4. Add tests to prevent regression

Shall I help you implement any of these steps?`,
];

/**
 * Session list item component for the drawer
 */
const SessionListItem: React.FC<{
  session: ChatSession;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}> = React.memo(({ session, isSelected, onPress, onLongPress }) => {
  const messagePreview = useMemo(() => {
    if (session.messages.length === 0) return 'No messages yet';
    const lastMessage = session.messages[session.messages.length - 1];
    return lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '');
  }, [session.messages]);

  const formattedDate = useMemo(() => {
    const date = new Date(session.updatedAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, [session.updatedAt]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.sessionItem,
        isSelected && styles.sessionItemSelected,
        pressed && styles.sessionItemPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Chat session: ${session.name}`}
      accessibilityState={{ selected: isSelected }}
      accessibilityHint="Tap to switch to this session, long press for options"
    >
      <View style={styles.sessionItemIcon}>
        <Icon
          name={isSelected ? 'chat' : 'chat-outline'}
          size={20}
          color={isSelected ? colors.accent.primary : colors.text.muted}
        />
      </View>
      <View style={styles.sessionItemContent}>
        <View style={styles.sessionItemHeader}>
          <Text
            variant="bodyMedium"
            style={[styles.sessionItemName, isSelected && styles.sessionItemNameSelected]}
            numberOfLines={1}
          >
            {session.name}
          </Text>
          <Text variant="labelSmall" style={styles.sessionItemDate}>
            {formattedDate}
          </Text>
        </View>
        <Text variant="bodySmall" style={styles.sessionItemPreview} numberOfLines={1}>
          {messagePreview}
        </Text>
        <View style={styles.sessionItemMeta}>
          <Icon name="message-text-outline" size={12} color={colors.text.muted} />
          <Text variant="labelSmall" style={styles.sessionItemMetaText}>
            {session.messageCount} messages
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

SessionListItem.displayName = 'SessionListItem';

/**
 * Session drawer component for managing chat sessions
 */
const SessionDrawer: React.FC<{
  visible: boolean;
  onClose: () => void;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string) => void;
  currentSessionId: string | null;
  sessions: ChatSession[];
}> = ({
  visible,
  onClose,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  currentSessionId,
  sessions,
}) => {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateX, overlayOpacity]);

  const handleLongPress = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
    setMenuVisible(true);
  }, []);

  const handleMenuDismiss = useCallback(() => {
    setMenuVisible(false);
    setSelectedSessionId(null);
  }, []);

  const handleDelete = useCallback(() => {
    if (selectedSessionId) {
      onDeleteSession(selectedSessionId);
    }
    handleMenuDismiss();
  }, [selectedSessionId, onDeleteSession, handleMenuDismiss]);

  const handleRename = useCallback(() => {
    if (selectedSessionId) {
      onRenameSession(selectedSessionId);
    }
    handleMenuDismiss();
  }, [selectedSessionId, onRenameSession, handleMenuDismiss]);

  if (!visible) return null;

  return (
    <Portal>
      {/* Overlay */}
      <Animated.View style={[styles.drawerOverlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close drawer" />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: Math.min(DRAWER_WIDTH, MAX_DRAWER_WIDTH),
            paddingTop: insets.top,
            transform: [{ translateX }],
          },
        ]}
        accessibilityViewIsModal
        accessibilityRole="menu"
        accessibilityLabel="Chat sessions"
      >
        {/* Drawer Header */}
        <View style={styles.drawerHeader}>
          <Text variant="titleLarge" style={styles.drawerTitle}>
            Sessions
          </Text>
          <IconButton
            icon="plus"
            mode="contained"
            size={20}
            iconColor={colors.text.inverse}
            containerColor={colors.accent.primary}
            onPress={onCreateSession}
            accessibilityLabel="Create new session"
          />
        </View>

        <Divider style={styles.drawerDivider} />

        {/* Session List */}
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SessionListItem
              session={item}
              isSelected={item.id === currentSessionId}
              onPress={() => {
                onSelectSession(item.id);
                onClose();
              }}
              onLongPress={() => handleLongPress(item.id)}
            />
          )}
          contentContainerStyle={styles.sessionList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptySessionList}>
              <Icon name="chat-plus-outline" size={48} color={colors.text.muted} />
              <Text variant="bodyMedium" style={styles.emptySessionText}>
                No sessions yet
              </Text>
              <Text variant="bodySmall" style={styles.emptySessionHint}>
                Tap + to create one
              </Text>
            </View>
          }
        />

        {/* Session Context Menu */}
        <Menu
          visible={menuVisible}
          onDismiss={handleMenuDismiss}
          anchor={{ x: DRAWER_WIDTH / 2, y: 200 }}
          contentStyle={styles.sessionMenu}
        >
          <Menu.Item
            onPress={handleRename}
            title="Rename"
            leadingIcon="pencil-outline"
            titleStyle={styles.menuItemText}
          />
          <Divider />
          <Menu.Item
            onPress={handleDelete}
            title="Delete"
            leadingIcon="trash-can-outline"
            titleStyle={[styles.menuItemText, styles.menuItemDestructive]}
          />
        </Menu>
      </Animated.View>
    </Portal>
  );
};

/**
 * Rename session modal
 */
const RenameSessionModal: React.FC<{
  visible: boolean;
  sessionName: string;
  onDismiss: () => void;
  onRename: (newName: string) => void;
}> = ({ visible, sessionName, onDismiss, onRename }) => {
  const [name, setName] = useState(sessionName);

  useEffect(() => {
    setName(sessionName);
  }, [sessionName]);

  const handleRename = useCallback(() => {
    if (name.trim()) {
      onRename(name.trim());
      onDismiss();
    }
  }, [name, onRename, onDismiss]);

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={styles.renameModal}
    >
      <Text variant="titleMedium" style={styles.renameModalTitle}>
        Rename Session
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        mode="outlined"
        placeholder="Session name"
        style={styles.renameInput}
        outlineColor={colors.surface.border}
        activeOutlineColor={colors.accent.primary}
        textColor={colors.text.primary}
        autoFocus
        selectTextOnFocus
      />
      <View style={styles.renameModalActions}>
        <Pressable onPress={onDismiss} style={styles.renameModalButton}>
          <Text style={styles.renameModalButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleRename}
          style={[styles.renameModalButton, styles.renameModalButtonPrimary]}
        >
          <Text style={[styles.renameModalButtonText, styles.renameModalButtonTextPrimary]}>
            Rename
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
};

/**
 * Chat tab screen component
 * Displays AI chat interface with multi-session support
 */
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<RNTextInput>(null);

  // Store state
  const sessions = useChatStore((state) => state.sessions);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const createSession = useChatStore((state) => state.createSession);
  const switchSession = useChatStore((state) => state.switchSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const renameSession = useChatStore((state) => state.renameSession);
  const addMessage = useChatStore((state) => state.addMessage);
  const startStreamingResponse = useChatStore((state) => state.startStreamingResponse);
  const updateStreamingContent = useChatStore((state) => state.updateStreamingContent);
  const completeStreamingResponse = useChatStore((state) => state.completeStreamingResponse);

  const currentSession = useCurrentSession();
  const messages = useCurrentMessages();
  const recentSessions = useRecentSessions();
  const isStreaming = useIsStreaming();

  // Local state
  const [inputText, setInputText] = useState('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<string | null>(null);

  // Get session name for rename modal
  const sessionNameToRename = useMemo(() => {
    if (!sessionToRename) return '';
    const session = sessions.find((s) => s.id === sessionToRename);
    return session?.name || '';
  }, [sessionToRename, sessions]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Handle sending a message
  const handleSend = useCallback(() => {
    const trimmedText = inputText.trim();
    if (!trimmedText || isStreaming) return;

    // Add user message
    addMessage(trimmedText, 'user');
    setInputText('');
    Keyboard.dismiss();

    // Simulate AI streaming response
    setTimeout(() => {
      // Start streaming
      startStreamingResponse();

      // Get a random mock response
      const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
      let currentIndex = 0;

      // Simulate character-by-character streaming
      const streamInterval = setInterval(() => {
        // Add characters in chunks (3-8 chars at a time for more natural feel)
        const chunkSize = Math.floor(Math.random() * 6) + 3;
        const endIndex = Math.min(currentIndex + chunkSize, response.length);
        const currentContent = response.substring(0, endIndex);

        updateStreamingContent(currentContent);
        currentIndex = endIndex;

        // Complete when done
        if (currentIndex >= response.length) {
          clearInterval(streamInterval);
          setTimeout(() => {
            completeStreamingResponse(response);
          }, 100);
        }
      }, 30); // Fast streaming for demo
    }, 500); // Small delay before AI starts responding
  }, [inputText, isStreaming, addMessage, startStreamingResponse, updateStreamingContent, completeStreamingResponse]);

  // Handle drawer actions
  const handleOpenDrawer = useCallback(() => {
    setDrawerVisible(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerVisible(false);
  }, []);

  const handleCreateSession = useCallback(() => {
    createSession();
    setDrawerVisible(false);
  }, [createSession]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      switchSession(sessionId);
    },
    [switchSession]
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      deleteSession(sessionId);
    },
    [deleteSession]
  );

  const handleOpenRenameModal = useCallback((sessionId: string) => {
    setSessionToRename(sessionId);
    setRenameModalVisible(true);
  }, []);

  const handleRenameSession = useCallback(
    (newName: string) => {
      if (sessionToRename) {
        renameSession(sessionToRename, newName);
      }
      setSessionToRename(null);
    },
    [sessionToRename, renameSession]
  );

  const handleCloseRenameModal = useCallback(() => {
    setRenameModalVisible(false);
    setSessionToRename(null);
  }, []);

  // Render message item
  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessageType; index: number }) => {
      // Show avatar only for first message or when role changes
      const prevMessage = index > 0 ? messages[index - 1] : null;
      const showAvatar = !prevMessage || prevMessage.role !== item.role;
      const isLast = index === messages.length - 1;

      return (
        <ChatMessage
          message={item}
          showAvatar={showAvatar}
          isLast={isLast}
          testID={`chat-message-${item.id}`}
        />
      );
    },
    [messages]
  );

  // Message list key extractor
  const keyExtractor = useCallback((item: ChatMessageType) => item.id, []);

  // Get item layout for performance
  const getItemLayout = useCallback(
    (_data: ArrayLike<ChatMessageType> | null | undefined, index: number) => ({
      length: 80, // Approximate height
      offset: 80 * index,
      index,
    }),
    []
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <Surface style={styles.header} elevation={1} testID="chat-header">
        <View style={[styles.headerContent, { paddingTop: insets.top > 0 ? insets.top : spacing.md }]}>
          <IconButton
            icon="menu"
            size={24}
            iconColor={colors.text.primary}
            onPress={handleOpenDrawer}
            accessibilityLabel="Open session drawer"
          />
          <View style={styles.headerTitleContainer}>
            <Text variant="titleMedium" style={styles.headerTitle} numberOfLines={1}>
              {currentSession?.name || 'Chat'}
            </Text>
            {currentSession && (
              <Text variant="bodySmall" style={styles.headerSubtitle}>
                {currentSession.messageCount} messages
              </Text>
            )}
          </View>
          <IconButton
            icon="plus"
            size={24}
            iconColor={colors.text.primary}
            onPress={handleCreateSession}
            accessibilityLabel="New session"
          />
        </View>
      </Surface>

      {/* Main Content */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Message List */}
        {messages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={Platform.OS === 'android'}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
            accessibilityLabel="Chat messages"
            accessibilityRole="list"
          />
        ) : (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="chat-processing-outline"
              title="Start a Conversation"
              description="Ask Claude anything about your code, tasks, or project"
              compact
            />

            {/* Quick suggestions */}
            <View style={styles.suggestionsContainer}>
              <Text variant="labelMedium" style={styles.suggestionsTitle}>
                Try asking:
              </Text>
              {[
                'Explain the architecture',
                'Review this code',
                'Help me debug an issue',
              ].map((suggestion, index) => (
                <Pressable
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => setInputText(suggestion)}
                  accessibilityRole="button"
                  accessibilityLabel={`Suggestion: ${suggestion}`}
                >
                  <Icon name="lightbulb-outline" size={16} color={colors.accent.primary} />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Input Area */}
        <Surface style={[styles.inputContainer, { paddingBottom: insets.bottom + spacing.sm }]} elevation={2}>
          {/* Streaming indicator */}
          {isStreaming && (
            <View style={styles.streamingIndicator}>
              <ActivityIndicator size={12} color={colors.accent.primary} />
              <Text variant="labelSmall" style={styles.streamingText}>
                Claude is thinking...
              </Text>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              value={inputText}
              onChangeText={setInputText}
              placeholder={isStreaming ? 'Wait for response...' : 'Ask Claude anything...'}
              placeholderTextColor={colors.text.muted}
              mode="outlined"
              style={styles.input}
              outlineColor={colors.surface.border}
              activeOutlineColor={colors.accent.primary}
              textColor={colors.text.primary}
              multiline
              maxLength={4000}
              editable={!isStreaming}
              accessibilityLabel="Message input"
              accessibilityHint="Type your message here"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <IconButton
              icon="send"
              mode="contained"
              size={24}
              iconColor={colors.text.inverse}
              containerColor={inputText.trim() && !isStreaming ? colors.accent.primary : colors.text.disabled}
              onPress={handleSend}
              disabled={!inputText.trim() || isStreaming}
              style={styles.sendButton}
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !inputText.trim() || isStreaming }}
            />
          </View>

          {/* Character count */}
          {inputText.length > 3000 && (
            <Text variant="labelSmall" style={styles.charCount}>
              {inputText.length}/4000
            </Text>
          )}
        </Surface>
      </KeyboardAvoidingView>

      {/* Session Drawer */}
      <SessionDrawer
        visible={drawerVisible}
        onClose={handleCloseDrawer}
        onCreateSession={handleCreateSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleOpenRenameModal}
        currentSessionId={currentSessionId}
        sessions={recentSessions}
      />

      {/* Rename Modal */}
      <RenameSessionModal
        visible={renameModalVisible}
        sessionName={sessionNameToRename}
        onDismiss={handleCloseRenameModal}
        onRename={handleRenameSession}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  // Header styles
  header: {
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: colors.text.secondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  messageList: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  suggestionsContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  suggestionsTitle: {
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  suggestionText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  // Input styles
  inputContainer: {
    backgroundColor: colors.background.secondary,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  streamingText: {
    color: colors.accent.primary,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.background.tertiary,
    fontSize: 15,
  },
  sendButton: {
    marginBottom: 6,
  },
  charCount: {
    color: colors.text.muted,
    textAlign: 'right',
    marginTop: spacing.xs,
    paddingRight: 50,
  },
  // Drawer styles
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 100,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.background.secondary,
    zIndex: 101,
    ...shadows.large,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  drawerTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  drawerDivider: {
    backgroundColor: colors.surface.divider,
  },
  sessionList: {
    paddingVertical: spacing.sm,
  },
  emptySessionList: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  emptySessionText: {
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySessionHint: {
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  // Session item styles
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  sessionItemSelected: {
    backgroundColor: colors.accent.primary + '20',
  },
  sessionItemPressed: {
    backgroundColor: colors.surface.primary,
  },
  sessionItemIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  sessionItemContent: {
    flex: 1,
  },
  sessionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionItemName: {
    color: colors.text.primary,
    fontWeight: '500',
    flex: 1,
    marginRight: spacing.sm,
  },
  sessionItemNameSelected: {
    color: colors.accent.primary,
  },
  sessionItemDate: {
    color: colors.text.muted,
  },
  sessionItemPreview: {
    color: colors.text.secondary,
    marginTop: 2,
  },
  sessionItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: 4,
  },
  sessionItemMetaText: {
    color: colors.text.muted,
  },
  // Menu styles
  sessionMenu: {
    backgroundColor: colors.background.elevated,
  },
  menuItemText: {
    color: colors.text.primary,
  },
  menuItemDestructive: {
    color: colors.status.error,
  },
  // Rename modal styles
  renameModal: {
    backgroundColor: colors.background.elevated,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  renameModalTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  renameInput: {
    backgroundColor: colors.background.tertiary,
  },
  renameModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  renameModalButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  renameModalButtonPrimary: {
    backgroundColor: colors.accent.primary,
  },
  renameModalButtonText: {
    color: colors.text.secondary,
    fontWeight: '500',
  },
  renameModalButtonTextPrimary: {
    color: colors.text.inverse,
  },
});
