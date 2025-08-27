// lib/performance-react.tsx
"use client";

import React from "react";
import { perf } from "./performance";

// Higher-order component for automatic render time measurement
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = (props: P) => {
    const name = componentName || Component.name || "UnknownComponent";

    return perf ? (
      perf.measureRender(name, () => <Component {...props} />)
    ) : (
      <Component {...props} />
    );
  };

  WrappedComponent.displayName = `withPerformanceMonitoring(${
    componentName || Component.name
  })`;
  return WrappedComponent;
}

// React hook for performance monitoring with React-specific features
export function usePerformanceMonitor() {
  return {
    ...perf,
    // Add React-specific performance methods
    measureComponentRender: <T extends React.ComponentType<any>>(
      Component: T,
      componentName?: string
    ): T => {
      return withPerformanceMonitoring(Component, componentName) as T;
    },
    measureHookEffect: (hookName: string, effectFn: () => void) => {
      if (perf) {
        perf.measureSync(`hook-${hookName}`, effectFn);
      } else {
        effectFn();
      }
    },
    measureAsyncHookEffect: (
      hookName: string,
      effectFn: () => Promise<void>
    ) => {
      return perf
        ? perf.measureAsync(`hook-${hookName}`, effectFn)
        : effectFn();
    },
  };
}
