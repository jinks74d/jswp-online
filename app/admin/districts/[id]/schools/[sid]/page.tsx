/**
 * /admin/districts/[id]/schools/[sid] — school detail (super-admin view).
 * Thin wrapper around the shared <SchoolDetailBody>; the district-admin shell
 * renders the same body under /district/schools/[sid].
 */

import { requireRole } from "@/lib/auth";
import { SchoolDetailBody } from "./school-detail-body";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; sid: string }>;

export default async function SchoolDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["super_admin", "district_admin"]);
  const { id, sid } = await params;

  return (
    <SchoolDetailBody
      districtId={id}
      schoolId={sid}
      basePath={`/admin/districts/${id}`}
      backHref={`/admin/districts/${id}`}
    />
  );
}
