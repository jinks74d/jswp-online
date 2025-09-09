// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OptimizedAuthProvider as AuthProvider } from "@/components/auth/OptimizedAuthProvider";
import { AuthFlowMonitor } from "@/components/auth/AuthFlowMonitor";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorProvider } from "@/components/error/ErrorProvider";
import { DevTools } from "@/components/DevTools";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JSWP Online",
  description: "Assignment management system for educators",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <ErrorProvider>
          <ErrorBoundary>
            <AuthProvider>
              {children}
              {/* <AuthFlowMonitor /> */}
              <DevTools enabled={process.env.NODE_ENV === "development"} />
            </AuthProvider>
          </ErrorBoundary>
        </ErrorProvider>
      </body>
    </html>
  );
}
