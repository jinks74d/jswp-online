import { Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "../_components/coming-soon";

export const dynamic = "force-dynamic";

export default async function DistrictUsersPage() {
  await requireRole("district_admin");
  return (
    <ComingSoon
      title="Users"
      description="Invite and manage admins, teachers, and students."
      icon={Users}
    />
  );
}
