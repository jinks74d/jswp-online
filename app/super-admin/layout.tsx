// app/super-admin/layout.tsx
import { ClientSuperAdmin } from "@/components/super-admin/ClientSuperAdmin";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientSuperAdmin>{children}</ClientSuperAdmin>;
}
