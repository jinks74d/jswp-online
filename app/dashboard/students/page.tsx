import type { Metadata } from "next";
/**
 * /dashboard/students — every student enrolled in any of the logged-in
 * teacher's class periods, deduplicated. A student in two periods
 * appears once with both periods listed.
 */

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getStudentsForTeacher,
  type TeacherStudent,
} from "@/lib/queries/students";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My Students" };

export default async function StudentsPage() {
  const profile = await requireUser();
  const students = await getStudentsForTeacher(profile.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">My Students</h1>
        <p className="text-stone-600">
          Every student enrolled in your class periods.
        </p>
      </header>

      {students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No students yet"
          action={
            <Link
              href="/dashboard/classes"
              className="inline-flex items-center gap-1 mt-4 text-sm text-blue-600 hover:text-blue-800"
            >
              View My Classes
            </Link>
          }
        >
          Once you&apos;re assigned to a class period and students are enrolled
          in it, they&apos;ll show up here. Ask your district admin if you
          believe this is an error.
        </EmptyState>
      ) : (
        <>
          <div className="text-sm text-stone-600">
            <span className="font-medium">{students.length}</span> student
            {students.length === 1 ? "" : "s"}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-stone-700">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Email
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Grade
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Classes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-gray-900">
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/students/${s.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {displayName(s)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-stone-600">
                      {s.email ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-stone-600">
                      {s.grade_level ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-stone-600">
                      {s.enrollments
                        .map((e) => `${e.className} · ${e.period_label}`)
                        .join(", ")}
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
                className="block bg-white border border-stone-200 rounded-xl shadow-sm p-4"
              >
                <div className="font-medium text-gray-900">
                  {displayName(s)}
                </div>
                <div className="text-sm text-stone-600 truncate mt-0.5">
                  {s.email ?? "—"}
                </div>
                <div className="text-xs text-stone-600 mt-1">
                  Grade {s.grade_level ?? "—"} ·{" "}
                  {s.enrollments
                    .map((e) => `${e.className} (${e.period_label})`)
                    .join(", ")}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


function displayName(s: TeacherStudent): string {
  return (
    [s.first_name, s.last_name].filter(Boolean).join(" ") || s.email || "—"
  );
}
