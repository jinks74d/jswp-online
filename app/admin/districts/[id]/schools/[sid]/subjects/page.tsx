/**
 * /admin/districts/[id]/schools/[sid]/subjects — level 1 of the class
 * structure. List + create + CSV import of subjects for a school. Classes hang
 * off each subject (next chunk).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import { listSubjectsForSchool } from "@/lib/queries/subjects";
import { CsvImporter } from "@/components/admin/csv-importer";
import { SubjectForm } from "./subject-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; sid: string }>;

export default async function SubjectsPage({ params }: { params: Params }) {
  await requireRole(["super_admin", "district_admin", "school_admin"]);
  const { id, sid } = await params;

  const school = await getSchool(sid);
  if (!school || school.district_id !== id) notFound();

  const subjects = await listSubjectsForSchool(school.id);

  return (
    <div className="space-y-8 max-w-3xl">
      <Link
        href={`/admin/districts/${id}/schools/${sid}`}
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
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subjects.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    <Link
                      href={`/admin/districts/${id}/schools/${sid}/subjects/${s.id}`}
                      className="hover:text-blue-700"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {s.description ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/districts/${id}/schools/${sid}/subjects/${s.id}`}
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
              Add a subject
            </h3>
            <SubjectForm mode="create" schoolId={school.id} />
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
