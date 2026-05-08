/**
 * Import students page. Server component — fetches the class periods
 * available to the current admin (RLS scopes the query) and renders the
 * client form for the upload + import flow.
 */

import { createServerClient } from "@/lib/supabase/server";
import { ImportForm, type ClassPeriodOption } from "./import-form";

export const dynamic = "force-dynamic";

type ClassPeriodRow = {
  id: string;
  period_label: string;
  academic_year: string | null;
  classes: { name: string; subjects: { name: string } | null } | null;
  schools: { name: string } | null;
};

export default async function ImportStudentsPage() {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("class_periods")
    .select(
      `
      id,
      period_label,
      academic_year,
      classes:class_id ( name, subjects:subject_id ( name ) ),
      schools:school_id ( name )
    `
    )
    .order("period_label");

  const rows = (data ?? []) as unknown as ClassPeriodRow[];

  const classPeriods: ClassPeriodOption[] = rows.map((p) => ({
    id: p.id,
    label: [
      p.schools?.name,
      p.classes?.subjects?.name,
      p.classes?.name,
      p.period_label,
      p.academic_year,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Import students</h1>
        <p className="text-gray-600">
          Upload a CSV or Excel file. Required columns:{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
            email
          </code>
          ,{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
            first_name
          </code>
          ,{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
            last_name
          </code>
          . Optional:{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
            grade_level
          </code>
          ,{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
            student_id_external
          </code>
          .
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load class periods: {error.message}
        </div>
      )}

      {classPeriods.length === 0 && !error ? (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          No class periods are available in your scope. Create a class period
          first, then come back to import students.
        </div>
      ) : (
        <ImportForm classPeriods={classPeriods} />
      )}
    </div>
  );
}
