import type { Metadata } from "next";
/**
 * Class-period detail (super-admin) — thin wrapper around the shared
 * <PeriodDetailBody>. The district shell renders the same body.
 */

import { requireRole } from "@/lib/auth";
import { PeriodDetailBody } from "@/components/school-structure/period-detail-body";

export const dynamic = "force-dynamic";

type Params = Promise<{
  id: string;
  sid: string;
  subjectId: string;
  classId: string;
  periodId: string;
}>;

export const metadata: Metadata = { title: "Period" };

export default async function PeriodDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["super_admin", "district_admin", "school_admin"]);
  const { id, sid, subjectId, classId, periodId } = await params;

  return (
    <PeriodDetailBody
      schoolId={sid}
      subjectId={subjectId}
      classId={classId}
      periodId={periodId}
      basePath={`/admin/districts/${id}`}
    />
  );
}
