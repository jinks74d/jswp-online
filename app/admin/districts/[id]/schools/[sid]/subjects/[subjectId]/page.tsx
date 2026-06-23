/**
 * Subject detail — edit the subject. Its Classes (level 2) land in the next
 * chunk.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import { getSubject, subjectHasPeriod } from "@/lib/queries/subjects";
import { listClassesForSubject } from "@/lib/queries/classes-admin";
import { CsvImporter } from "@/components/admin/csv-importer";
import { SubjectForm } from "../subject-form";
import { ClassForm } from "./class-form";

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

  const classes = await listClassesForSubject(subject.id);
  const hasPeriod = await subjectHasPeriod(subject.id);

  return (
    <div className="space-y-8 max-w-3xl">
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

      {!hasPeriod && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            This subject has no period yet. Add a class below, then a period to
            it — a subject can&apos;t be used for assignments until it has at
            least one period.
          </p>
        </div>
      )}

      <section className="space-y-3 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Subject details
        </h2>
        <SubjectForm
          mode="edit"
          schoolId={sid}
          initial={{
            id: subject.id,
            name: subject.name,
            description: subject.description,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Classes
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Name</th>
                <th scope="col" className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    <Link
                      href={`/admin/districts/${id}/schools/${sid}/subjects/${subject.id}/classes/${c.id}`}
                      className="hover:text-blue-700"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/districts/${id}/schools/${sid}/subjects/${subject.id}/classes/${c.id}`}
                      className="inline-flex items-center text-gray-400 hover:text-gray-700"
                      aria-label={`Manage ${c.name}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {classes.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                    No classes yet. Add one below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Add a class
            </h3>
            <ClassForm mode="create" subjectId={subject.id} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Import classes (CSV)
            </h3>
            <CsvImporter
              entity="classes"
              sampleHeaders={["name"]}
              scope={{ subjectId: subject.id }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
