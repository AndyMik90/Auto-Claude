import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Apple HIG-inspired error boundary component
 *
 * Key principles:
 * - Graceful error handling that prevents app crashes
 * - Clear, friendly error messaging
 * - Obvious recovery action (Try Again button)
 * - Visual hierarchy with icon, title, and details
 * - Proper spacing and rounded corners
 * - Accessible and user-friendly
 *
 * Prevents the entire page from crashing when a component fails.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="border-destructive m-4">
          <CardContent className="pt-6">
            {/* Apple-style error display with clear visual hierarchy */}
            <div className="flex flex-col items-center gap-4 text-center">
              {/* Error icon - prominent but not alarming */}
              <AlertTriangle className="h-12 w-12 text-destructive" strokeWidth={1.5} />
              <div className="space-y-2">
                {/* Clear error title */}
                <h3 className="font-semibold text-lg">Something went wrong</h3>
                {/* Friendly explanation */}
                <p className="text-sm text-muted-foreground">
                  An error occurred while rendering this content.
                </p>
                {/* Technical details for debugging */}
                {this.state.error && (
                  <p className="text-xs text-muted-foreground font-mono bg-muted p-3 rounded-xl max-w-md overflow-auto">
                    {this.state.error.message}
                  </p>
                )}
              </div>
              {/* Recovery action - prominent button */}
              <Button onClick={this.handleReset} variant="outline" size="sm" className="tap-target">
                <RefreshCw className="h-4 w-4 mr-2" strokeWidth={2} />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
