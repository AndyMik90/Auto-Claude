/**
 * TerminalOutput Component
 * Read-only terminal viewer with monospace font, dark background, and scrollable output
 * Supports auto-scroll to bottom for new output and manual scroll to disable auto-scroll
 */

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Text, Surface, IconButton, Chip } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { TerminalOutputLine, OutputLineType, TerminalDisplaySettings } from '../types';
import { colors, spacing, borderRadius, shadows } from '../theme';

/**
 * Props for the TerminalOutput component
 */
interface TerminalOutputProps {
  /** Array of output lines to display */
  lines: TerminalOutputLine[];
  /** Whether the terminal is currently active/receiving output */
  isActive?: boolean;
  /** Display settings for the terminal */
  displaySettings?: Partial<TerminalDisplaySettings>;
  /** Callback when line is tapped (for copy, etc.) */
  onLinePress?: (line: TerminalOutputLine) => void;
  /** Callback when scroll state changes */
  onScrollStateChange?: (isAutoScrollEnabled: boolean) => void;
  /** Initial auto-scroll state */
  initialAutoScroll?: boolean;
  /** Maximum lines to display (for performance) */
  maxLines?: number;
  /** Whether to show the header with controls */
  showHeader?: boolean;
  /** Session name to display in header */
  sessionName?: string;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Font size mapping for display settings
 */
const FONT_SIZES: Record<TerminalDisplaySettings['fontSize'], number> = {
  small: 11,
  medium: 13,
  large: 15,
};

/**
 * Get color for output line type
 */
const getLineColor = (type: OutputLineType): string => {
  const colorMap: Record<OutputLineType, string> = {
    stdout: colors.text.primary,
    stderr: colors.status.error,
    command: colors.accent.primary,
    info: colors.status.info,
    warning: colors.status.warning,
    error: colors.status.error,
    system: colors.text.muted,
  };
  return colorMap[type];
};

/**
 * Get icon for output line type
 */
const getLineIcon = (type: OutputLineType): string | null => {
  const iconMap: Record<OutputLineType, string | null> = {
    stdout: null,
    stderr: 'alert-circle-outline',
    command: 'chevron-right',
    info: 'information-outline',
    warning: 'alert-outline',
    error: 'close-circle-outline',
    system: 'cog-outline',
  };
  return iconMap[type];
};

/**
 * Format timestamp for display
 */
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * New output indicator animation
 */
const NewOutputIndicator: React.FC = () => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Flash the indicator
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1000,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.newOutputIndicator, { opacity }]}
      accessibilityElementsHidden
    >
      <Icon name="arrow-down" size={14} color={colors.accent.primary} />
      <Text style={styles.newOutputText}>New output</Text>
    </Animated.View>
  );
};

/**
 * Single terminal output line component
 */
const TerminalLine: React.FC<{
  line: TerminalOutputLine;
  fontSize: number;
  showTimestamp: boolean;
  showLineNumber: boolean;
  lineNumber: number;
  wordWrap: boolean;
  onPress?: (line: TerminalOutputLine) => void;
}> = React.memo(
  ({ line, fontSize, showTimestamp, showLineNumber, lineNumber, wordWrap, onPress }) => {
    const lineColor = useMemo(() => getLineColor(line.type), [line.type]);
    const lineIcon = useMemo(() => getLineIcon(line.type), [line.type]);

    const handlePress = useCallback(() => {
      if (onPress) {
        onPress(line);
      }
    }, [onPress, line]);

    const accessibilityLabel = useMemo(() => {
      const prefix = line.type === 'command' ? 'Command: ' : '';
      return `${prefix}${line.content}`;
    }, [line.type, line.content]);

    return (
      <View
        style={styles.lineContainer}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="text"
      >
        {/* Line number */}
        {showLineNumber && (
          <Text style={[styles.lineNumber, { fontSize: fontSize - 2 }]}>
            {lineNumber.toString().padStart(4, ' ')}
          </Text>
        )}

        {/* Timestamp */}
        {showTimestamp && (
          <Text style={[styles.timestamp, { fontSize: fontSize - 2 }]}>
            {formatTimestamp(line.timestamp)}
          </Text>
        )}

        {/* Line icon */}
        {lineIcon && (
          <Icon
            name={lineIcon}
            size={fontSize}
            color={lineColor}
            style={styles.lineIcon}
          />
        )}

        {/* Line content */}
        <Text
          style={[
            styles.lineContent,
            { color: lineColor, fontSize },
            wordWrap && styles.lineContentWrap,
            line.type === 'command' && styles.lineCommand,
          ]}
          numberOfLines={wordWrap ? undefined : 1}
          selectable
          onPress={onPress ? handlePress : undefined}
        >
          {line.content}
        </Text>
      </View>
    );
  }
);

