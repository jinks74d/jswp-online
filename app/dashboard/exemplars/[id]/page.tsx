/**
 * /dashboard/exemplars/[id] — edit + delete (chunk 6.1).
 *
 * The shared ExemplarForm handles the edit fields. Delete is a small
 * separate form with a JS-side confirm(). Publish toggle lives inside
 * the main form (checkbox).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getForTeacher } from "@/lib/queries/exemplars";
import { updateExemplar, deleteExemplar } from "@/lib/actions/exemplars";
import { ExemplarForm } from "../exemplar-form";
import { DeleteExemplarButton } from "./delete-button";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditExemplarPage({
  params,
}: {
  params: Params;
}) {
  const profile = await requireRole([
    "teacher",
    "school_admin",
    "district_admin",
    "super_admin",
  ]);
  const { id } = await params;
  const exemplar = await getForTeacher(id, profile.id);

  if (!exemplar) notFound();

  // Bind id into the update action so the form keeps the (prev, formData)
  // signature useActionState expects.
  const updateBound = updateExemplar.bind(null, id);
  const deleteBound = deleteExemplar.bind(null, id);

  return (
    <div className="space-y-5 max-w-3xl">
      <Link
        href="/dashboard/exemplars"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Exemplars
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit exemplar</h1>
          <p className="text-gray-600">{exemplar.title}</p>
        </div>
        <DeleteExemplarButton action={deleteBound} />
      </header>

      <ExemplarForm
        action={updateBound}
        initial={exemplar}
        formMode="edit"
      />
    </div>
  );
}
