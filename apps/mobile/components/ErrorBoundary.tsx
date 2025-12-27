/**
 * ErrorBoundary Component
 * React error boundary that catches render errors and displays a fallback UI
 * Wraps screens to prevent crashes from propagating to the entire app
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { StyleSheet, View, ScrollView, Platform } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius, shadows } from '../theme';

/**
 * Props for the ErrorBoundary component
 */
interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Optional fallback component to render on error */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional screen/component name for logging */
  name?: string;
  /** Whether to show error details in development */
  showDetails?: boolean;
  /** Custom retry action */
  onRetry?: () => void;
}

/**
 * State for the ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Default error fallback UI component
 */
const DefaultErrorFallback: React.FC<{
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry?: () => void;
  showDetails: boolean;
  name?: string;
}> = ({ error, errorInfo, onRetry, showDetails, name }) => {
  const isDev = __DEV__;
  const shouldShowDetails = showDetails && isDev;

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Error occurred${name ? ` in ${name}` : ''}`}
      accessibilityRole="alert"
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Error icon */}
        <View style={styles.iconContainer}>
          <Icon
            name="alert-circle-outline"
            size={64}
            color={colors.status.error}
          />
        </View>

        {/* Error title */}
        <Text variant="titleLarge" style={styles.title}>
          Something went wrong
        </Text>

        {/* Error description */}
        <Text variant="bodyMedium" style={styles.description}>
          {name
            ? `An error occurred in ${name}. Please try again.`
            : 'An unexpected error occurred. Please try again.'}
        </Text>

        {/* Retry button */}
        {onRetry && (
          <Button
            mode="contained"
            onPress={onRetry}
            style={styles.retryButton}
            icon="refresh"
            buttonColor={colors.accent.primary}
            textColor={colors.text.inverse}
            accessibilityLabel="Try again"
            accessibilityHint="Tap to reload this screen"
          >
            Try Again
          </Button>
        )}

        {/* Error details (development only) */}
        {shouldShowDetails && error && (
          <Surface style={styles.detailsSurface} elevation={0}>
            <View style={styles.detailsHeader}>
              <Icon name="bug" size={16} color={colors.status.error} />
              <Text style={styles.detailsTitle}>Error Details</Text>
            </View>

            <Text style={styles.errorName}>{error.name}</Text>
            <Text style={styles.errorMessage}>{error.message}</Text>

            {errorInfo?.componentStack && (
              <View style={styles.stackContainer}>
                <Text style={styles.stackTitle}>Component Stack:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  style={styles.stackScroll}
                >
                  <Text style={styles.stackTrace}>
                    {errorInfo.componentStack}
                  </Text>
                </ScrollView>
              </View>
            )}

            {error.stack && (
              <View style={styles.stackContainer}>
                <Text style={styles.stackTitle}>Stack Trace:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  style={styles.stackScroll}
                >
                  <Text style={styles.stackTrace}>{error.stack}</Text>
                </ScrollView>
              </View>
            )}
          </Surface>
        )}

        {/* Help text */}
        <Text variant="bodySmall" style={styles.helpText}>
          If this problem persists, please restart the app.
        </Text>
      </ScrollView>
    </View>
  );
};

/**
 * ErrorBoundary Class Component
 * Catches JavaScript errors in child component tree and displays fallback UI
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error information
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update state with error info
    this.setState({ errorInfo });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error in development
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught an error:', error);
      // eslint-disable-next-line no-console
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  /**
   * Reset error state (e.g., when retrying)
   */
  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showDetails = true, name } = this.props;

    if (hasError) {
      // If custom fallback provided, use it
      if (fallback) {
        return fallback;
      }

      // Use default error fallback UI
      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          onRetry={this.resetErrorBoundary}
          showDetails={showDetails}
          name={name}
        />
      );
    }

    return children;
  }
}

/**
 * HOC to wrap a component with an ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return ComponentWithErrorBoundary;
}

/**
 * Screen-level ErrorBoundary wrapper
 * Use this to wrap individual screens
 */
export const ScreenErrorBoundary: React.FC<{
  children: ReactNode;
  name?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}> = ({ children, name, onError }) => (
  <ErrorBoundary name={name} onError={onError} showDetails>
    {children}
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    minHeight: '100%',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${colors.status.error}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text.primary,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  retryButton: {
    minWidth: 160,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
  },
  detailsSurface: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.md,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: `${colors.status.error}30`,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  detailsTitle: {
    color: colors.status.error,
    fontSize: 14,
    fontWeight: '600',
  },
  errorName: {
    color: colors.status.error,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    marginBottom: spacing.xs,
  },
  errorMessage: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  stackContainer: {
    marginTop: spacing.sm,
  },
  stackTitle: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  stackScroll: {
    maxHeight: 150,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  stackTrace: {
    color: colors.text.muted,
    fontSize: 10,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    lineHeight: 16,
  },
  helpText: {
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

export default ErrorBoundary;
