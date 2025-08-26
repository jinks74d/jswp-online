// lib/performance-monitor.ts
"use client";

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'auth' | 'navigation' | 'database' | 'bundle';
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 100;

  // Core Web Vitals monitoring
  private observeWebVitals(): void {
    if (typeof window === 'undefined') return;

    // LCP (Largest Contentful Paint)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.recordMetric('LCP', lastEntry.startTime, 'navigation');
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // FID (First Input Delay) / INP (Interaction to Next Paint)
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (entry.processingStart && entry.startTime) {
          const delay = entry.processingStart - entry.startTime;
          this.recordMetric('FID', delay, 'navigation');
        }
      });
    }).observe({ entryTypes: ['first-input'] });

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      this.recordMetric('CLS', clsValue, 'navigation');
    }).observe({ entryTypes: ['layout-shift'] });
  }

  // Authentication performance tracking
  recordAuthMetric(operation: string, startTime: number): void {
    const duration = performance.now() - startTime;
    this.recordMetric(`auth_${operation}`, duration, 'auth');
  }

  // Database query performance
  recordDatabaseMetric(query: string, startTime: number): void {
    const duration = performance.now() - startTime;
    this.recordMetric(`db_${query}`, duration, 'database');
  }

  // Navigation performance
  recordNavigationMetric(route: string, startTime: number): void {
    const duration = performance.now() - startTime;
    this.recordMetric(`nav_${route}`, duration, 'navigation');
  }

  private recordMetric(name: string, value: number, category: PerformanceMetric['category']): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      category
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log slow operations
    if (category === 'auth' && value > 2000) {
      console.warn(`Slow auth operation: ${name} took ${value.toFixed(2)}ms`);
    } else if (category === 'database' && value > 1000) {
      console.warn(`Slow database query: ${name} took ${value.toFixed(2)}ms`);
    } else if (category === 'navigation' && name === 'LCP' && value > 2500) {
      console.warn(`Poor LCP: ${value.toFixed(2)}ms (target: <2500ms)`);
    }

    // Send to analytics if configured
    this.sendToAnalytics(metric);
  }

  private sendToAnalytics(metric: PerformanceMetric): void {
    // Send to your analytics service
    if ((window as any).gtag) {
      (window as any).gtag('event', 'performance_metric', {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_category: metric.category,
      });
    }

    // Send to custom analytics endpoint
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      }).catch(() => {
        // Fail silently
      });
    }
  }

  // Get performance summary
  getPerformanceSummary(): {
    authMetrics: PerformanceMetric[];
    databaseMetrics: PerformanceMetric[];
    navigationMetrics: PerformanceMetric[];
    averages: Record<string, number>;
    slowest: PerformanceMetric[];
  } {
    const authMetrics = this.metrics.filter(m => m.category === 'auth');
    const databaseMetrics = this.metrics.filter(m => m.category === 'database');
    const navigationMetrics = this.metrics.filter(m => m.category === 'navigation');

    // Calculate averages
    const averages: Record<string, number> = {};
    const grouped = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) acc[metric.name] = [];
      acc[metric.name].push(metric.value);
      return acc;
    }, {} as Record<string, number[]>);

    Object.entries(grouped).forEach(([name, values]) => {
      averages[name] = values.reduce((a, b) => a + b, 0) / values.length;
    });

    // Find slowest operations
    const slowest = this.metrics
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      authMetrics,
      databaseMetrics,
      navigationMetrics,
      averages,
      slowest
    };
  }

  // Clear metrics
  clear(): void {
    this.metrics = [];
  }

  // Initialize monitoring
  init(): void {
    if (typeof window === 'undefined') return;
    
    this.observeWebVitals();
    
    // Monitor route changes
    if (window.history) {
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;
      
      window.history.pushState = (...args) => {
        const start = performance.now();
        originalPushState.apply(window.history, args);
        this.recordNavigationMetric('pushState', start);
      };
      
      window.history.replaceState = (...args) => {
        const start = performance.now();
        originalReplaceState.apply(window.history, args);
        this.recordNavigationMetric('replaceState', start);
      };
    }
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  performanceMonitor.init();
}

export default performanceMonitor;