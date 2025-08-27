// lib/monitoring.ts
import { logger } from "./logger";
import { perf } from "./performance";

export interface AlertThreshold {
  metric: string;
  threshold: number;
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  window: number; // Time window in milliseconds
  severity: "low" | "medium" | "high" | "critical";
}

export interface MonitoringConfig {
  enabled: boolean;
  alertThresholds: AlertThreshold[];
  reportingInterval: number;
  maxMetricsHistory: number;
}

interface MetricValue {
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface Alert {
  id: string;
  metric: string;
  threshold: AlertThreshold;
  value: number;
  timestamp: number;
  severity: string;
  message: string;
  resolved: boolean;
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    metric: "error_rate",
    threshold: 0.05, // 5% error rate
    operator: "gt",
    window: 5 * 60 * 1000, // 5 minutes
    severity: "high",
  },
  {
    metric: "response_time",
    threshold: 2000, // 2 seconds
    operator: "gt",
    window: 2 * 60 * 1000, // 2 minutes
    severity: "medium",
  },
  {
    metric: "memory_usage",
    threshold: 100 * 1024 * 1024, // 100MB
    operator: "gt",
    window: 1 * 60 * 1000, // 1 minute
    severity: "medium",
  },
  {
    metric: "bundle_size",
    threshold: 1024 * 1024, // 1MB
    operator: "gt",
    window: 0, // Immediate
    severity: "low",
  },
  {
    metric: "auth_failures",
    threshold: 10,
    operator: "gt",
    window: 10 * 60 * 1000, // 10 minutes
    severity: "high",
  },
  {
    metric: "page_load_time",
    threshold: 3000, // 3 seconds
    operator: "gt",
    window: 1 * 60 * 1000, // 1 minute
    severity: "medium",
  },
];

export class MonitoringSystem {
  private static instance: MonitoringSystem;
  private config: MonitoringConfig;
  private metrics: Map<string, MetricValue[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private reportingTimer?: NodeJS.Timeout;

  static getInstance(): MonitoringSystem {
    if (!MonitoringSystem.instance) {
      MonitoringSystem.instance = new MonitoringSystem();
    }
    return MonitoringSystem.instance;
  }

  constructor() {
    this.config = {
      enabled: process.env.NODE_ENV === "production",
      alertThresholds: DEFAULT_ALERT_THRESHOLDS,
      reportingInterval: 5 * 60 * 1000, // 5 minutes
      maxMetricsHistory: 1000,
    };

    if (this.config.enabled) {
      this.startReporting();
      this.initializeMetricCollection();
    }
  }

  private initializeMetricCollection() {
    // Collect error rate metrics
    this.collectErrorRate();

    // Collect performance metrics
    this.collectPerformanceMetrics();

    // Collect memory metrics
    this.collectMemoryMetrics();

    // Collect authentication metrics
    this.collectAuthMetrics();
  }

  private collectErrorRate() {
    let errorCount = 0;
    let totalRequests = 0;

    // Override console.error to track errors
    const originalError = console.error;
    console.error = (...args) => {
      errorCount++;
      this.recordMetric("errors", 1);
      originalError.apply(console, args);
    };

    // Track API requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      totalRequests++;
      try {
        const response = await originalFetch.apply(window, args);
        if (!response.ok) {
          errorCount++;
          this.recordMetric("api_errors", 1);
        }
        return response;
      } catch (error) {
        errorCount++;
        this.recordMetric("api_errors", 1);
        throw error;
      }
    };

    // Calculate error rate every minute
    setInterval(() => {
      if (totalRequests > 0) {
        const errorRate = errorCount / totalRequests;
        this.recordMetric("error_rate", errorRate);

        // Reset counters
        errorCount = 0;
        totalRequests = 0;
      }
    }, 60 * 1000);
  }

