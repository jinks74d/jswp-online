/**
 * /dashboard/assignments/new — picks the writing mode if no ?mode is
 * set, otherwise renders the create form for that mode. Splitting the
 * mode pick from the form keeps the structural commitment up-front.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getTeacherClassPeriodsForPicker } from "@/lib/queries/assignments";
import { ModePicker } from "./mode-picker";
import { AssignmentForm } from "../assignment-form";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type Mode = Database["public"]["Enums"]["jswp_mode"];
const VALID_MODES = new Set<Mode>([
  "expository",
  "argumentation",
  "literary",
  "narrative",
]);

type SearchParams = Promise<{ mode?: string }>;

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireRole(["teacher"]);
  const { mode: modeRaw } = await searchParams;

  if (!modeRaw) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/assignments"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to My Assignments
        </Link>
        <header>
          <h1 className="text-2xl font-bold text-gray-900">
            Pick a writing mode
          </h1>
          <p className="text-gray-600">
            The mode determines the chunk ratio, paragraph structure, and
            which extra fields appear on the assignment.
          </p>
        </header>
        <ModePicker />
      </div>
    );
  }

  if (!VALID_MODES.has(modeRaw as Mode)) notFound();
  const mode = modeRaw as Mode;

  const classPeriods = await getTeacherClassPeriodsForPicker(profile.id);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/assignments/new"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Pick a different mode
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-gray-900 capitalize">
          New {mode} assignment
        </h1>
        <p className="text-gray-600">
          Save as a draft. You can edit and publish later.
        </p>
      </header>
      <AssignmentForm
        formMode="create"
        mode={mode}
        classPeriods={classPeriods}
        schoolId={profile.school_id!}
      />
    </div>
  );
}
