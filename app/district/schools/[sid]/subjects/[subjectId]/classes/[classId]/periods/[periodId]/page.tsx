import type { Metadata } from "next";
/**
 * /district/schools/[sid]/subjects/[subjectId]/classes/[classId]/periods/[periodId]
 * — class-period detail in the district sidebar shell. Same body as super-admin.
 */

import { requireRole } from "@/lib/auth";
import { PeriodDetailBody } from "../../../../../../../../../admin/districts/[id]/schools/[sid]/subjects/[subjectId]/classes/[classId]/periods/[periodId]/period-detail-body";

export const dynamic = "force-dynamic";

type Params = Promise<{
  sid: string;
  subjectId: string;
  classId: string;
  periodId: string;
}>;

export const metadata: Metadata = { title: "Period" };

export default async function DistrictPeriodDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole("district_admin");
  const { sid, subjectId, classId, periodId } = await params;

  return (
    <PeriodDetailBody
      schoolId={sid}
      subjectId={subjectId}
      classId={classId}
      periodId={periodId}
      basePath="/district"
    />
  );
}
