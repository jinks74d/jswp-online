import type { Metadata } from "next";
/**
 * Subject detail (super-admin) — thin wrapper around the shared
 * <SubjectDetailBody>. The district shell renders the same body.
 */

import { requireRole } from "@/lib/auth";
import { SubjectDetailBody } from "@/components/school-structure/subject-detail-body";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; sid: string; subjectId: string }>;

export const metadata: Metadata = { title: "Subject" };

export default async function SubjectDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["super_admin", "district_admin", "school_admin"]);
  const { id, sid, subjectId } = await params;

  return (
    <SubjectDetailBody
      districtId={id}
      schoolId={sid}
      subjectId={subjectId}
      basePath={`/admin/districts/${id}`}
    />
  );
}
