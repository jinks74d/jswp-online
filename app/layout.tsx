// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OptimizedAuthProvider as AuthProvider } from "@/components/auth/OptimizedAuthProvider";
import { AuthDebug } from "@/components/auth/AuthDebug";
import { AuthFlowMonitor } from "@/components/auth/AuthFlowMonitor";

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
        <AuthProvider>
          {children}
          <AuthDebug enabled={process.env.NODE_ENV === "development"} />
          <AuthFlowMonitor />
        </AuthProvider>
      </body>
    </html>
  );
}
