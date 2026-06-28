/**
 * Shared subjects-list body (level 1 of Subject → Class → Period). Rendered by
 * both the super-admin route and the district-admin sidebar route. Links derive
 * from `basePath` (`/admin/districts/${id}` or `/district`).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { getSchool } from "@/lib/queries/schools";
import { listSubjectsForSchool } from "@/lib/queries/subjects";
import { listSchoolUsersByRole } from "@/lib/queries/school-users";
import { CsvImporter } from "@/components/admin/csv-importer";
import { AddSubjectClassForm } from "./add-subject-class-form";

export async function SubjectsBody({
  districtId,
  schoolId,
  basePath,
}: {
  districtId: string;
  schoolId: string;
  basePath: string;
}) {
  const school = await getSchool(schoolId);
  if (!school || school.district_id !== districtId) notFound();

  const subjects = await listSubjectsForSchool(school.id);
  const missingPeriod = subjects.filter((s) => !s.hasPeriod).length;

  const teacherRows = await listSchoolUsersByRole(school.id, "teacher");
  const teachers = teacherRows
    .filter((t) => t.active)
    .map((t) => ({
      id: t.id,
      name:
        [t.first_name, t.last_name].filter(Boolean).join(" ") ||
        t.email ||
        "Unnamed teacher",
    }));

  const schoolBase = `${basePath}/schools/${schoolId}`;

  return (
    <div className="space-y-8 max-w-3xl">
      <Link
        href={schoolBase}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {school.name}
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
        <p className="text-gray-600">
          Subjects for {school.name}. Each subject holds classes, and each class
          holds periods.
        </p>
      </header>

      <section className="space-y-3">
        {missingPeriod > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              {missingPeriod} subject{missingPeriod === 1 ? "" : "s"} ha
              {missingPeriod === 1 ? "s" : "ve"} no period yet. Every subject
              needs a class with at least one period before it can be used.
            </p>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Name</th>
                <th scope="col" className="px-4 py-2 font-medium">Description</th>
                <th scope="col" className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subjects.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    <Link
                      href={`${schoolBase}/subjects/${s.id}`}
                      className="hover:text-blue-700"
                    >
                      {s.name}
                    </Link>
                    {!s.hasPeriod && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        needs period
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {s.description ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`${schoolBase}/subjects/${s.id}`}
                      className="inline-flex items-center text-gray-400 hover:text-gray-700"
                      aria-label={`Manage ${s.name}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    No subjects yet. Add one below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Add a subject & class
            </h3>
            <AddSubjectClassForm schoolId={school.id} teachers={teachers} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Import subjects (CSV)
            </h3>
            <CsvImporter
              entity="subjects"
              sampleHeaders={["name", "description"]}
              scope={{ schoolId: school.id }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
