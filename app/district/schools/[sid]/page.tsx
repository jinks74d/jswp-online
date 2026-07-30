import type { Metadata } from "next";
/**
 * /district/schools/[sid] — school detail inside the district-admin sidebar
 * shell. Renders the same <SchoolDetailBody> as the super-admin route, scoped
 * to the signed-in admin's own district.
 */

import { requireRole } from "@/lib/auth";
import { SchoolDetailBody } from "../../../admin/districts/[id]/schools/[sid]/school-detail-body";

export const dynamic = "force-dynamic";

type Params = Promise<{ sid: string }>;

export const metadata: Metadata = { title: "School" };

export default async function DistrictSchoolDetailPage({
  params,
}: {
  params: Params;
}) {
  const profile = await requireRole("district_admin");
  if (!profile.district_id) return null;
  const { sid } = await params;

  return (
    <SchoolDetailBody
      districtId={profile.district_id}
      schoolId={sid}
      basePath="/district"
      backHref="/district/schools"
      backLabel="Schools"
    />
  );
}
