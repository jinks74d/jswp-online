// lib/api-client.ts
// Centralized API client with comprehensive error handling

import { AsyncHandler } from "./async-handler";
import { AppError, ErrorType, ErrorSeverity, classifyError } from "./errors";
import { logger } from "./logger";

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  context?: Record<string, any>;
  silent?: boolean;
}

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  details?: string;
  type?: string;
  status: number;
  headers: Headers;
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number;

  constructor(baseUrl = "", defaultTimeout = 30000) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
  }

  /**
   * Make an API request with comprehensive error handling
   */
  async request<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const {
      method = "GET",
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retries = 1,
      context = {},
      silent = false,
    } = options;

    const result = await AsyncHandler.execute(
      async () => {
        const url = `${this.baseUrl}${endpoint}`;
        const requestHeaders = { ...this.defaultHeaders, ...headers };

        const requestInit: RequestInit = {
          method,
          headers: requestHeaders,
          credentials: "include", // Include cookies for auth
        };

        if (body && method !== "GET") {
          if (typeof body === "object" && !(body instanceof FormData)) {
            requestInit.body = JSON.stringify(body);
          } else {
            requestInit.body = body;
          }
        }

        const response = await fetch(url, requestInit);
        const responseData = await this.parseResponse<T>(response);

        if (!response.ok) {
          throw this.createApiError(response, responseData, {
            endpoint,
            method,
            context,
          });
        }

        // Return the data if it exists, otherwise return the whole response as T
        return (responseData.data ?? responseData) as T;
      },
      {
        operationName: `API ${method} ${endpoint}`,
        timeout,
        retries,
        context: { endpoint, method, ...context },
        silent,
      }
    );

    if (!result.success) {
      throw result.error;
    }

    if (result.data === undefined) {
      throw new AppError({
        type: ErrorType.API_REQUEST_FAILED,
        message: "API request succeeded but returned no data",
        context: { metadata: { endpoint, method } },
      });
    }

    return result.data;
  } /**

   * Parse response and handle different content types
   */
  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get("content-type");
    let data: any;

    try {
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else if (contentType?.includes("text/")) {
        data = await response.text();
      } else {
        data = await response.blob();
      }
    } catch (error) {
      // If parsing fails, create a generic response
      data = {
        error: "Failed to parse response",
        details: `Response parsing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }

    return {
      ...data,
      status: response.status,
      headers: response.headers,
    };
  }

  /**
   * Create appropriate AppError based on response
   */
  private createApiError(
    response: Response,
    responseData: any,
    context: Record<string, any>
  ): AppError {
    const { status } = response;
    const errorMessage =
      responseData?.details ||
      responseData?.error ||
      `Request failed with status ${status}`;

    let errorType: ErrorType;
    let severity: ErrorSeverity;

    // Map HTTP status codes to error types
    switch (status) {
      case 400:
        errorType = ErrorType.VALIDATION_FAILED;
        severity = ErrorSeverity.LOW;
        break;
      case 401:
        errorType = ErrorType.AUTHENTICATION_FAILED;
        severity = ErrorSeverity.HIGH;
        break;
      case 403:
        errorType = ErrorType.AUTHORIZATION_DENIED;
        severity = ErrorSeverity.MEDIUM;
        break;
      case 404:
        errorType = ErrorType.RESOURCE_NOT_FOUND;
        severity = ErrorSeverity.MEDIUM;
        break;
      case 408:
        errorType = ErrorType.API_TIMEOUT;
        severity = ErrorSeverity.MEDIUM;
        break;
      case 429:
        errorType = ErrorType.API_RATE_LIMITED;
        severity = ErrorSeverity.MEDIUM;
        break;
      case 500:
        errorType = ErrorType.INTERNAL_SERVER_ERROR;
        severity = ErrorSeverity.HIGH;
        break;
      case 503:
        errorType =
          responseData?.type === "TABLE_NOT_FOUND"
            ? ErrorType.TABLE_NOT_FOUND
            : ErrorType.SERVICE_UNAVAILABLE;
        severity = ErrorSeverity.HIGH;
        break;
      default:
        errorType = ErrorType.API_REQUEST_FAILED;
        severity = status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
    }

    return new AppError({
      type: errorType,
      message: errorMessage,
      severity,
      context: {
        metadata: {
          ...context,
          status,
          responseData,
          url: response.url,
        },
      },
      recovery: this.getRecoveryStrategy(errorType, status),
    });
  }

  /**
   * Get appropriate recovery strategy based on error type
   */
  private getRecoveryStrategy(errorType: ErrorType, status: number) {
    switch (errorType) {
      case ErrorType.AUTHENTICATION_FAILED:
        return { type: "redirect" as const, redirectUrl: "/login" };

      case ErrorType.API_TIMEOUT:
      case ErrorType.NETWORK_ERROR:
        return { type: "retry" as const, maxRetries: 2, retryDelay: 2000 };

      case ErrorType.API_RATE_LIMITED:
        return { type: "retry" as const, maxRetries: 1, retryDelay: 5000 };

      case ErrorType.TABLE_NOT_FOUND:
        return {
          type: "manual" as const,
          message: "Database setup required - contact administrator",
        };

      case ErrorType.SERVICE_UNAVAILABLE:
        return { type: "retry" as const, maxRetries: 1, retryDelay: 3000 };

      default:
        return { type: "manual" as const };
    }
  }

  // Convenience methods for common HTTP methods
  async get<T = any>(
    endpoint: string,
    options?: Omit<ApiRequestOptions, "method">
  ) {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T = any>(
    endpoint: string,
    body?: any,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) {
    return this.request<T>(endpoint, { ...options, method: "POST", body });
  }

  async put<T = any>(
    endpoint: string,
    body?: any,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) {
    return this.request<T>(endpoint, { ...options, method: "PUT", body });
  }

  async patch<T = any>(
    endpoint: string,
    body?: any,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) {
    return this.request<T>(endpoint, { ...options, method: "PATCH", body });
  }

  async delete<T = any>(
    endpoint: string,
    options?: Omit<ApiRequestOptions, "method">
  ) {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

// Default API client instance
export const apiClient = new ApiClient();

// Hook for using API client in React components
export function useApiClient() {
  return apiClient;
}
