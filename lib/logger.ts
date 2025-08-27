// lib/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
}

interface LoggerConfig {
  enableConsole: boolean;
  enableRemote: boolean;
  minLevel: LogLevel;
  maxEntries: number;
}

class Logger {
  private sessionId: string;
  private userId?: string;
  private logBuffer: LogEntry[] = [];
  private config: LoggerConfig;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.config = {
      enableConsole: process.env.NODE_ENV === "development",
      enableRemote: process.env.NODE_ENV === "production",
      minLevel: process.env.NODE_ENV === "development" ? "debug" : "info",
      maxEntries: 100,
    };

    // Set up error handlers
    if (typeof window !== "undefined") {
      window.addEventListener("error", this.handleGlobalError.bind(this));
      window.addEventListener(
        "unhandledrejection",
        this.handleUnhandledRejection.bind(this)
      );
    }
  }

  private generateSessionId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private handleGlobalError(event: ErrorEvent) {
    this.error("Global JavaScript Error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent) {
    this.error("Unhandled Promise Rejection", {
      reason: event.reason,
      stack: event.reason?.stack,
    });
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  clearUserId() {
    this.userId = undefined;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentLevelIndex = levels.indexOf(this.config.minLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      context,
    };

    if (this.userId) {
      entry.userId = this.userId;
    }

    if (typeof window !== "undefined") {
      entry.url = window.location.href;
      entry.userAgent = navigator.userAgent;
    }

    return entry;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, message, context);

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.config.maxEntries) {
      this.logBuffer.shift(); // Remove oldest entry
    }

    // Console output
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Remote logging
    if (this.config.enableRemote && level !== "debug") {
      this.sendToRemoteService(entry);
    }
  }

  private logToConsole(entry: LogEntry) {
    const consoleMethod = entry.level === "debug" ? "log" : entry.level;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();

    console[consoleMethod](
      `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`,
      entry.context || ""
    );
  }

  private async sendToRemoteService(entry: LogEntry) {
    try {
      // Batch logs to reduce network requests
      if (this.logBuffer.length >= 5 || entry.level === "error") {
        await this.flushLogs();
      }
    } catch (error) {
      console.error("Failed to send log entry:", error);
    }
  }

  private async flushLogs() {
    if (this.logBuffer.length === 0) return;

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch (error) {
      // Put logs back in buffer if sending failed
      this.logBuffer.unshift(...logsToSend);
      throw error;
    }
  }

  // Public logging methods
  debug(message: string, context?: Record<string, any>) {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, any>) {
    this.log("error", message, context);
  }

  // Specialized logging methods
  authEvent(event: string, context?: Record<string, any>) {
    this.info(`Auth: ${event}`, { ...context, category: "authentication" });
  }

  apiCall(method: string, url: string, duration?: number, status?: number) {
    this.debug("API Call", {
      method,
      url,
      duration: duration ? `${duration}ms` : undefined,
      status,
      category: "api",
    });
  }

  performanceMetric(name: string, value: number, unit: string = "ms") {
    this.info(`Performance: ${name}`, {
      metric: name,
      value,
      unit,
      category: "performance",
    });
  }

  userAction(action: string, context?: Record<string, any>) {
    this.info(`User Action: ${action}`, {
      ...context,
      category: "user_interaction",
    });
  }

  // Utility methods
  getLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  clearLogs() {
    this.logBuffer = [];
  }

  async exportLogs(): Promise<string> {
    const logs = this.getLogs();
    return JSON.stringify(logs, null, 2);
  }

  // Configuration methods
  setConfig(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const logger = new Logger();

// React hook for logging (moved to separate file to avoid JSX in .ts file)
export function useLogger() {
  return logger;
}
