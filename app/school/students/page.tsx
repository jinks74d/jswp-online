import { Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "../_components/coming-soon";

export const dynamic = "force-dynamic";

export default async function SchoolStudentsPage() {
  await requireRole("school_admin");
  return (
    <ComingSoon
      title="Students"
      description="View and manage students enrolled at your school."
      icon={Users}
    />
  );
}
