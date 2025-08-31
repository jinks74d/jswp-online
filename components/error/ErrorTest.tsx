// components/error/ErrorTest.tsx
// Test component to verify error handling system works correctly

"use client";

import React from "react";
import { useErrorHandler } from "./ErrorProvider";
import { useAsyncHandler } from "@/lib/async-handler";
import { AppError, ErrorType, ErrorSeverity } from "@/lib/errors";

export function ErrorTest() {
  const { reportError } = useErrorHandler();
  const { execute } = useAsyncHandler();

  const testSyncError = () => {
    try {
      throw new Error("Test synchronous error");
    } catch (error) {
      reportError(error, { component: "ErrorTest", action: "testSyncError" });
    }
  };

  const testAsyncError = async () => {
    const result = await execute(
      async () => {
        throw new AppError({
          type: ErrorType.API_REQUEST_FAILED,
          message: "Test async operation failed",
          severity: ErrorSeverity.MEDIUM,
          context: { component: "ErrorTest", action: "testAsyncError" },
          recovery: { type: "retry", maxRetries: 2, retryDelay: 1000 },
        });
      },
      {
        operationName: "testAsyncError",
        retries: 1,
        context: { metadata: { test: true } },
      }
    );

    if (!result.success) {
      reportError(result.error);
    }
  };

  const testNetworkError = async () => {
    const result = await execute(
      async () => {
        const response = await fetch("/api/nonexistent-endpoint");
        if (!response.ok) {
          throw new AppError({
            type: ErrorType.API_REQUEST_FAILED,
            message: `API request failed with status ${response.status}`,
            severity: ErrorSeverity.HIGH,
            context: {
              metadata: {
                status: response.status,
                endpoint: "/api/nonexistent-endpoint",
              },
            },
            recovery: { type: "manual" },
          });
        }
        return response.json();
      },
      {
        operationName: "testNetworkError",
        timeout: 5000,
        retries: 1,
      }
    );

    if (!result.success) {
      reportError(result.error);
    }
  };

  const testTableNotFoundError = () => {
    const error = new AppError({
      type: ErrorType.TABLE_NOT_FOUND,
      message: 'Table "test_table" does not exist',
      userMessage:
        "This feature requires database setup. Please contact your administrator.",
      severity: ErrorSeverity.HIGH,
      context: { metadata: { tableName: "test_table", operation: "test" } },
      recovery: {
        type: "manual",
        message: "Database migration required",
      },
    });

    reportError(error);
  };

  const testAuthError = () => {
    const error = new AppError({
      type: ErrorType.AUTHENTICATION_FAILED,
      message: "Authentication token expired",
      severity: ErrorSeverity.HIGH,
      context: { component: "ErrorTest" },
      recovery: { type: "redirect", redirectUrl: "/login" },
    });

    reportError(error);
  };

  const testSuccessMessage = () => {
    const error = new AppError({
      type: ErrorType.UNKNOWN_ERROR,
      message: "Operation completed successfully",
      userMessage: "Test operation completed successfully",
      severity: ErrorSeverity.LOW,
      context: { component: "ErrorTest", action: "testSuccess" },
    });

    reportError(error);
  };

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white border border-gray-200 rounded-lg p-4 shadow-lg z-50">
      <h3 className="font-semibold text-sm mb-3">Error Handling Tests</h3>
      <div className="space-y-2">
        <button
          onClick={testSyncError}
          className="block w-full text-left px-3 py-1 text-xs bg-red-50 hover:bg-red-100 rounded border border-red-200 text-red-700"
        >
          Test Sync Error
        </button>

        <button
          onClick={testAsyncError}
          className="block w-full text-left px-3 py-1 text-xs bg-orange-50 hover:bg-orange-100 rounded border border-orange-200 text-orange-700"
        >
          Test Async Error
        </button>

        <button
          onClick={testNetworkError}
          className="block w-full text-left px-3 py-1 text-xs bg-yellow-50 hover:bg-yellow-100 rounded border border-yellow-200 text-yellow-700"
        >
          Test Network Error
        </button>

        <button
          onClick={testTableNotFoundError}
          className="block w-full text-left px-3 py-1 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 text-purple-700"
        >
          Test Table Not Found
        </button>

        <button
          onClick={testAuthError}
          className="block w-full text-left px-3 py-1 text-xs bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-blue-700"
        >
          Test Auth Error
        </button>

        <button
          onClick={testSuccessMessage}
          className="block w-full text-left px-3 py-1 text-xs bg-green-50 hover:bg-green-100 rounded border border-green-200 text-green-700"
        >
          Test Success Message
        </button>
      </div>
    </div>
  );
}
