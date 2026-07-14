import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "../_components/coming-soon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "School Settings" };

export default async function SchoolSettingsPage() {
  await requireRole("school_admin");
  return (
    <ComingSoon
      title="Settings"
      description="School profile and configuration."
      icon={Settings}
    />
  );
}