TerminalLine.displayName = 'TerminalLine';

/**
 * TerminalOutput Component
 * Renders terminal output with auto-scroll and display customization
 */
export const TerminalOutput: React.FC<TerminalOutputProps> = ({
  lines,
  isActive = false,
  displaySettings,
  onLinePress,
  onScrollStateChange,
  initialAutoScroll = true,
  maxLines = 1000,
  showHeader = true,
  sessionName,
  testID,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(initialAutoScroll);
  const [hasNewOutput, setHasNewOutput] = useState(false);
  const previousLinesCount = useRef(lines.length);
  const contentHeight = useRef(0);
  const scrollViewHeight = useRef(0);
  const scrollPosition = useRef(0);

  // Merge display settings with defaults
  const settings = useMemo<TerminalDisplaySettings>(
    () => ({
      fontSize: displaySettings?.fontSize || 'medium',
      fontFamily: displaySettings?.fontFamily || 'monospace',
      wordWrap: displaySettings?.wordWrap ?? false,
      showTimestamps: displaySettings?.showTimestamps ?? false,
      showLineNumbers: displaySettings?.showLineNumbers ?? false,
      theme: displaySettings?.theme || 'dark',
    }),
    [displaySettings]
  );

  const fontSize = FONT_SIZES[settings.fontSize];

  // Limit displayed lines for performance
  const displayedLines = useMemo(() => {
    if (lines.length <= maxLines) {
      return lines;
    }
    return lines.slice(lines.length - maxLines);
  }, [lines, maxLines]);

  // Handle new output detection and auto-scroll
  useEffect(() => {
    if (lines.length > previousLinesCount.current) {
      if (isAutoScrollEnabled) {
        // Auto-scroll to bottom
        scrollViewRef.current?.scrollToEnd({ animated: true });
      } else {
        // Show new output indicator
        setHasNewOutput(true);
      }
    }
    previousLinesCount.current = lines.length;
  }, [lines.length, isAutoScrollEnabled]);

  // Handle scroll events to detect manual scrolling
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      scrollPosition.current = contentOffset.y;
      contentHeight.current = contentSize.height;
      scrollViewHeight.current = layoutMeasurement.height;

      // Check if user scrolled away from bottom
      const isAtBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y < 50;

      if (isAutoScrollEnabled && !isAtBottom) {
        // User manually scrolled up, disable auto-scroll
        setIsAutoScrollEnabled(false);
        onScrollStateChange?.(false);
      } else if (!isAutoScrollEnabled && isAtBottom) {
        // User scrolled back to bottom, re-enable auto-scroll
        setIsAutoScrollEnabled(true);
        setHasNewOutput(false);
        onScrollStateChange?.(true);
      }
    },
    [isAutoScrollEnabled, onScrollStateChange]
  );

  // Handle scroll to bottom button press
  const handleScrollToBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
    setIsAutoScrollEnabled(true);
    setHasNewOutput(false);
    onScrollStateChange?.(true);
  }, [onScrollStateChange]);

  // Toggle auto-scroll
  const handleToggleAutoScroll = useCallback(() => {
    const newState = !isAutoScrollEnabled;
    setIsAutoScrollEnabled(newState);
    if (newState) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
      setHasNewOutput(false);
    }
    onScrollStateChange?.(newState);
  }, [isAutoScrollEnabled, onScrollStateChange]);

  // Calculate line offset for truncated output
  const lineOffset = lines.length - displayedLines.length;

  return (
    <Surface style={styles.container} elevation={0} testID={testID}>
      {/* Header with controls */}
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* Active indicator */}
            <View
              style={[
                styles.statusIndicator,
                isActive && styles.statusIndicatorActive,
              ]}
              accessibilityLabel={isActive ? 'Terminal active' : 'Terminal idle'}
            />
            {sessionName && (
              <Text style={styles.sessionName} numberOfLines={1}>
                {sessionName}
              </Text>
            )}
          </View>

          <View style={styles.headerRight}>
            {/* Line count */}
            <Chip
              mode="flat"
              style={styles.lineCountChip}
              textStyle={styles.lineCountText}
              compact
            >
              {lines.length.toLocaleString()} lines
            </Chip>

            {/* Auto-scroll toggle */}
            <IconButton
              icon={isAutoScrollEnabled ? 'arrow-collapse-down' : 'arrow-expand-down'}
              size={18}
              iconColor={
                isAutoScrollEnabled ? colors.accent.primary : colors.text.muted
              }
              onPress={handleToggleAutoScroll}
              accessibilityLabel={
                isAutoScrollEnabled ? 'Auto-scroll enabled' : 'Auto-scroll disabled'
              }
              accessibilityHint="Toggle automatic scrolling to new output"
              style={styles.headerButton}
            />
          </View>
        </View>
      )}

      {/* Truncation warning */}
      {lineOffset > 0 && (
        <View style={styles.truncationWarning}>
          <Icon name="information-outline" size={12} color={colors.text.muted} />
          <Text style={styles.truncationText}>
            Showing last {maxLines.toLocaleString()} lines ({lineOffset.toLocaleString()} hidden)
          </Text>
        </View>
      )}

      {/* Terminal output area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        onScroll={handleScroll}
        scrollEventThrottle={16}
        accessibilityLabel="Terminal output"
        accessibilityRole="scrollbar"
      >
        {displayedLines.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon
              name="console-line"
              size={32}
              color={colors.text.muted}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyText}>No output yet</Text>
            <Text style={styles.emptyHint}>
              Terminal output will appear here
            </Text>
          </View>
        ) : (
          displayedLines.map((line, index) => (
            <TerminalLine
              key={line.id}
              line={line}
              fontSize={fontSize}
              showTimestamp={settings.showTimestamps}
              showLineNumber={settings.showLineNumbers}
              lineNumber={lineOffset + index + 1}
              wordWrap={settings.wordWrap}
              onPress={onLinePress}
            />
          ))
        )}
      </ScrollView>

      {/* New output indicator (when not auto-scrolling) */}
      {hasNewOutput && !isAutoScrollEnabled && (
        <NewOutputIndicator />
      )}

      {/* Scroll to bottom FAB (when not at bottom) */}
      {!isAutoScrollEnabled && displayedLines.length > 0 && (
        <IconButton
          icon="chevron-double-down"
          size={24}
          mode="contained"
          containerColor={colors.accent.primary}
          iconColor={colors.text.inverse}
          onPress={handleScrollToBottom}
          style={styles.scrollToBottomButton}
          accessibilityLabel="Scroll to bottom"
          accessibilityHint="Scroll to the latest output and enable auto-scroll"
        />
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.small,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.divider,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.muted,
    marginRight: spacing.xs,
  },
  statusIndicatorActive: {
    backgroundColor: colors.status.success,
  },
  sessionName: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  lineCountChip: {
    backgroundColor: colors.surface.secondary,
    height: 24,
  },
  lineCountText: {
    color: colors.text.muted,
    fontSize: 11,
    marginVertical: 0,
  },
  headerButton: {
    margin: 0,
    marginLeft: spacing.xs,
  },
  truncationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface.secondary,
    gap: spacing.xs,
  },
  truncationText: {
    color: colors.text.muted,
    fontSize: 11,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  emptyHint: {
    color: colors.text.muted,
    fontSize: 12,
  },
  lineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 1,
  },
  lineNumber: {
    color: colors.text.muted,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    width: 40,
    marginRight: spacing.xs,
    textAlign: 'right',
  },
  timestamp: {
    color: colors.text.muted,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    marginRight: spacing.sm,
    opacity: 0.7,
  },
  lineIcon: {
    marginRight: spacing.xs,
    marginTop: 2,
  },
  lineContent: {
    flex: 1,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    lineHeight: 18,
  },
  lineContentWrap: {
    flexWrap: 'wrap',
  },
  lineCommand: {
    fontWeight: '600',
  },
  newOutputIndicator: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    gap: spacing.xs,
    ...shadows.small,
  },
  newOutputText: {
    color: colors.accent.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    ...shadows.medium,
  },
});

export default TerminalOutput;
