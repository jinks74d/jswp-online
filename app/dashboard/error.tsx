"use client";

/**
 * Route-level error boundary for /dashboard/**. Catches errors in any
 * teacher dashboard subroute. Console-logs the error and offers a
 * Retry via Next.js's reset prop.
 *
 * TODO(phase-7): wire to Sentry once we add it. The .digest property
 * is the per-request error fingerprint Next.js will surface for
 * production debugging.
 */

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error boundary]", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-16">
      <div className="max-w-md w-full bg-white border border-red-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h1 className="text-xl font-semibold text-gray-900">
            Something went wrong
          </h1>
        </div>
        <p className="text-sm text-gray-600">
          We hit an unexpected error loading this page. Try again — if it
          keeps happening, contact support and share the error ID below.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-gray-500">
            Error ID: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          <RotateCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