  private collectPerformanceMetrics() {
    // Collect page load times
    if (typeof window !== "undefined" && "performance" in window) {
      window.addEventListener("load", () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType(
            "navigation"
          )[0] as PerformanceNavigationTiming;
          if (navigation) {
            const pageLoadTime =
              navigation.loadEventEnd - navigation.navigationStart;
            this.recordMetric("page_load_time", pageLoadTime);
          }
        }, 0);
      });

      // Collect API response times
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.includes("/api/")) {
            this.recordMetric("response_time", entry.duration);
          }
        }
      });

      try {
        observer.observe({ entryTypes: ["measure", "navigation"] });
      } catch (error) {
        logger.warn("Failed to observe performance entries", { error });
      }
    }
  }

  private collectMemoryMetrics() {
    if (typeof window !== "undefined" && "memory" in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.recordMetric("memory_usage", memory.usedJSHeapSize);
        this.recordMetric("memory_total", memory.totalJSHeapSize);
        this.recordMetric("memory_limit", memory.jsHeapSizeLimit);
      }, 30 * 1000); // Every 30 seconds
    }
  }

  private collectAuthMetrics() {
    let authFailures = 0;
    let authSuccesses = 0;

    // Listen for auth events from logger
    const originalAuthEvent = logger.authEvent;
    logger.authEvent = (event: string, context?: Record<string, any>) => {
      if (event.includes("failed") || event.includes("error")) {
        authFailures++;
        this.recordMetric("auth_failures", authFailures);
      } else if (event.includes("success") || event.includes("login")) {
        authSuccesses++;
        this.recordMetric("auth_successes", authSuccesses);
      }

      originalAuthEvent.call(logger, event, context);
    };

    // Reset counters every 10 minutes
    setInterval(() => {
      authFailures = 0;
      authSuccesses = 0;
    }, 10 * 60 * 1000);
  }

  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    if (!this.config.enabled) return;

    const metricValue: MetricValue = {
      value,
      timestamp: Date.now(),
      metadata,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name)!;
    values.push(metricValue);

    // Limit history size
    if (values.length > this.config.maxMetricsHistory) {
      values.shift();
    }

    // Check thresholds
    this.checkThresholds(name, value);
  }

  private checkThresholds(metricName: string, value: number) {
    const relevantThresholds = this.config.alertThresholds.filter(
      (threshold) => threshold.metric === metricName
    );

    for (const threshold of relevantThresholds) {
      const shouldAlert = this.evaluateThreshold(threshold, value);

      if (shouldAlert) {
        this.triggerAlert(metricName, threshold, value);
      }
    }
  }

  private evaluateThreshold(threshold: AlertThreshold, value: number): boolean {
    switch (threshold.operator) {
      case "gt":
        return value > threshold.threshold;
      case "gte":
        return value >= threshold.threshold;
      case "lt":
        return value < threshold.threshold;
      case "lte":
        return value <= threshold.threshold;
      case "eq":
        return value === threshold.threshold;
      default:
        return false;
    }
  }

  private triggerAlert(
    metricName: string,
    threshold: AlertThreshold,
    value: number
  ) {
    const alertId = `${metricName}-${threshold.severity}-${Date.now()}`;

    const alert: Alert = {
      id: alertId,
      metric: metricName,
      threshold,
      value,
      timestamp: Date.now(),
      severity: threshold.severity,
      message: this.generateAlertMessage(metricName, threshold, value),
      resolved: false,
    };

    this.alerts.set(alertId, alert);

    // Log the alert
    logger.warn("Performance Alert Triggered", {
      alertId,
      metric: metricName,
      value,
      threshold: threshold.threshold,
      severity: threshold.severity,
      category: "monitoring_alert",
    });

    // Send to external monitoring service
    this.sendAlert(alert);
  }

  private generateAlertMessage(
    metricName: string,
    threshold: AlertThreshold,
    value: number
  ): string {
    const unit = this.getMetricUnit(metricName);
    return `${metricName} (${value}${unit}) ${threshold.operator} ${threshold.threshold}${unit}`;
  }

  private getMetricUnit(metricName: string): string {
    const units: Record<string, string> = {
      error_rate: "%",
      response_time: "ms",
      memory_usage: "bytes",
      bundle_size: "bytes",
      page_load_time: "ms",
      auth_failures: "",
      auth_successes: "",
    };

    return units[metricName] || "";
  }

  private async sendAlert(alert: Alert) {
    try {
      // Send to external monitoring service (e.g., Slack, PagerDuty, etc.)
      if (process.env.MONITORING_WEBHOOK_URL) {
        await fetch(process.env.MONITORING_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🚨 ${alert.severity.toUpperCase()} Alert: ${alert.message}`,
            alert,
          }),
        });
      }
    } catch (error) {
      logger.error("Failed to send alert", { alertId: alert.id, error });
    }
  }

  private startReporting() {
    this.reportingTimer = setInterval(() => {
      this.generateReport();
    }, this.config.reportingInterval);
  }

  private generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.getMetricsSummary(),
      alerts: Array.from(this.alerts.values()).filter(
        (alert) => !alert.resolved
      ),
      system: this.getSystemInfo(),
    };

    logger.info("Monitoring Report", report);

    // Send to monitoring dashboard
    this.sendReport(report);
  }

  private getMetricsSummary() {
    const summary: Record<string, any> = {};

    for (const [name, values] of this.metrics.entries()) {
      if (values.length === 0) continue;

      const recentValues = values.filter(
        (v) => Date.now() - v.timestamp < 5 * 60 * 1000 // Last 5 minutes
      );

      if (recentValues.length === 0) continue;

      const nums = recentValues.map((v) => v.value);
      summary[name] = {
        count: nums.length,
        avg: nums.reduce((a, b) => a + b, 0) / nums.length,
        min: Math.min(...nums),
        max: Math.max(...nums),
        latest: nums[nums.length - 1],
      };
    }

    return summary;
  }

  private getSystemInfo() {
    const info: Record<string, any> = {
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      timestamp: Date.now(),
    };

    if (typeof window !== "undefined") {
      info.url = window.location.href;
      info.referrer = document.referrer;

      if ("connection" in navigator) {
        const connection = (navigator as any).connection;
        info.connection = {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
        };
      }
    }

    return info;
  }

  private async sendReport(report: any) {
    try {
      if (process.env.MONITORING_REPORT_URL) {
        await fetch(process.env.MONITORING_REPORT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report),
        });
      }
    } catch (error) {
      logger.error("Failed to send monitoring report", { error });
    }
  }

  // Public API
  getMetrics(
    metricName?: string
  ): Map<string, MetricValue[]> | MetricValue[] | undefined {
    if (metricName) {
      return this.metrics.get(metricName);
    }
    return this.metrics;
  }

  getAlerts(resolved: boolean = false): Alert[] {
    return Array.from(this.alerts.values()).filter(
      (alert) => alert.resolved === resolved
    );
  }

  resolveAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      logger.info("Alert resolved", { alertId });
    }
  }

  updateConfig(config: Partial<MonitoringConfig>) {
    this.config = { ...this.config, ...config };

    if (config.enabled === false && this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = undefined;
    } else if (config.enabled === true && !this.reportingTimer) {
      this.startReporting();
    }
  }

  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  // Cleanup
  destroy() {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
    }
    this.metrics.clear();
    this.alerts.clear();
  }
}

// Singleton instance
export const monitoring = MonitoringSystem.getInstance();

// React hook for monitoring
export function useMonitoring() {
  return monitoring;
}
