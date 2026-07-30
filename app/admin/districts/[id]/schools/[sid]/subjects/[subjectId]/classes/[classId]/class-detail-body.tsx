/**
 * Shared class-detail body (edit class + its periods). Rendered by both the
 * super-admin route and the district sidebar route. RLS scopes subjects/classes
 * to the caller's district, so no explicit district guard is needed here.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSubject } from "@/lib/queries/subjects";
import { getClass } from "@/lib/queries/classes-admin";
import { listPeriodsForClass } from "@/lib/queries/class-periods-admin";
import { CsvImporter } from "@/components/admin/csv-importer";
import { ClassForm } from "../../class-form";
import { PeriodForm } from "./period-form";

export async function ClassDetailBody({
  schoolId,
  subjectId,
  classId,
  basePath,
}: {
  schoolId: string;
  subjectId: string;
  classId: string;
  basePath: string;
}) {
  const subject = await getSubject(subjectId);
  if (!subject || subject.school_id !== schoolId) notFound();

  const klass = await getClass(classId);
  if (!klass || klass.subject_id !== subjectId) notFound();

  const periods = await listPeriodsForClass(klass.id);
  const base = `${basePath}/schools/${schoolId}/subjects/${subjectId}/classes/${klass.id}`;

  return (
    <div className="space-y-8 max-w-3xl">
      <Link
        href={`${basePath}/schools/${schoolId}/subjects/${subjectId}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {subject.name}
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-gray-900">{klass.name}</h1>
        <p className="text-sm text-gray-500">{subject.name}</p>
      </header>

      <section className="space-y-3 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Class details
        </h2>
        <ClassForm
          mode="edit"
          subjectId={subjectId}
          initial={{ id: klass.id, name: klass.name }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Periods
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Period</th>
                <th scope="col" className="px-4 py-2 font-medium">Academic year</th>
                <th scope="col" className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    <Link
                      href={`${base}/periods/${p.id}`}
                      className="hover:text-blue-700"
                    >
                      {p.period_label}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {p.academic_year ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`${base}/periods/${p.id}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:text-gray-700"
                      aria-label={`Manage period ${p.period_label}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {periods.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                    No periods yet. Add one below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Add a period
            </h3>
            <PeriodForm mode="create" classId={klass.id} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Import periods (CSV)
            </h3>
            <CsvImporter
              entity="class_periods"
              sampleHeaders={["period_label", "academic_year"]}
              scope={{ classId: klass.id }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
