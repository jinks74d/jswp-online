/**
 * Subject detail — edit the subject. Its Classes (level 2) land in the next
 * chunk.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import { getSubject } from "@/lib/queries/subjects";
import { SubjectForm } from "../subject-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; sid: string; subjectId: string }>;

export default async function SubjectDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["super_admin", "district_admin", "school_admin"]);
  const { id, sid, subjectId } = await params;

  const school = await getSchool(sid);
  if (!school || school.district_id !== id) notFound();

  const subject = await getSubject(subjectId);
  if (!subject || subject.school_id !== sid) notFound();

  return (
    <div className="space-y-6 max-w-xl">
      <Link
        href={`/admin/districts/${id}/schools/${sid}/subjects`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Subjects
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-gray-900">{subject.name}</h1>
        <p className="text-sm text-gray-500">{school.name}</p>
      </header>

      <SubjectForm
        mode="edit"
        schoolId={sid}
        initial={{
          id: subject.id,
          name: subject.name,
          description: subject.description,
        }}
      />

      <p className="text-xs text-gray-400">
        Classes for this subject arrive in the next chunk.
      </p>
    </div>
  );
}
