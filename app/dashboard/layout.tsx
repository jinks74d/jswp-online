/**
 * Pass-through layout. Replaces the legacy SessionTrackingProvider +
 * ClientDashboard chain that was crashing under v2. Deep child routes
 * (assignments, classes, etc.) remain on disk but are unreachable in
 * practice until Phase 3 rebuilds them.
 */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
