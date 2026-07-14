import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "../_components/coming-soon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "District Analytics" };

export default async function DistrictAnalyticsPage() {
  await requireRole("district_admin");
  return (
    <ComingSoon
      title="Analytics"
      description="District-wide usage and writing-progress insights."
      icon={BarChart3}
    />
  );
}
