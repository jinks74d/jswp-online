/**
 * /dashboard/exemplars/new — create form (chunks 6.1 + 6.4).
 *
 * Accepts ?from=<writingId> to pre-fill from a student's final
 * draft (the "Promote to Exemplar" workflow). When the query
 * param is set:
 *   - getWritingPrefillData scopes via RLS; returns null if the
 *     teacher can't see the writing, no final_draft exists, or
 *     full_text is whitespace.
 *   - On a valid prefill, the form renders with title/description
 *     blank, full_text pre-populated, mode locked to the
 *     assignment's mode, and a permission-reminder banner above.
 *   - On invalid (?from with no usable data), an error block
 *     links back to the assignment review.
 */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createExemplar } from "@/lib/actions/exemplars";
import { getWritingPrefillData } from "@/lib/queries/exemplars";
import { ExemplarForm } from "../exemplar-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ from?: string }>;

export default async function NewExemplarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireRole([
    "teacher",
    "school_admin",
    "district_admin",
    "super_admin",
  ]);

  const { from } = await searchParams;

  const prefill = from
    ? await getWritingPrefillData(from, profile.id)
    : null;

  // ?from=… set but no usable prefill — bad ID, cross-tenant, no
  // final_draft yet, or empty content. Surface an error and link back.
  if (from && !prefill) {
    return (
      <div className="space-y-5 max-w-3xl">
        <Link
          href="/dashboard/exemplars"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Exemplars
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h2 className="text-sm font-semibold text-red-800">
            Can&apos;t promote that writing
          </h2>
          <p className="text-sm text-red-700 mt-1">
            The writing either doesn&apos;t exist, isn&apos;t in your scope,
            or has no final draft yet. Open the writing in your dashboard
            to confirm.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <Link
        href="/dashboard/exemplars"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Exemplars
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-gray-900">New exemplar</h1>
        <p className="text-gray-600">
          {prefill
            ? "Edit the pre-filled draft below before saving."
            : "Save as draft first; toggle Published when you're ready to share with students."}
        </p>
      </header>

      <ExemplarForm
        action={createExemplar}
        formMode="create"
        prefillFromWriting={
          prefill
            ? {
                studentName: prefill.studentName,
                assignmentTitle: prefill.assignmentTitle,
                fullText: prefill.full_text,
                mode: prefill.mode,
              }
            : undefined
        }
      />
    </div>
  );
}
