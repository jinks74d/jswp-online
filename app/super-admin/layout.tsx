/**
 * Pass-through layout — replaces the legacy super-admin chrome that was
 * crashing on v2. The super-admin entry point is now /admin; this folder
 * exists only to keep stale bookmarks working via the redirect at
 * super-admin/page.tsx.
 */

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
