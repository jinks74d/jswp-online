import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "../_components/coming-soon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "School Analytics" };

export default async function SchoolAnalyticsPage() {
  await requireRole("school_admin");
  return (
    <ComingSoon
      title="Analytics"
      description="Usage and writing-progress insights for your school."
      icon={BarChart3}
    />
  );
}
