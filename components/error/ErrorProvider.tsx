// components/error/ErrorProvider.tsx
// Global error handling provider with toast notifications and recovery strategies

"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
} from "react";
import {
  AppError,
  ErrorType,
  ErrorSeverity,
  classifyError,
  setupGlobalErrorHandling,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  AlertTriangle,
  X,
  RefreshCw,
  CheckCircle,
  Info,
  AlertCircle,
} from "lucide-react";

interface ErrorNotification {
  id: string;
  error: AppError;
  timestamp: Date;
  dismissed?: boolean;
  autoHide?: boolean;
}

interface ErrorContextType {
  notifications: ErrorNotification[];
  reportError: (error: any, context?: any) => void;
  dismissError: (id: string) => void;
  clearAllErrors: () => void;
  retryOperation: (id: string, operation: () => Promise<any>) => Promise<void>;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

export function useErrorHandler() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error("useErrorHandler must be used within an ErrorProvider");
  }
  return context;
}

interface ErrorProviderProps {
  children: React.ReactNode;
  maxNotifications?: number;
  autoHideDelay?: number;
}

export function ErrorProvider({
  children,
  maxNotifications = 5,
  autoHideDelay = 5000,
}: ErrorProviderProps) {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([]);

  // Setup global error handling on mount
  useEffect(() => {
    setupGlobalErrorHandling();
  }, []);

  const reportError = useCallback(
    (error: any, context?: any) => {
      const originalError = classifyError(error);

      const appError = context
        ? new AppError({
            type: originalError.type,
            message: originalError.technicalMessage,
            userMessage: originalError.userMessage,
            severity: originalError.severity,
            context: { ...originalError.context, ...context },
            recovery: originalError.recovery,
            cause:
              originalError.cause instanceof Error
                ? originalError.cause
                : error,
            code: originalError.code,
          })
        : originalError;

      // Log the error
      logger.error("Error reported to ErrorProvider", appError.toJSON());

      // Create notification
      const notification: ErrorNotification = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        error: appError,
        timestamp: new Date(),
        autoHide:
          appError.severity === ErrorSeverity.LOW ||
          appError.severity === ErrorSeverity.MEDIUM,
      };

      setNotifications((prev) => {
        const updated = [notification, ...prev].slice(0, maxNotifications);
        return updated;
      });

      // Auto-hide low/medium severity errors
      if (notification.autoHide) {
        setTimeout(() => {
          dismissError(notification.id);
        }, autoHideDelay);
      }
    },
    [maxNotifications, autoHideDelay]
  );

  const dismissError = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllErrors = useCallback(() => {
    setNotifications([]);
  }, []);

  const retryOperation = useCallback(
    async (id: string, operation: () => Promise<any>) => {
      try {
        await operation();
        dismissError(id);

        // Show success notification
        const successNotification: ErrorNotification = {
          id: `success-${Date.now()}`,
          error: new AppError({
            type: ErrorType.UNKNOWN_ERROR, // We'll use this for success messages
            message: "Operation completed successfully",
            userMessage: "Operation completed successfully",
            severity: ErrorSeverity.LOW,
          }),
          timestamp: new Date(),
          autoHide: true,
        };

        setNotifications((prev) => [
          successNotification,
          ...prev.slice(0, maxNotifications - 1),
        ]);

        setTimeout(() => {
          dismissError(successNotification.id);
        }, 3000);
      } catch (retryError) {
        // Replace the original error with the retry error
        dismissError(id);
        reportError(retryError, { retryAttempt: true });
      }
    },
    [dismissError, reportError, maxNotifications]
  );

  const contextValue: ErrorContextType = {
    notifications,
    reportError,
    dismissError,
    clearAllErrors,
    retryOperation,
  };

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
      <ErrorNotifications />
    </ErrorContext.Provider>
  );
}

function ErrorNotifications() {
  const { notifications, dismissError, retryOperation } = useErrorHandler();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <ErrorNotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={() => dismissError(notification.id)}
          onRetry={(operation) => retryOperation(notification.id, operation)}
        />
      ))}
    </div>
  );
}

interface ErrorNotificationCardProps {
  notification: ErrorNotification;
  onDismiss: () => void;
  onRetry: (operation: () => Promise<any>) => Promise<void>;
}

