// lib/async-handler.ts
// Comprehensive async operation wrapper with error handling, retries, and recovery strategies

import React from "react";
import { AppError, ErrorType, ErrorSeverity, classifyError } from "./errors";
import { logger } from "./logger";

interface AsyncOperationOptions {
  operationName?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  context?: Record<string, any>;
  onRetry?: (attempt: number, error: AppError) => void;
  onSuccess?: (result: any, duration: number) => void;
  onError?: (error: AppError) => void;
  fallbackValue?: any;
  silent?: boolean; // Don't log errors
}

interface AsyncOperationResult<T> {
  success: boolean;
  data?: T;
  error?: AppError;
  duration: number;
  attempts: number;
}

/**
 * Comprehensive async operation handler with built-in error handling,
 * retries, timeouts, and recovery strategies
 */
export class AsyncHandler {
  /**
   * Execute an async operation with comprehensive error handling
   */
  static async execute<T>(
    operation: () => Promise<T>,
    options: AsyncOperationOptions = {}
  ): Promise<AsyncOperationResult<T>> {
    const {
      operationName = "AsyncOperation",
      timeout = 30000, // 30 seconds default
      retries = 0,
      retryDelay = 1000,
      context = {},
      onRetry,
      onSuccess,
      onError,
      fallbackValue,
      silent = false,
    } = options;

    const startTime = Date.now();
    let attempts = 0;
    let lastError: AppError | null = null;

    const executeWithTimeout = async (): Promise<T> => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(
            new AppError({
              type: ErrorType.API_TIMEOUT,
              message: `Operation '${operationName}' timed out after ${timeout}ms`,
              severity: ErrorSeverity.MEDIUM,
              context: {
                ...context,
                metadata: {
                  ...context.metadata,
                  timeout,
                  operationName,
                },
              },
            })
          );
        }, timeout);

        operation()
          .then((result) => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });
    };

    // Main execution loop with retries
    while (attempts <= retries) {
      attempts++;

      try {
        if (!silent) {
          logger.debug(
            `Executing ${operationName} (attempt ${attempts}/${retries + 1})`,
            {
              context,
              timeout,
            }
          );
        }

        const result = await executeWithTimeout();
        const duration = Date.now() - startTime;

        if (!silent) {
          logger.debug(`${operationName} completed successfully`, {
            duration,
            attempts,
            context,
          });
        }

        if (onSuccess) {
          onSuccess(result, duration);
        }

        return {
          success: true,
          data: result,
          duration,
          attempts,
        };
      } catch (error) {
        const appError = classifyError(error);
        const enhancedError = new AppError({
          type: appError.type,
          message: appError.technicalMessage,
          userMessage: appError.userMessage,
          severity: appError.severity,
          context: {
            ...appError.context,
            ...context,
            metadata: {
              ...appError.context.metadata,
              operationName,
              attempt: attempts,
              maxAttempts: retries + 1,
            },
          },
          recovery: appError.recovery,
          cause: appError.cause instanceof Error ? appError.cause : undefined,
          code: appError.code,
        });

        lastError = enhancedError;

        // Check if we should retry
        if (attempts <= retries && this.shouldRetry(enhancedError)) {
          if (!silent) {
            logger.warn(
              `${operationName} failed, retrying in ${retryDelay}ms`,
              {
                error: enhancedError.toJSON(),
                attempt: attempts,
                maxAttempts: retries + 1,
              }
            );
          }

          if (onRetry) {
            onRetry(attempts, enhancedError);
          }

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }

        // No more retries, handle the error
        break;
      }
    }

    // Operation failed after all retries
    const duration = Date.now() - startTime;

    if (!silent && lastError) {
      logger.error(`${operationName} failed after ${attempts} attempts`, {
        error: lastError.toJSON(),
        duration,
        context,
      });
    }

    if (onError && lastError) {
      onError(lastError);
    }

    // Try to use fallback value if available
    if (fallbackValue !== undefined) {
      if (!silent) {
        logger.info(`Using fallback value for ${operationName}`, {
          fallbackValue,
          context,
        });
      }

      return {
        success: false,
        data: fallbackValue,
        error: lastError || undefined,
        duration,
        attempts,
      };
    }

    return {
      success: false,
      error:
        lastError ||
        new AppError({
          type: ErrorType.UNKNOWN_ERROR,
          message: `${operationName} failed with unknown error`,
          context,
        }),
      duration,
      attempts,
    };
  }

  /**
   * Determine if an error should trigger a retry
   */
  private static shouldRetry(error: AppError): boolean {
    // Don't retry validation errors or authorization errors
    const nonRetryableTypes = [
      ErrorType.VALIDATION_FAILED,
      ErrorType.INVALID_INPUT,
      ErrorType.MISSING_REQUIRED_FIELD,
      ErrorType.AUTHORIZATION_DENIED,
      ErrorType.PERMISSION_DENIED,
      ErrorType.RESOURCE_NOT_FOUND,
      ErrorType.FILE_TOO_LARGE,
      ErrorType.INVALID_FILE_TYPE,
    ];

    return !nonRetryableTypes.includes(error.type);
  }

  /**
   * Execute multiple async operations in parallel with error handling
   */
  static async executeParallel<T>(
    operations: Array<() => Promise<T>>,
    options: AsyncOperationOptions & {
      failFast?: boolean; // Stop on first error
      maxConcurrency?: number;
    } = {}
  ): Promise<{
    results: Array<AsyncOperationResult<T>>;
    success: boolean;
    errors: AppError[];
  }> {
    const {
      failFast = false,
      maxConcurrency = operations.length,
      ...baseOptions
    } = options;

    const results: Array<AsyncOperationResult<T>> = [];
    const errors: AppError[] = [];

    // Execute operations in batches based on maxConcurrency
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);

      const batchPromises = batch.map((operation, index) =>
        this.execute(operation, {
          ...baseOptions,
          operationName: `${baseOptions.operationName || "ParallelOperation"}_${
            i + index
          }`,
        })
      );

      if (failFast) {
        try {
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);

          // Check for errors in this batch
          const batchErrors = batchResults
            .filter((r) => !r.success)
            .map((r) => r.error!)
            .filter(Boolean);
          if (batchErrors.length > 0) {
            errors.push(...batchErrors);
            break; // Stop processing remaining batches
          }
        } catch (error) {
          const appError = classifyError(error);
          errors.push(appError);
          break;
        }
      } else {
        // Use allSettled to continue even if some operations fail
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            results.push(result.value);
            if (!result.value.success && result.value.error) {
              errors.push(result.value.error);
            }
          } else {
            const appError = classifyError(result.reason);
            errors.push(appError);
            results.push({
              success: false,
              error: appError,
              duration: 0,
              attempts: 1,
            });
          }
        }
      }
    }

    return {
      results,
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute operations in sequence with error handling
   */
  static async executeSequence<T>(
    operations: Array<() => Promise<T>>,
    options: AsyncOperationOptions & {
      stopOnError?: boolean;
    } = {}
  ): Promise<{
    results: Array<AsyncOperationResult<T>>;
    success: boolean;
    errors: AppError[];
  }> {
    const { stopOnError = true, ...baseOptions } = options;
    const results: Array<AsyncOperationResult<T>> = [];
    const errors: AppError[] = [];

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];

      const result = await this.execute(operation, {
        ...baseOptions,
        operationName: `${
          baseOptions.operationName || "SequenceOperation"
        }_${i}`,
      });

      results.push(result);

      if (!result.success && result.error) {
        errors.push(result.error);

        if (stopOnError) {
          break;
        }
      }
    }

    return {
      results,
      success: errors.length === 0,
      errors,
    };
  }
}

