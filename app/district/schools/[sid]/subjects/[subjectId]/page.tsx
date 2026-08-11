import type { Metadata } from "next";
/**
 * /district/schools/[sid]/subjects/[subjectId] — subject detail in the district
 * sidebar shell. Same body as the super-admin route.
 */

import { requireRole } from "@/lib/auth";
import { SubjectDetailBody } from "@/components/school-structure/subject-detail-body";

export const dynamic = "force-dynamic";

type Params = Promise<{ sid: string; subjectId: string }>;

export const metadata: Metadata = { title: "Subject" };

export default async function DistrictSubjectDetailPage({
  params,
}: {
  params: Params;
}) {
  const profile = await requireRole("district_admin");
  if (!profile.district_id) return null;
  const { sid, subjectId } = await params;

  return (
    <SubjectDetailBody
      districtId={profile.district_id}
      schoolId={sid}
      subjectId={subjectId}
      basePath="/district"
    />
  );
}
