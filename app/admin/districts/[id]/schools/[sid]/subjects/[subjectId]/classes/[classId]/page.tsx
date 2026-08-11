import type { Metadata } from "next";
/**
 * Class detail (super-admin) — thin wrapper around the shared
 * <ClassDetailBody>. The district shell renders the same body.
 */

import { requireRole } from "@/lib/auth";
import { ClassDetailBody } from "@/components/school-structure/class-detail-body";

export const dynamic = "force-dynamic";

type Params = Promise<{
  id: string;
  sid: string;
  subjectId: string;
  classId: string;
}>;

export const metadata: Metadata = { title: "Class" };

export default async function ClassDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["super_admin", "district_admin", "school_admin"]);
  const { id, sid, subjectId, classId } = await params;

  return (
    <ClassDetailBody
      schoolId={sid}
      subjectId={subjectId}
      classId={classId}
      basePath={`/admin/districts/${id}`}
    />
  );
}