/**
 * Decorator for automatic error handling in class methods
 */
export function handleAsync(options: AsyncOperationOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await AsyncHandler.execute(
        () => originalMethod.apply(this, args),
        {
          operationName: `${target.constructor.name}.${propertyKey}`,
          ...options,
        }
      );

      if (!result.success && result.error) {
        throw result.error;
      }

      return result.data;
    };

    return descriptor;
  };
}
/**
 * Hook for React components to handle async operations
 */
export function useAsyncHandler() {
  const execute = React.useCallback(
    <T>(operation: () => Promise<T>, options?: AsyncOperationOptions) => {
      return AsyncHandler.execute(operation, options);
    },
    []
  );

  const executeParallel = React.useCallback(
    <T>(
      operations: Array<() => Promise<T>>,
      options?: AsyncOperationOptions & {
        failFast?: boolean;
        maxConcurrency?: number;
      }
    ) => {
      return AsyncHandler.executeParallel(operations, options);
    },
    []
  );

  const executeSequence = React.useCallback(
    <T>(
      operations: Array<() => Promise<T>>,
      options?: AsyncOperationOptions & { stopOnError?: boolean }
    ) => {
      return AsyncHandler.executeSequence(operations, options);
    },
    []
  );

  return {
    execute,
    executeParallel,
    executeSequence,
  };
}
