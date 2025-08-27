// components/DevTools.tsx
"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import { perf } from "@/lib/performance";
import { monitoring } from "@/lib/monitoring";

interface DevToolsProps {
  enabled?: boolean;
}

export function DevTools({
  enabled = process.env.NODE_ENV === "development",
}: DevToolsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "logs" | "performance" | "monitoring"
  >("logs");
  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({});
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!enabled) return;

    // Enable React DevTools features
    if (typeof window !== "undefined") {
      // Enable React concurrent features debugging
      const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (hook) {
        hook.onCommitFiberRoot = (id: any, root: any, priorityLevel: any) => {
          console.log("React commit:", { id, priorityLevel });
        };
      }

      // Add global debugging helpers
      (window as any).debugTools = {
        logger,
        perf,
        monitoring,
        getLogs: () => logger.getLogs(),
        getMetrics: () => monitoring?.getMetrics() || new Map(),
        getAlerts: () => monitoring?.getAlerts() || [],
        clearLogs: () => logger.clearLogs(),
        exportLogs: () => logger.exportLogs(),
      };
    }

    // Update data periodically
    const interval = setInterval(() => {
      setLogs(logger.getLogs().slice(-50)); // Last 50 logs
      setMetrics(monitoring?.getMetrics() || new Map());
      setAlerts(monitoring?.getAlerts() || []);
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled) return null;

  const toggleDevTools = () => setIsOpen(!isOpen);

  const clearLogs = () => {
    logger.clearLogs();
    setLogs([]);
  };

  const exportLogs = async () => {
    const logsData = await logger.exportLogs();
    const blob = new Blob([logsData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatLogLevel = (level: string) => {
    const colors = {
      debug: "text-gray-500",
      info: "text-blue-500",
      warn: "text-yellow-500",
      error: "text-red-500",
    };
    return colors[level as keyof typeof colors] || "text-gray-500";
  };

  const formatMetricValue = (value: any) => {
    if (typeof value === "number") {
      if (value > 1000000) return `${(value / 1000000).toFixed(2)}M`;
      if (value > 1000) return `${(value / 1000).toFixed(2)}K`;
      return value.toFixed(2);
    }
    return String(value);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggleDevTools}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="Toggle Dev Tools"
      >
        🛠️
      </button>

      {/* Dev Tools Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-end">
          <div className="bg-white w-full h-2/3 rounded-t-lg shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex space-x-4">
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`px-3 py-1 rounded ${
                    activeTab === "logs"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Logs ({logs.length})
                </button>
                <button
                  onClick={() => setActiveTab("performance")}
                  className={`px-3 py-1 rounded ${
                    activeTab === "performance"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Performance
                </button>
                <button
                  onClick={() => setActiveTab("monitoring")}
                  className={`px-3 py-1 rounded ${
                    activeTab === "monitoring"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Monitoring ({alerts.length})
                </button>
              </div>
              <button
                onClick={toggleDevTools}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "logs" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b flex space-x-2">
                    <button
                      onClick={clearLogs}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm"
                    >
                      Clear Logs
                    </button>
                    <button
                      onClick={exportLogs}
                      className="px-3 py-1 bg-green-500 text-white rounded text-sm"
                    >
                      Export Logs
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                    {logs.map((log, index) => (
                      <div key={index} className="mb-2 border-b pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400 text-xs">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className={`font-bold ${formatLogLevel(log.level)}`}
                          >
                            [{log.level.toUpperCase()}]
                          </span>
                          <span>{log.message}</span>
                        </div>
                        {log.context && (
                          <pre className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <div className="text-gray-500 text-center py-8">
                        No logs available
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "performance" && (
                <div className="h-full overflow-auto p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(metrics).map(
                      ([name, values]: [string, any]) => {
                        if (!Array.isArray(values) || values.length === 0)
                          return null;

                        const latest = values[values.length - 1];
                        const avg =
                          values.reduce(
                            (sum: number, v: any) => sum + v.value,
                            0
                          ) / values.length;

                        return (
                          <div key={name} className="bg-gray-50 p-4 rounded">
                            <h3 className="font-semibold text-sm mb-2">
                              {name}
                            </h3>
                            <div className="space-y-1 text-sm">
                              <div>
                                Latest: {formatMetricValue(latest.value)}
                              </div>
                              <div>Average: {formatMetricValue(avg)}</div>
                              <div>Count: {values.length}</div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  {/* Memory Usage */}
                  {typeof window !== "undefined" && "memory" in performance && (
                    <div className="mt-6 bg-blue-50 p-4 rounded">
                      <h3 className="font-semibold mb-2">Memory Usage</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Used</div>
                          <div className="font-mono">
                            {formatMetricValue(
                              (performance as any).memory.usedJSHeapSize
                            )}
                            B
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Total</div>
                          <div className="font-mono">
                            {formatMetricValue(
                              (performance as any).memory.totalJSHeapSize
                            )}
                            B
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Limit</div>
                          <div className="font-mono">
                            {formatMetricValue(
                              (performance as any).memory.jsHeapSizeLimit
                            )}
                            B
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "monitoring" && (
                <div className="h-full overflow-auto p-4">
                  <div className="space-y-4">
                    {alerts.map((alert, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded border-l-4 ${
                          alert.severity === "critical"
                            ? "border-red-500 bg-red-50"
                            : alert.severity === "high"
                            ? "border-orange-500 bg-orange-50"
                            : alert.severity === "medium"
                            ? "border-yellow-500 bg-yellow-50"
                            : "border-blue-500 bg-blue-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{alert.metric}</div>
                            <div className="text-sm text-gray-600">
                              {alert.message}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(alert.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                alert.severity === "critical"
                                  ? "bg-red-500 text-white"
                                  : alert.severity === "high"
                                  ? "bg-orange-500 text-white"
                                  : alert.severity === "medium"
                                  ? "bg-yellow-500 text-white"
                                  : "bg-blue-500 text-white"
                              }`}
                            >
                              {alert.severity.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {alerts.length === 0 && (
                      <div className="text-gray-500 text-center py-8">
                        No active alerts
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Performance monitoring component for specific components
export function PerformanceMonitor({
  children,
  name,
}: {
  children: React.ReactNode;
  name: string;
}) {
  useEffect(() => {
    if (perf) {
      perf.startTimer(`component-${name}`);
      return () => {
        if (perf) {
          perf.endTimer(`component-${name}`);
        }
      };
    }
  }, [name]);

  return <>{children}</>;
}
