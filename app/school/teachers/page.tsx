import { GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "../_components/coming-soon";

export const dynamic = "force-dynamic";

export default async function SchoolTeachersPage() {
  await requireRole("school_admin");
  return (
    <ComingSoon
      title="Teachers"
      description="Invite and manage teaching staff at your school."
      icon={GraduationCap}
    />
  );
}