function ErrorNotificationCard({
  notification,
  onDismiss,
  onRetry,
}: ErrorNotificationCardProps) {
  const { error } = notification;
  const [isRetrying, setIsRetrying] = useState(false);

  const getSeverityStyles = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return {
          container: "bg-blue-50 border-blue-200 text-blue-800",
          icon: <Info className="w-5 h-5 text-blue-600" />,
          button: "text-blue-600 hover:text-blue-800",
        };
      case ErrorSeverity.MEDIUM:
        return {
          container: "bg-yellow-50 border-yellow-200 text-yellow-800",
          icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
          button: "text-yellow-600 hover:text-yellow-800",
        };
      case ErrorSeverity.HIGH:
        return {
          container: "bg-orange-50 border-orange-200 text-orange-800",
          icon: <AlertCircle className="w-5 h-5 text-orange-600" />,
          button: "text-orange-600 hover:text-orange-800",
        };
      case ErrorSeverity.CRITICAL:
        return {
          container: "bg-red-50 border-red-200 text-red-800",
          icon: <AlertCircle className="w-5 h-5 text-red-600" />,
          button: "text-red-600 hover:text-red-800",
        };
      default:
        return {
          container: "bg-gray-50 border-gray-200 text-gray-800",
          icon: <AlertTriangle className="w-5 h-5 text-gray-600" />,
          button: "text-gray-600 hover:text-gray-800",
        };
    }
  };

  // Special handling for success messages
  const isSuccess = error.userMessage.includes("successfully");
  const styles = isSuccess
    ? {
        container: "bg-green-50 border-green-200 text-green-800",
        icon: <CheckCircle className="w-5 h-5 text-green-600" />,
        button: "text-green-600 hover:text-green-800",
      }
    : getSeverityStyles(error.severity);

  const handleRetry = async () => {
    if (error.recovery.type !== "retry" && error.recovery.type !== "manual") {
      return;
    }

    setIsRetrying(true);
    try {
      // This is a placeholder - in a real implementation, you'd need to store
      // the original operation or provide a way to retry it
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onDismiss();
    } catch (retryError) {
      console.error("Retry failed:", retryError);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      className={`rounded-lg border p-4 shadow-lg transition-all duration-300 ${styles.container}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">{styles.icon}</div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{error.userMessage}</p>

          {error.context.component && (
            <p className="text-xs opacity-75 mt-1">
              Component: {error.context.component}
            </p>
          )}

          <p className="text-xs opacity-60 mt-1">
            {notification.timestamp.toLocaleTimeString()}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            {(error.recovery.type === "retry" ||
              error.recovery.type === "manual") &&
              !isSuccess && (
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className={`inline-flex items-center gap-1 text-xs font-medium ${styles.button} disabled:opacity-50`}
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`}
                  />
                  {isRetrying ? "Retrying..." : "Retry"}
                </button>
              )}

            {error.recovery.type === "redirect" &&
              error.recovery.redirectUrl && (
                <button
                  onClick={() =>
                    (window.location.href = error.recovery.redirectUrl!)
                  }
                  className={`text-xs font-medium ${styles.button}`}
                >
                  Go to{" "}
                  {error.recovery.redirectUrl === "/login" ? "Login" : "Page"}
                </button>
              )}

            {error.recovery.type === "refresh" && (
              <button
                onClick={() => window.location.reload()}
                className={`text-xs font-medium ${styles.button}`}
              >
                Refresh Page
              </button>
            )}
          </div>
        </div>

        <button
          onClick={onDismiss}
          className={`flex-shrink-0 ${styles.button} hover:opacity-75`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Higher-order component to wrap components with error handling
export function withErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: (error: AppError, retry: () => void) => React.ReactNode;
    onError?: (error: AppError) => void;
  }
) {
  const WrappedComponent = (props: P) => {
    const { reportError } = useErrorHandler();

    const handleError = useCallback(
      (error: any, errorInfo?: any) => {
        const originalError = classifyError(error);
        const appError = new AppError({
          type: originalError.type,
          message: originalError.technicalMessage,
          userMessage: originalError.userMessage,
          severity: originalError.severity,
          context: {
            ...originalError.context,
            component: Component.displayName || Component.name,
            metadata: {
              ...originalError.context.metadata,
              errorInfo,
            },
          },
          recovery: originalError.recovery,
          cause:
            originalError.cause instanceof Error ? originalError.cause : error,
          code: originalError.code,
        });

        if (options?.onError) {
          options.onError(appError);
        }

        reportError(appError);
      },
      [reportError]
    );

    return (
      <ErrorBoundary
        fallback={options?.fallback}
        onError={handleError}
        component={Component.displayName || Component.name}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorHandling(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
}

// Import ErrorBoundary
import { ErrorBoundary } from "./ErrorBoundary";
