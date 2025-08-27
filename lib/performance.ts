// lib/performance.ts
import { logger } from "./logger";

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  category: string;
  metadata?: Record<string, any>;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private isEnabled: boolean = true;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    if (typeof window !== "undefined") {
      this.initializeObservers();
      this.startMemoryMonitoring();
    }
  }

  private initializeObservers() {
    // Observe navigation timing
    if ("PerformanceObserver" in window) {
      try {
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === "navigation") {
              this.recordNavigationMetrics(
                entry as PerformanceNavigationTiming
              );
            }
          }
        });
        navObserver.observe({ entryTypes: ["navigation"] });
        this.observers.set("navigation", navObserver);
      } catch (error) {
        logger.warn("Failed to initialize navigation observer", { error });
      }

      // Observe paint timing
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric({
              name: entry.name,
              value: entry.startTime,
              unit: "ms",
              timestamp: Date.now(),
              category: "paint",
            });
          }
        });
        paintObserver.observe({ entryTypes: ["paint"] });
        this.observers.set("paint", paintObserver);
      } catch (error) {
        logger.warn("Failed to initialize paint observer", { error });
      }

      // Observe largest contentful paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric({
            name: "largest-contentful-paint",
            value: lastEntry.startTime,
            unit: "ms",
            timestamp: Date.now(),
            category: "paint",
            metadata: {
              element: (lastEntry as any).element?.tagName,
              url: (lastEntry as any).url,
            },
          });
        });
        lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
        this.observers.set("lcp", lcpObserver);
      } catch (error) {
        logger.warn("Failed to initialize LCP observer", { error });
      }

      // Observe cumulative layout shift
      try {
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          if (clsValue > 0) {
            this.recordMetric({
              name: "cumulative-layout-shift",
              value: clsValue,
              unit: "score",
              timestamp: Date.now(),
              category: "layout",
            });
          }
        });
        clsObserver.observe({ entryTypes: ["layout-shift"] });
        this.observers.set("cls", clsObserver);
      } catch (error) {
        logger.warn("Failed to initialize CLS observer", { error });
      }
    }
  }

  private recordNavigationMetrics(entry: PerformanceNavigationTiming) {
    const metrics = [
      {
        name: "dns-lookup",
        value: entry.domainLookupEnd - entry.domainLookupStart,
      },
      { name: "tcp-connect", value: entry.connectEnd - entry.connectStart },
      {
        name: "request-response",
        value: entry.responseEnd - entry.requestStart,
      },
      { name: "dom-processing", value: entry.domComplete - entry.domLoading },
      { name: "page-load", value: entry.loadEventEnd - entry.navigationStart },
      {
        name: "dom-content-loaded",
        value: entry.domContentLoadedEventEnd - entry.navigationStart,
      },
    ];

    metrics.forEach((metric) => {
      if (metric.value > 0) {
        this.recordMetric({
          name: metric.name,
          value: metric.value,
          unit: "ms",
          timestamp: Date.now(),
          category: "navigation",
        });
      }
    });
  }

  private startMemoryMonitoring() {
    if ("memory" in performance) {
      setInterval(() => {
        const memory = (performance as any).memory as MemoryInfo;
        this.recordMetric({
          name: "memory-usage",
          value: memory.usedJSHeapSize,
          unit: "bytes",
          timestamp: Date.now(),
          category: "memory",
          metadata: {
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
            percentage: Math.round(
              (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
            ),
          },
        });
      }, 30000); // Every 30 seconds
    }
  }

  private recordMetric(metric: PerformanceMetric) {
    if (!this.isEnabled) return;

    logger.performanceMetric(metric.name, metric.value, metric.unit);

    // Alert on performance thresholds
    this.checkThresholds(metric);
  }

  private checkThresholds(metric: PerformanceMetric) {
    const thresholds = {
      "page-load": 3000, // 3 seconds
      "largest-contentful-paint": 2500, // 2.5 seconds
      "cumulative-layout-shift": 0.1, // CLS score
      "memory-usage": 100 * 1024 * 1024, // 100MB
    };

    const threshold = thresholds[metric.name as keyof typeof thresholds];
    if (threshold && metric.value > threshold) {
      logger.warn(`Performance threshold exceeded: ${metric.name}`, {
        value: metric.value,
        threshold,
        unit: metric.unit,
        category: "performance_alert",
      });
    }
  }

  // Public API
  startTimer(name: string): void {
    if (!this.isEnabled) return;
    this.metrics.set(name, performance.now());
  }

  endTimer(name: string): number {
    if (!this.isEnabled) return 0;

    const startTime = this.metrics.get(name);
    if (!startTime) {
      logger.warn(`Timer ${name} was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.metrics.delete(name);

    this.recordMetric({
      name,
      value: duration,
      unit: "ms",
      timestamp: Date.now(),
      category: "custom",
    });

    return duration;
  }

  measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.isEnabled) return fn();

    this.startTimer(name);
    return fn().finally(() => this.endTimer(name));
  }

  measureSync<T>(name: string, fn: () => T): T {
    if (!this.isEnabled) return fn();

    this.startTimer(name);
    try {
      return fn();
    } finally {
      this.endTimer(name);
    }
  }

  // React-specific measurements
  measureRender(
    componentName: string,
    renderFn: () => React.ReactElement
  ): React.ReactElement {
    return this.measureSync(`render-${componentName}`, renderFn);
  }

  // Network request measurement
  measureRequest(
    url: string,
    requestFn: () => Promise<Response>
  ): Promise<Response> {
    const requestName = `request-${
      new URL(url, window.location.origin).pathname
    }`;
    return this.measureAsync(requestName, requestFn);
  }

  // Core Web Vitals measurement
  measureCoreWebVitals(): Promise<{
    fcp?: number;
    lcp?: number;
    fid?: number;
    cls?: number;
  }> {
    return new Promise((resolve) => {
      const vitals: any = {};

      // First Contentful Paint
      const fcpEntry = performance.getEntriesByName(
        "first-contentful-paint"
      )[0];
      if (fcpEntry) {
        vitals.fcp = fcpEntry.startTime;
      }

      // Use a timeout to collect metrics
      setTimeout(() => {
        resolve(vitals);
      }, 1000);
    });
  }

  // Memory usage snapshot
  getMemoryUsage(): MemoryInfo | null {
    if ("memory" in performance) {
      return (performance as any).memory;
    }
    return null;
  }

  // Bundle size estimation
  estimateBundleSize(): number {
    const scripts = Array.from(document.querySelectorAll("script[src]"));
    let totalSize = 0;

    scripts.forEach((script) => {
      const src = (script as HTMLScriptElement).src;
      if (src.includes("/_next/static/")) {
        // Estimate based on typical Next.js bundle sizes
        totalSize += 200000; // ~200KB estimate per chunk
      }
    });

    return totalSize;
  }

  // Configuration
  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  // Cleanup
  destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.metrics.clear();
  }
}

// Singleton instance
export const perf = PerformanceMonitor.getInstance();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  return perf;
}

// Higher-order component for automatic render time measurement
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = (props: P) => {
    const name = componentName || Component.name || "UnknownComponent";

    return perf.measureRender(name, () => <Component {...props} />);
  };

  WrappedComponent.displayName = `withPerformanceMonitoring(${
    componentName || Component.name
  })`;
  return WrappedComponent;
}

// Performance monitoring for API calls
export class ApiPerformanceMonitor {
  static async fetch(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const startTime = performance.now();

    try {
      const response = await fetch(url, options);
      const duration = performance.now() - startTime;

      logger.apiCall(options.method || "GET", url, duration, response.status);

      perf.recordMetric({
        name: `api-${options.method || "GET"}-${response.status}`,
        value: duration,
        unit: "ms",
        timestamp: Date.now(),
        category: "api",
        metadata: {
          url,
          status: response.status,
          ok: response.ok,
        },
      });

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;

      logger.error("API Request Failed", {
        url,
        method: options.method || "GET",
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  }
}
