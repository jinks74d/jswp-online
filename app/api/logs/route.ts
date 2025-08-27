// app/api/logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
}

interface LogBatch {
  logs: LogEntry[];
}

export async function POST(request: NextRequest) {
  try {
    const batch: LogBatch = await request.json();

    if (!batch.logs || !Array.isArray(batch.logs)) {
      return NextResponse.json(
        { error: "Invalid log batch format" },
        { status: 400 }
      );
    }

    // Process each log entry
    for (const logEntry of batch.logs) {
      if (!isValidLogEntry(logEntry)) {
        logger.warn("Invalid log entry received", { logEntry });
        continue;
      }

      // Log server-side with additional context
      logger[logEntry.level](`Client: ${logEntry.message}`, {
        ...logEntry.context,
        clientTimestamp: logEntry.timestamp,
        userId: logEntry.userId,
        sessionId: logEntry.sessionId,
        url: logEntry.url,
        userAgent: logEntry.userAgent,
        category: "client_log",
      });

      // Handle special log types
      if (logEntry.level === "error") {
        await handleErrorLog(logEntry);
      }

      if (logEntry.context?.category === "performance") {
        await handlePerformanceLog(logEntry);
      }

      if (logEntry.context?.category === "authentication") {
        await handleAuthLog(logEntry);
      }
    }

    // In production, you might want to:
    // 1. Store logs in a time-series database
    // 2. Send to log aggregation service (ELK, Splunk, etc.)
    // 3. Trigger alerts based on log patterns

    if (process.env.NODE_ENV === "production") {
      await sendToLogAggregationService(batch.logs);
      await checkForLogPatterns(batch.logs);
    }

    return NextResponse.json({
      success: true,
      processed: batch.logs.length,
    });
  } catch (error) {
    logger.error("Failed to process log batch", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to process log batch" },
      { status: 500 }
    );
  }
}

function isValidLogEntry(entry: any): entry is LogEntry {
  return (
    entry &&
    typeof entry === "object" &&
    typeof entry.level === "string" &&
    ["debug", "info", "warn", "error"].includes(entry.level) &&
    typeof entry.message === "string" &&
    typeof entry.timestamp === "string"
  );
}

async function handleErrorLog(logEntry: LogEntry) {
  // Count error frequency
  const errorKey = `error:${logEntry.message}`;

  // In a real implementation, you might use Redis or a database
  // to track error frequencies and trigger alerts

  logger.warn("Client error logged", {
    message: logEntry.message,
    context: logEntry.context,
    userId: logEntry.userId,
    category: "client_error_tracking",
  });
}

async function handlePerformanceLog(logEntry: LogEntry) {
  const { metric, value, unit } = logEntry.context || {};

  if (metric && typeof value === "number") {
    // Track performance metrics
    logger.info("Performance metric received", {
      metric,
      value,
      unit,
      userId: logEntry.userId,
      url: logEntry.url,
      category: "performance_tracking",
    });

    // Check for performance thresholds
    const thresholds: Record<string, number> = {
      page_load_time: 3000,
      api_response_time: 2000,
      render_time: 1000,
    };

    const threshold = thresholds[metric];
    if (threshold && value > threshold) {
      logger.warn("Performance threshold exceeded", {
        metric,
        value,
        threshold,
        userId: logEntry.userId,
        url: logEntry.url,
        category: "performance_alert",
      });
    }
  }
}

async function handleAuthLog(logEntry: LogEntry) {
  const { event } = logEntry.context || {};

  // Track authentication events
  logger.info("Auth event received", {
    event,
    userId: logEntry.userId,
    sessionId: logEntry.sessionId,
    url: logEntry.url,
    category: "auth_tracking",
  });

  // Check for suspicious auth patterns
  if (event && event.includes("failed")) {
    // In a real implementation, you might track failed login attempts
    // and trigger security alerts
    logger.warn("Authentication failure logged", {
      event,
      userId: logEntry.userId,
      sessionId: logEntry.sessionId,
      category: "security_alert",
    });
  }
}

async function sendToLogAggregationService(logs: LogEntry[]) {
  // Example implementation for ELK stack or similar
  if (process.env.LOG_AGGREGATION_URL) {
    try {
      await fetch(process.env.LOG_AGGREGATION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LOG_AGGREGATION_TOKEN}`,
        },
        body: JSON.stringify({
          logs: logs.map((log) => ({
            ...log,
            source: "jswp-web-client",
            environment: process.env.NODE_ENV,
            timestamp: new Date(log.timestamp).toISOString(),
          })),
        }),
      });
    } catch (error) {
      logger.warn("Failed to send logs to aggregation service", { error });
    }
  }
}

async function checkForLogPatterns(logs: LogEntry[]) {
  // Check for concerning patterns in the logs
  const errorLogs = logs.filter((log) => log.level === "error");
  const authFailures = logs.filter(
    (log) =>
      log.context?.category === "authentication" &&
      log.context?.event?.includes("failed")
  );

  // Alert on high error rates
  if (errorLogs.length > 5) {
    logger.warn("High error rate detected in log batch", {
      errorCount: errorLogs.length,
      totalLogs: logs.length,
      category: "pattern_alert",
    });
  }

  // Alert on multiple auth failures
  if (authFailures.length > 3) {
    logger.warn("Multiple authentication failures detected", {
      failureCount: authFailures.length,
      category: "security_alert",
    });
  }

  // Check for performance degradation
  const performanceLogs = logs.filter(
    (log) =>
      log.context?.category === "performance" && log.context?.value > 2000 // Slow operations
  );

  if (performanceLogs.length > 2) {
    logger.warn("Performance degradation detected", {
      slowOperations: performanceLogs.length,
      category: "performance_alert",
    });
  }
}
