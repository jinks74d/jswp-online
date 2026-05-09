/**
 * /dashboard/students/[id] — single student detail. Scoped to the
 * teacher's class periods via getStudentDetail; out-of-scope students
 * surface as notFound().
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStudentDetail } from "@/lib/queries/students";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function StudentDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const teacher = await requireUser();
  const student = await getStudentDetail(id, teacher.id);

  if (!student) notFound();

  const displayName =
    [student.first_name, student.last_name].filter(Boolean).join(" ") ||
    student.email ||
    "—";

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/students"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to My Students
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
        <p className="text-gray-600">{student.email ?? "—"}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard label="Grade" value={student.grade_level ?? "—"} />
        <DetailCard
          label="SIS ID"
          value={student.student_id_external ?? "—"}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700">
          Enrolled in your classes
        </h2>
        <ul className="space-y-2">
          {student.enrollments.map((e) => (
            <li
              key={e.class_period_id}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <Link
                href={`/dashboard/classes/${e.class_period_id}`}
                className="block group"
              >
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {e.subjectName}
                </div>
                <div className="font-medium text-gray-900 group-hover:text-blue-700">
                  {e.className}
                </div>
                <div className="text-sm text-gray-600 mt-0.5">
                  {e.period_label}
                  {e.academic_year ? ` · ${e.academic_year}` : ""}
                  {" · "}
                  {e.schoolName}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}
