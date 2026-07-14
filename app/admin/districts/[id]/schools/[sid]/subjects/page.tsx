import type { Metadata } from "next";
/**
 * /admin/districts/[id]/schools/[sid]/subjects — super-admin view. Thin wrapper
 * around the shared <SubjectsBody>; the district shell renders the same body
 * under /district/schools/[sid]/subjects.
 */

import { requireRole } from "@/lib/auth";
import { SubjectsBody } from "./subjects-body";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; sid: string }>;

export const metadata: Metadata = { title: "Subjects" };

export default async function SubjectsPage({ params }: { params: Params }) {
  await requireRole(["super_admin", "district_admin", "school_admin"]);
  const { id, sid } = await params;

  return (
    <SubjectsBody
      districtId={id}
      schoolId={sid}
      basePath={`/admin/districts/${id}`}
    />
  );
}
