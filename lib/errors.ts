// lib/errors.ts
// Centralized error handling system with consistent error types and recovery strategies

export enum ErrorType {
  // Authentication errors
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  AUTHORIZATION_DENIED = "AUTHORIZATION_DENIED",
  SESSION_EXPIRED = "SESSION_EXPIRED",

  // Database errors
  DATABASE_CONNECTION_FAILED = "DATABASE_CONNECTION_FAILED",
  DATABASE_QUERY_FAILED = "DATABASE_QUERY_FAILED",
  DATABASE_CONSTRAINT_VIOLATION = "DATABASE_CONSTRAINT_VIOLATION",
  TABLE_NOT_FOUND = "TABLE_NOT_FOUND",

  // API errors
  API_REQUEST_FAILED = "API_REQUEST_FAILED",
  API_TIMEOUT = "API_TIMEOUT",
  API_RATE_LIMITED = "API_RATE_LIMITED",

  // Validation errors
  VALIDATION_FAILED = "VALIDATION_FAILED",
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",

  // File/Upload errors
  FILE_UPLOAD_FAILED = "FILE_UPLOAD_FAILED",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",

  // Network errors
  NETWORK_ERROR = "NETWORK_ERROR",
  CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT",

  // Application errors
  FEATURE_NOT_AVAILABLE = "FEATURE_NOT_AVAILABLE",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",

  // System errors
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",

  // Unknown/Generic
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export enum ErrorSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface RecoveryStrategy {
  type: "retry" | "fallback" | "redirect" | "refresh" | "ignore" | "manual";
  maxRetries?: number;
  retryDelay?: number;
  fallbackValue?: any;
  redirectUrl?: string;
  message?: string;
}

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly recovery: RecoveryStrategy;
  public readonly timestamp: Date;
  public readonly userMessage: string;
  public readonly technicalMessage: string;
  public readonly code?: string;

