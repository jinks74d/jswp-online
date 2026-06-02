/**
 * /admin/districts/[id]/schools/[sid] — school detail + edit. Admins (school
 * tabs) and classes land here in later chunks; for now it's edit-in-place.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import { getDistrict } from "@/lib/queries/districts";
import { SchoolForm } from "../../school-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; sid: string }>;

export default async function SchoolDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["super_admin", "district_admin"]);
  const { id, sid } = await params;

  const school = await getSchool(sid);
  // Guard against a school id that belongs to a different district in the URL.
  if (!school || school.district_id !== id) notFound();

  const district = await getDistrict(id);

  return (
    <div className="space-y-6 max-w-xl">
      <Link
        href={`/admin/districts/${id}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {district?.name ?? "district"}
      </Link>

      <header>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
          {!school.active && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Inactive
            </span>
          )}
        </div>
        {school.level && (
          <p className="text-sm text-gray-500 capitalize">{school.level}</p>
        )}
      </header>

      <SchoolForm
        mode="edit"
        districtId={id}
        initial={{
          id: school.id,
          name: school.name,
          level: school.level,
          active: school.active,
        }}
      />

      <p className="text-xs text-gray-400">
        Admins, teachers, and classes for this school arrive in the next
        chunks.
      </p>
    </div>
  );
}
