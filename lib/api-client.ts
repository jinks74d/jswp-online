// lib/api-client.ts
import { logger } from "./logger";
import { perf } from "./performance";

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: Error, attempt: number) => boolean;
}

interface RequestConfig extends RequestInit {
  timeout?: number;
  retry?: Partial<RetryConfig>;
  skipRetry?: boolean;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

interface ApiError extends Error {
  status?: number;
  statusText?: string;
  response?: Response;
  isNetworkError: boolean;
  isTimeoutError: boolean;
  isRetryable: boolean;
}

export class ApiClient {
  private static defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    retryCondition: (error: ApiError, attempt: number) => {
      // Retry on network errors, timeouts, and 5xx status codes
      if (error.isNetworkError || error.isTimeoutError) return true;
      if (error.status && error.status >= 500) return true;
      // Don't retry on 4xx errors (client errors)
      if (error.status && error.status >= 400 && error.status < 500)
        return false;
      return attempt < 3;
    },
  };

  private static createApiError(
    message: string,
    response?: Response,
    originalError?: Error
  ): ApiError {
    const error = new Error(message) as ApiError;
    error.name = "ApiError";

    if (response) {
      error.status = response.status;
      error.statusText = response.statusText;
      error.response = response;
    }

    // Determine error type
    error.isNetworkError = !response && !!originalError;
    error.isTimeoutError =
      originalError?.name === "AbortError" || message.includes("timeout");
    error.isRetryable =
      error.isNetworkError ||
      error.isTimeoutError ||
      (error.status ? error.status >= 500 : false);

    return error;
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
      config.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = delay * 0.1 * Math.random();
    return delay + jitter;
  }

  private static async fetchWithTimeout(
    url: string,
    options: RequestConfig
  ): Promise<Response> {
    const { timeout = 10000, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private static logRequest(
    url: string,
    options: RequestConfig,
    attempt: number = 1
  ) {
    logger.debug("API Request", {
      url,
      method: options.method || "GET",
      attempt,
      timeout: options.timeout,
      hasRetry: !!options.retry,
    });
  }

  private static logResponse(
    url: string,
    response: Response,
    duration: number,
    attempt: number = 1
  ) {
    const logLevel = response.ok ? "debug" : "warn";
    logger[logLevel]("API Response", {
      url,
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
      attempt,
      ok: response.ok,
    });
  }

  private static logError(
    url: string,
    error: ApiError,
    duration: number,
    attempt: number = 1
  ) {
    logger.error("API Request Failed", {
      url,
      error: error.message,
      status: error.status,
      isNetworkError: error.isNetworkError,
      isTimeoutError: error.isTimeoutError,
      isRetryable: error.isRetryable,
      duration: `${duration}ms`,
      attempt,
    });
  }

  static async request<T = any>(
    url: string,
    options: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const retryConfig = { ...this.defaultRetryConfig, ...options.retry };
    const maxAttempts = options.skipRetry ? 1 : retryConfig.maxRetries + 1;

    let lastError: ApiError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startTime = performance.now();

      try {
        this.logRequest(url, options, attempt);

        const response = await this.fetchWithTimeout(url, options);
        const duration = performance.now() - startTime;

        this.logResponse(url, response, duration, attempt);

        if (!response.ok) {
          const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          const apiError = this.createApiError(errorMessage, response);

          // Check if we should retry
          if (
            attempt < maxAttempts &&
            retryConfig.retryCondition?.(apiError, attempt)
          ) {
            this.logError(url, apiError, duration, attempt);
            const delay = this.calculateDelay(attempt, retryConfig);
            logger.info(`Retrying request in ${delay}ms`, { url, attempt });
            await this.delay(delay);
            continue;
          }

          throw apiError;
        }

        // Parse response
        let data: T;
        const contentType = response.headers.get("content-type");

        if (contentType?.includes("application/json")) {
          data = await response.json();
        } else if (contentType?.includes("text/")) {
          data = (await response.text()) as unknown as T;
        } else {
          data = (await response.blob()) as unknown as T;
        }

        return {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        };
      } catch (error) {
        const duration = performance.now() - startTime;

        if (error instanceof Error && error.name === "ApiError") {
          lastError = error as ApiError;
        } else {
          lastError = this.createApiError(
            error instanceof Error ? error.message : "Unknown error",
            undefined,
            error instanceof Error ? error : undefined
          );
        }

        this.logError(url, lastError, duration, attempt);

        // Check if we should retry
        if (
          attempt < maxAttempts &&
          retryConfig.retryCondition?.(lastError, attempt)
        ) {
          const delay = this.calculateDelay(attempt, retryConfig);
          logger.info(`Retrying request in ${delay}ms`, { url, attempt });
          await this.delay(delay);
          continue;
        }

        break;
      }
    }

    throw lastError;
  }

  // Convenience methods
  static async get<T = any>(
    url: string,
    options: Omit<RequestConfig, "method"> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: "GET" });
  }

  static async post<T = any>(
    url: string,
    data?: any,
    options: Omit<RequestConfig, "method" | "body"> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  static async put<T = any>(
    url: string,
    data?: any,
    options: Omit<RequestConfig, "method" | "body"> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  static async patch<T = any>(
    url: string,
    data?: any,
    options: Omit<RequestConfig, "method" | "body"> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  static async delete<T = any>(
    url: string,
    options: Omit<RequestConfig, "method"> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: "DELETE" });
  }

  // Supabase-specific methods
  static async supabaseRequest<T = any>(
    url: string,
    options: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    // Add Supabase-specific headers and error handling
    const supabaseOptions: RequestConfig = {
      ...options,
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        Authorization: `Bearer ${
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
        }`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...options.headers,
      },
      retry: {
        maxRetries: 2, // Fewer retries for Supabase
        baseDelay: 500,
        retryCondition: (error: ApiError) => {
          // Don't retry auth errors or RLS policy violations
          if (error.status === 401 || error.status === 403) return false;
          return error.isRetryable;
        },
        ...options.retry,
      },
    };

    return this.request<T>(url, supabaseOptions);
  }

  // Health check method
  static async healthCheck(url: string = "/api/health"): Promise<boolean> {
    try {
      const response = await this.get(url, {
        timeout: 5000,
        skipRetry: true,
      });
      return response.status === 200;
    } catch (error) {
      logger.warn("Health check failed", { url, error });
      return false;
    }
  }

  // Batch requests
  static async batch<T = any>(
    requests: Array<{ url: string; options?: RequestConfig }>,
    options: { concurrency?: number; failFast?: boolean } = {}
  ): Promise<Array<ApiResponse<T> | ApiError>> {
    const { concurrency = 5, failFast = false } = options;
    const results: Array<ApiResponse<T> | ApiError> = [];

    // Process requests in batches
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);

      const batchPromises = batch.map(async ({ url, options }) => {
        try {
          return await this.request<T>(url, options);
        } catch (error) {
          if (failFast) throw error;
          return error as ApiError;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Check for failures in fail-fast mode
      if (failFast && batchResults.some((result) => result instanceof Error)) {
        break;
      }
    }

    return results;
  }
}

// Export convenience functions
export const api = ApiClient;
