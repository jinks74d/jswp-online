/**
 * /dashboard/classes/[id] — class period detail with full roster.
 * notFound() if the period doesn't exist or is outside the teacher's
 * RLS scope.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import {
  getClassPeriodWithRoster,
  type RosterStudent,
} from "@/lib/queries/classes";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function ClassDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const period = await getClassPeriodWithRoster(id);

  if (!period) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/classes"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to My Classes
      </Link>

      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {period.subjectName}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{period.className}</h1>
        <p className="text-gray-600">
          {period.period_label}
          {period.academic_year ? ` · ${period.academic_year}` : ""}
          {" · "}
          {period.schoolName}
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Users className="w-4 h-4" />
          <span className="font-medium">{period.roster.length}</span> student
          {period.roster.length === 1 ? "" : "s"}
        </div>

        {period.roster.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-600">
            No students are enrolled in this class period yet.
          </div>
        ) : (
          <Roster students={period.roster} />
        )}
      </section>
    </div>
  );
}

function Roster({ students }: { students: RosterStudent[] }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-left font-medium">Grade</th>
              <th className="px-3 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-gray-900">
            {students.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2">{displayName(s)}</td>
                <td className="px-3 py-2 text-gray-600">{s.email ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600">
                  {s.grade_level ?? "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/dashboard/students/${s.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {students.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/students/${s.id}`}
            className="block bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="font-medium text-gray-900">{displayName(s)}</div>
            <div className="text-sm text-gray-600 truncate mt-0.5">
              {s.email ?? "—"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Grade {s.grade_level ?? "—"}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function displayName(s: RosterStudent): string {
  return (
    [s.first_name, s.last_name].filter(Boolean).join(" ") || s.email || "—"
  );
}
