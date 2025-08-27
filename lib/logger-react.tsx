// lib/logger-react.tsx
"use client";

import React from "react";
import { logger } from "./logger";

// Higher-order component for automatic error logging
export function withErrorLogging<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = (props: P) => {
    try {
      return <Component {...props} />;
    } catch (error) {
      logger.error(`Component Error: ${componentName || Component.name}`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        props: process.env.NODE_ENV === "development" ? props : undefined,
      });
      throw error; // Re-throw to let error boundary handle it
    }
  };

  WrappedComponent.displayName = `withErrorLogging(${
    componentName || Component.name
  })`;
  return WrappedComponent;
}

// React hook for logging with additional React-specific features
export function useLogger() {
  return {
    ...logger,
    // Add React-specific logging methods
    componentError: (componentName: string, error: Error, props?: any) => {
      logger.error(`Component Error: ${componentName}`, {
        error: error.message,
        stack: error.stack,
        props: process.env.NODE_ENV === "development" ? props : undefined,
        category: "react_component_error",
      });
    },
    renderError: (componentName: string, error: Error) => {
      logger.error(`Render Error: ${componentName}`, {
        error: error.message,
        stack: error.stack,
        category: "react_render_error",
      });
    },
    effectError: (componentName: string, effectName: string, error: Error) => {
      logger.error(`Effect Error: ${componentName}.${effectName}`, {
        error: error.message,
        stack: error.stack,
        category: "react_effect_error",
      });
    },
  };
}
