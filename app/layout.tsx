// TODO(phase-3): Remove OptimizedAuthProvider once the legacy
// /dashboard and /super-admin pages have been rebuilt to use
// server-side auth. See docs/DEV_PLAN.md Phase 3.

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OptimizedAuthProvider as AuthProvider } from "@/components/auth/OptimizedAuthProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  brandingToCssVars,
  getDistrictBrandingFromHeaders,
} from "@/lib/branding-headers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JSWP Online",
  description: "Assignment management system for educators",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getDistrictBrandingFromHeaders();
  const cssVars = brandingToCssVars(branding);

  return (
    <html lang="en" style={cssVars}>
      <body className={inter.className} suppressHydrationWarning>
        <ErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
