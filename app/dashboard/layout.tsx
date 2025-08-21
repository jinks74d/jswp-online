// app/dashboard/layout.tsx
import { SessionTrackingProvider } from "@/components/analytics/SessionTrackingProvider";
import ClientDashboard from "@/components/dashboard/ClientDashboard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use client-side authentication to avoid re-authentication on every navigation
  // The middleware handles the initial authentication check
  // The ClientDashboard component manages the session-aware layout
  return (
    <SessionTrackingProvider>
      <ClientDashboard>{children}</ClientDashboard>
    </SessionTrackingProvider>
  );
}
