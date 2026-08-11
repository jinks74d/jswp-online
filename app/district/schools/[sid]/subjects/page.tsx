import type { Metadata } from "next";
/**
 * /district/schools/[sid]/subjects — subjects list inside the district sidebar
 * shell. Same body as the super-admin route, scoped to the admin's district.
 */

import { requireRole } from "@/lib/auth";
import { SubjectsBody } from "@/components/school-structure/subjects-body";

export const dynamic = "force-dynamic";

type Params = Promise<{ sid: string }>;

export const metadata: Metadata = { title: "Subjects" };

export default async function DistrictSubjectsPage({
  params,
}: {
  params: Params;
}) {
  const profile = await requireRole("district_admin");
  if (!profile.district_id) return null;
  const { sid } = await params;

  return (
    <SubjectsBody
      districtId={profile.district_id}
      schoolId={sid}
      basePath="/district"
    />
  );
}
