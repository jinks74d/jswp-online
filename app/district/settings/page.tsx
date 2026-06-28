import { Settings } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "../_components/coming-soon";

export const dynamic = "force-dynamic";

export default async function DistrictSettingsPage() {
  await requireRole("district_admin");
  return (
    <ComingSoon
      title="Settings"
      description="District branding, contacts, and configuration."
      icon={Settings}
    />
  );
}
