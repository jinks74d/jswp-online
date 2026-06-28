/**
 * /district/schools/[sid]/subjects/[subjectId]/classes/[classId] — class detail
 * in the district sidebar shell. Same body as the super-admin route.
 */

import { requireRole } from "@/lib/auth";
import { ClassDetailBody } from "../../../../../../../admin/districts/[id]/schools/[sid]/subjects/[subjectId]/classes/[classId]/class-detail-body";

export const dynamic = "force-dynamic";

type Params = Promise<{ sid: string; subjectId: string; classId: string }>;

export default async function DistrictClassDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole("district_admin");
  const { sid, subjectId, classId } = await params;

  return (
    <ClassDetailBody
      schoolId={sid}
      subjectId={subjectId}
      classId={classId}
      basePath="/district"
    />
  );
}
