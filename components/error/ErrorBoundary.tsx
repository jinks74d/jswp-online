// components/error/ErrorBoundary.tsx
// Enhanced error boundary with recovery strategies and user-friendly error display

"use client";

import React, { Component, ReactNode } from "react";
import {
  AppError,
  ErrorType,
  ErrorSeverity,
  classifyError,
} from "@/lib/errors";
import {
  AlertTriangle,
  RefreshCw,
  Home,
  Bug,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorId: string;
  retryCount: number;
  showDetails: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: AppError, retry: () => void) => ReactNode;
  onError?: (error: AppError, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
  component?: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorId: "",
      retryCount: 0,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const appError = classifyError(error);
    const errorId = `error-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return {
      hasError: true,
      error: appError,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const originalError = classifyError(error);

    // Create new AppError with component context
    const appError = new AppError({
      type: originalError.type,
      message: originalError.technicalMessage,
      userMessage: originalError.userMessage,
      severity: originalError.severity,
      context: {
        ...originalError.context,
        component: this.props.component || "Unknown",
        metadata: {
          ...originalError.context.metadata,
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
        },
      },
      recovery: originalError.recovery,
      cause: originalError.cause instanceof Error ? originalError.cause : error,
      code: originalError.code,
    });

    // Log the error
    logger.error("Error boundary caught error", {
      error: appError.toJSON(),
      errorInfo,
      component: this.props.component,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }

    // Attempt automatic recovery based on error type
    this.attemptRecovery(appError);
  }

  private attemptRecovery = async (error: AppError) => {
    const { recovery } = error;
    const { maxRetries = 3 } = this.props;

    if (recovery.type === "retry" && this.state.retryCount < maxRetries) {
      const delay = recovery.retryDelay || 2000;

      this.retryTimeoutId = setTimeout(() => {
        this.setState((prevState) => ({
          hasError: false,
          error: null,
          retryCount: prevState.retryCount + 1,
        }));
      }, delay);
    }
  };

  private handleManualRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      retryCount: this.state.retryCount + 1,
    });
  };

  private handleGoHome = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/dashboard";
    }
  };

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  private toggleDetails = () => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  };

  private getSeverityColor = (severity: ErrorSeverity): string => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case ErrorSeverity.MEDIUM:
        return "text-orange-600 bg-orange-50 border-orange-200";
      case ErrorSeverity.HIGH:
        return "text-red-600 bg-red-50 border-red-200";
      case ErrorSeverity.CRITICAL:
        return "text-red-800 bg-red-100 border-red-300";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  private getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
      case ErrorSeverity.MEDIUM:
        return <AlertTriangle className="w-6 h-6" />;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return <Bug className="w-6 h-6" />;
      default:
        return <AlertTriangle className="w-6 h-6" />;
    }
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const { error, showDetails, errorId } = this.state;

    // Use custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback(error, this.handleManualRetry);
    }

    const severityColor = this.getSeverityColor(error.severity);
    const severityIcon = this.getSeverityIcon(error.severity);

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {/* Main Error Card */}
          <div className={`rounded-lg border-2 p-6 ${severityColor}`}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">{severityIcon}</div>

              <div className="flex-1">
                <h1 className="text-xl font-semibold mb-2">
                  {error.severity === ErrorSeverity.CRITICAL
                    ? "Critical Error"
                    : error.severity === ErrorSeverity.HIGH
                    ? "Application Error"
                    : "Something went wrong"}
                </h1>

                <p className="text-sm mb-4 opacity-90">{error.userMessage}</p>

                {/* Error ID for support */}
                <p className="text-xs opacity-75 mb-4">Error ID: {errorId}</p>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  {error.recovery.type === "retry" ||
                  error.recovery.type === "manual" ? (
                    <button
                      onClick={this.handleManualRetry}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-current rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Try Again
                    </button>
                  ) : null}

                  <button
                    onClick={this.handleGoHome}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-current rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium"
                  >
                    <Home className="w-4 h-4" />
                    Go to Dashboard
                  </button>

                  <button
                    onClick={this.handleReload}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-current rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reload Page
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Details (Collapsible) */}
          <div className="mt-4">
            <button
              onClick={this.toggleDetails}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              {showDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              {showDetails ? "Hide" : "Show"} Technical Details
            </button>

            {showDetails && (
              <div className="mt-3 bg-white border border-gray-200 rounded-lg p-4">
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">
                      Error Type:
                    </span>
                    <span className="ml-2 text-gray-600">{error.type}</span>
                  </div>

                  <div>
                    <span className="font-medium text-gray-700">Severity:</span>
                    <span className="ml-2 text-gray-600">{error.severity}</span>
                  </div>

                  <div>
                    <span className="font-medium text-gray-700">
                      Component:
                    </span>
                    <span className="ml-2 text-gray-600">
                      {error.context.component || "Unknown"}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium text-gray-700">
                      Timestamp:
                    </span>
                    <span className="ml-2 text-gray-600">
                      {error.timestamp.toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium text-gray-700">
                      Technical Message:
                    </span>
                    <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono text-gray-800">
                      {error.technicalMessage}
                    </div>
                  </div>

                  {error.context.metadata && (
                    <div>
                      <span className="font-medium text-gray-700">
                        Additional Context:
                      </span>
                      <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono text-gray-800">
                        <pre>
                          {JSON.stringify(error.context.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {error.stack && (
                    <div>
                      <span className="font-medium text-gray-700">
                        Stack Trace:
                      </span>
                      <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono text-gray-800 max-h-40 overflow-y-auto">
                        <pre>{error.stack}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Recovery Information */}
          {error.recovery.message && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">
                Recovery Information
              </h3>
              <p className="text-sm text-blue-800">{error.recovery.message}</p>
            </div>
          )}
        </div>
      </div>
    );
  }
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundary
        {...errorBoundaryProps}
        component={Component.displayName || Component.name}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
}
