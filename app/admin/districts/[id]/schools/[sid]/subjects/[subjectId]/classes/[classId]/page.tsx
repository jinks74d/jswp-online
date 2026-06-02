/**
 * Class detail — edit the class. Its Class Periods (level 3) + teacher
 * assignment land in the next chunk.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSubject } from "@/lib/queries/subjects";
import { getClass } from "@/lib/queries/classes-admin";
import { ClassForm } from "../../class-form";

export const dynamic = "force-dynamic";

type Params = Promise<{
  id: string;
  sid: string;
  subjectId: string;
  classId: string;
}>;

export default async function ClassDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["super_admin", "district_admin", "school_admin"]);
  const { id, sid, subjectId, classId } = await params;

  const subject = await getSubject(subjectId);
  if (!subject || subject.school_id !== sid) notFound();

  const klass = await getClass(classId);
  if (!klass || klass.subject_id !== subjectId) notFound();

  return (
    <div className="space-y-6 max-w-xl">
      <Link
        href={`/admin/districts/${id}/schools/${sid}/subjects/${subjectId}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {subject.name}
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-gray-900">{klass.name}</h1>
        <p className="text-sm text-gray-500">{subject.name}</p>
      </header>

      <ClassForm
        mode="edit"
        subjectId={subjectId}
        initial={{ id: klass.id, name: klass.name }}
      />

      <p className="text-xs text-gray-400">
        Class periods and teacher assignment for this class arrive in the next
        chunk.
      </p>
    </div>
  );
}