  constructor({
    type,
    message,
    userMessage,
    severity = ErrorSeverity.MEDIUM,
    context = {},
    recovery = { type: "manual" },
    cause,
    code,
  }: {
    type: ErrorType;
    message: string;
    userMessage?: string;
    severity?: ErrorSeverity;
    context?: ErrorContext;
    recovery?: RecoveryStrategy;
    cause?: Error;
    code?: string;
  }) {
    super(message, { cause });

    this.name = "AppError";
    this.type = type;
    this.severity = severity;
    this.context = context;
    this.recovery = recovery;
    this.timestamp = new Date();
    this.technicalMessage = message;
    this.userMessage = userMessage || this.getDefaultUserMessage(type);
    this.code = code;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  private getDefaultUserMessage(type: ErrorType): string {
    const messages: Record<ErrorType, string> = {
      [ErrorType.AUTHENTICATION_FAILED]:
        "Please check your login credentials and try again.",
      [ErrorType.AUTHORIZATION_DENIED]:
        "You do not have permission to perform this action.",
      [ErrorType.SESSION_EXPIRED]:
        "Your session has expired. Please log in again.",
      [ErrorType.DATABASE_CONNECTION_FAILED]:
        "We are experiencing technical difficulties. Please try again later.",
      [ErrorType.DATABASE_QUERY_FAILED]:
        "Unable to retrieve data. Please try again.",
      [ErrorType.DATABASE_CONSTRAINT_VIOLATION]:
        "The data you entered conflicts with existing records.",
      [ErrorType.TABLE_NOT_FOUND]:
        "This feature is not yet available. Please contact support.",
      [ErrorType.API_REQUEST_FAILED]:
        "Unable to complete your request. Please try again.",
      [ErrorType.API_TIMEOUT]:
        "The request is taking longer than expected. Please try again.",
      [ErrorType.API_RATE_LIMITED]:
        "Too many requests. Please wait a moment and try again.",
      [ErrorType.VALIDATION_FAILED]: "Please check your input and try again.",
      [ErrorType.INVALID_INPUT]: "The information you entered is not valid.",
      [ErrorType.MISSING_REQUIRED_FIELD]: "Please fill in all required fields.",
      [ErrorType.FILE_UPLOAD_FAILED]:
        "Unable to upload file. Please try again.",
      [ErrorType.FILE_TOO_LARGE]:
        "The file is too large. Please choose a smaller file.",
      [ErrorType.INVALID_FILE_TYPE]: "This file type is not supported.",
      [ErrorType.NETWORK_ERROR]:
        "Network connection issue. Please check your internet connection.",
      [ErrorType.CONNECTION_TIMEOUT]: "Connection timed out. Please try again.",
      [ErrorType.FEATURE_NOT_AVAILABLE]:
        "This feature is currently unavailable.",
      [ErrorType.RESOURCE_NOT_FOUND]: "The requested item could not be found.",
      [ErrorType.PERMISSION_DENIED]:
        "You do not have permission to access this resource.",
      [ErrorType.INTERNAL_SERVER_ERROR]:
        "An unexpected error occurred. Please try again later.",
      [ErrorType.SERVICE_UNAVAILABLE]:
        "This service is temporarily unavailable.",
      [ErrorType.CONFIGURATION_ERROR]:
        "System configuration issue. Please contact support.",
      [ErrorType.UNKNOWN_ERROR]:
        "An unexpected error occurred. Please try again.",
    };

    return messages[type] || "An unexpected error occurred. Please try again.";
  }

  public toJSON() {
    return {
      name: this.name,
      type: this.type,
      severity: this.severity,
      message: this.message,
      userMessage: this.userMessage,
      technicalMessage: this.technicalMessage,
      context: this.context,
      recovery: this.recovery,
      timestamp: this.timestamp.toISOString(),
      code: this.code,
      stack: this.stack,
    };
  }
}

// Error factory functions for common scenarios
export const createAuthError = (
  message: string,
  context?: ErrorContext
): AppError => {
  return new AppError({
    type: ErrorType.AUTHENTICATION_FAILED,
    message,
    severity: ErrorSeverity.HIGH,
    context,
    recovery: { type: "redirect", redirectUrl: "/login" },
  });
};

export const createDatabaseError = (
  message: string,
  context?: ErrorContext
): AppError => {
  return new AppError({
    type: ErrorType.DATABASE_QUERY_FAILED,
    message,
    severity: ErrorSeverity.HIGH,
    context,
    recovery: { type: "retry", maxRetries: 3, retryDelay: 1000 },
  });
};

export const createValidationError = (
  message: string,
  context?: ErrorContext
): AppError => {
  return new AppError({
    type: ErrorType.VALIDATION_FAILED,
    message,
    severity: ErrorSeverity.LOW,
    context,
    recovery: { type: "manual" },
  });
};

export const createNetworkError = (
  message: string,
  context?: ErrorContext
): AppError => {
  return new AppError({
    type: ErrorType.NETWORK_ERROR,
    message,
    severity: ErrorSeverity.MEDIUM,
    context,
    recovery: { type: "retry", maxRetries: 3, retryDelay: 2000 },
  });
};

export const createTableNotFoundError = (
  tableName: string,
  context?: ErrorContext
): AppError => {
  return new AppError({
    type: ErrorType.TABLE_NOT_FOUND,
    message: `Table '${tableName}' does not exist`,
    userMessage:
      "This feature requires database setup. Please contact your administrator.",
    severity: ErrorSeverity.HIGH,
    context: { ...context, metadata: { ...context?.metadata, tableName } },
    recovery: {
      type: "manual",
      message: "Database migration required",
    },
  });
};

// Error classification helper
export const classifyError = (error: any): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  // Supabase/PostgreSQL errors
  if (
    error?.message?.includes("relation") &&
    error?.message?.includes("does not exist")
  ) {
    const tableName =
      error.message.match(/relation "([^"]+)" does not exist/)?.[1] ||
      "unknown";
    return createTableNotFoundError(tableName);
  }

  if (error?.message?.includes("JWT")) {
    return createAuthError("Authentication token invalid or expired");
  }

  if (error?.code === "PGRST301") {
    return new AppError({
      type: ErrorType.AUTHORIZATION_DENIED,
      message: error.message || "Access denied",
      severity: ErrorSeverity.MEDIUM,
    });
  }

  // Network errors
  if (error?.name === "TypeError" && error?.message?.includes("fetch")) {
    return createNetworkError("Network request failed");
  }

  if (error?.name === "AbortError") {
    return new AppError({
      type: ErrorType.API_TIMEOUT,
      message: "Request was aborted",
      severity: ErrorSeverity.MEDIUM,
      recovery: { type: "retry", maxRetries: 2 },
    });
  }

  // Generic error
  return new AppError({
    type: ErrorType.UNKNOWN_ERROR,
    message: error?.message || "Unknown error occurred",
    severity: ErrorSeverity.MEDIUM,
    cause: error,
  });
};

// Global error handler for unhandled errors
export const setupGlobalErrorHandling = () => {
  if (typeof window === "undefined") return;

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const error = classifyError(event.reason);
    console.error("Unhandled promise rejection:", error.toJSON());

    // Prevent default browser behavior
    event.preventDefault();

    // Log to monitoring system if available
    if (typeof window !== "undefined" && (window as any).debugTools?.logger) {
      (window as any).debugTools.logger.error(
        "Unhandled promise rejection",
        error.toJSON()
      );
    }
  });

  // Handle uncaught errors
  window.addEventListener("error", (event) => {
    const error = classifyError(event.error);
    console.error("Uncaught error:", error.toJSON());

    // Log to monitoring system if available
    if (typeof window !== "undefined" && (window as any).debugTools?.logger) {
      (window as any).debugTools.logger.error("Uncaught error", error.toJSON());
    }
  });
};
