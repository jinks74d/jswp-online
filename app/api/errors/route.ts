// app/api/errors/route.ts
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const errorReport: ErrorReport = await request.json();

    // Validate required fields
    if (!errorReport.message || !errorReport.timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: message, timestamp" },
        { status: 400 }
      );
    }

    // Log the error server-side
    logger.error("Client Error Report", {
      message: errorReport.message,
      stack: errorReport.stack,
      componentStack: errorReport.componentStack,
      userAgent: errorReport.userAgent,
      url: errorReport.url,
      userId: errorReport.userId,
      sessionId: errorReport.sessionId,
      metadata: errorReport.metadata,
      category: "client_error",
    });

    // In production, you might want to:
    // 1. Store in database for analysis
    // 2. Send to external error tracking service (Sentry, Bugsnag, etc.)
    // 3. Alert development team for critical errors

    if (process.env.NODE_ENV === "production") {
      // Example: Send to external service
      await sendToErrorTrackingService(errorReport);

      // Example: Store in database
      await storeErrorInDatabase(errorReport);

      // Example: Send alert for critical errors
      if (isCriticalError(errorReport)) {
        await sendCriticalErrorAlert(errorReport);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to process error report", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to process error report" },
      { status: 500 }
    );
  }
}

async function sendToErrorTrackingService(errorReport: ErrorReport) {
  // Example implementation for Sentry
  if (process.env.SENTRY_DSN) {
    try {
      // This would typically use the Sentry SDK
      await fetch(`${process.env.SENTRY_DSN}/api/errors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorReport),
      });
    } catch (error) {
      logger.warn("Failed to send error to Sentry", { error });
    }
  }
}

async function storeErrorInDatabase(errorReport: ErrorReport) {
  // Example implementation for database storage
  try {
    // This would typically use your database client (Supabase, Prisma, etc.)
    // await supabase.from('error_logs').insert({
    //   message: errorReport.message,
    //   stack: errorReport.stack,
    //   user_agent: errorReport.userAgent,
    //   url: errorReport.url,
    //   user_id: errorReport.userId,
    //   created_at: errorReport.timestamp,
    //   metadata: errorReport.metadata,
    // });
  } catch (error) {
    logger.warn("Failed to store error in database", { error });
  }
}

function isCriticalError(errorReport: ErrorReport): boolean {
  const criticalPatterns = [
    /authentication/i,
    /payment/i,
    /security/i,
    /data loss/i,
    /corruption/i,
  ];

  return criticalPatterns.some(
    (pattern) =>
      pattern.test(errorReport.message) ||
      (errorReport.stack && pattern.test(errorReport.stack))
  );
}

async function sendCriticalErrorAlert(errorReport: ErrorReport) {
  // Example implementation for Slack webhook
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 Critical Error Detected`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Critical Error:* ${errorReport.message}\n*URL:* ${errorReport.url}\n*Time:* ${errorReport.timestamp}`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Stack Trace:*\n\`\`\`${
                  errorReport.stack?.slice(0, 500) || "No stack trace"
                }\`\`\``,
              },
            },
          ],
        }),
      });
    } catch (error) {
      logger.warn("Failed to send critical error alert", { error });
    }
  }
}
