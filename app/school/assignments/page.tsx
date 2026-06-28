import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "../_components/coming-soon";

export const dynamic = "force-dynamic";

export default async function SchoolAssignmentsPage() {
  await requireRole("school_admin");
  return (
    <ComingSoon
      title="Assignments"
      description="Monitor assignments across your school."
      icon={ClipboardList}
    />
  );
}
