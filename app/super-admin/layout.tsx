// app/super-admin/layout.tsx
import { requireSuperAdmin } from "@/lib/auth/server";
import { SuperAdminWrapper } from "./super-admin-wrapper";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Require super admin access at the layout level
  const session = await requireSuperAdmin();
  
  return (
    <SuperAdminWrapper session={session}>
      {children}
    </SuperAdminWrapper>
  );
}