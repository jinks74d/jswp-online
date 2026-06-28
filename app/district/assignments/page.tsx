import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "../_components/coming-soon";

export const dynamic = "force-dynamic";

export default async function DistrictAssignmentsPage() {
  await requireRole("district_admin");
  return (
    <ComingSoon
      title="Assignments"
      description="Monitor district-wide assignments and progress."
      icon={ClipboardList}
    />
  );
}
