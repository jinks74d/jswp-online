/**
 * /dashboard/classes — list every class period the logged-in teacher
 * teaches. Server-rendered. RLS-scoped via the teacher's session.
 */

import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getTeacherClassPeriods } from "@/lib/queries/classes";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const profile = await requireUser();
  const periods = await getTeacherClassPeriods(profile.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
        <p className="text-gray-600">
          Class periods you teach this year.
        </p>
      </header>

      {periods.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {periods.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/classes/${p.id}`}
              className="group block bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-400 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    {p.subjectName}
                  </div>
                  <div className="text-lg font-semibold text-gray-900 truncate">
                    {p.className}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {p.period_label}
                    {p.academic_year ? ` · ${p.academic_year}` : ""}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    {p.schoolName}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 group-hover:text-gray-600" />
              </div>
              <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                {p.studentCount} student{p.studentCount === 1 ? "" : "s"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
      <div className="text-gray-900 font-medium">No classes yet</div>
      <p className="text-sm text-gray-600 mt-2">
        You don&apos;t teach any class periods yet — ask your district
        administrator to assign you to a class period.
      </p>
    </div>
  );
}
