import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
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
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
