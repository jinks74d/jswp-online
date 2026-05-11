/**
 * /dashboard/exemplars/[id] — edit (owner) or read-only view (other
 * teacher at same school).
 *
 * 6.1 shipped this as edit-only (RLS rejected non-owners). 6.3 widens
 * read access to same-school colleagues for shared exemplars; this
 * page forks rendering on ownership.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getForViewer } from "@/lib/queries/exemplars";
import { updateExemplar, deleteExemplar } from "@/lib/actions/exemplars";
import { ExemplarForm } from "../exemplar-form";
import { DeleteExemplarButton } from "./delete-button";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const MODE_LABELS = {
  expository: "Expository",
  argumentation: "Argumentation",
  literary: "Literary",
  narrative: "Narrative",
} as const;

export default async function ExemplarDetailPage({
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
  const exemplar = await getForViewer(id, profile.id);

  if (!exemplar) notFound();

  if (exemplar.ownedByViewer) {
    return <OwnerView id={id} exemplar={exemplar} />;
  }
  return <ReadOnlyView exemplar={exemplar} />;
}

function OwnerView({
  id,
  exemplar,
}: {
  id: string;
  exemplar: NonNullable<Awaited<ReturnType<typeof getForViewer>>>;
}) {
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

      <ExemplarForm action={updateBound} initial={exemplar} formMode="edit" />
    </div>
  );
}

function ReadOnlyView({
  exemplar,
}: {
  exemplar: NonNullable<Awaited<ReturnType<typeof getForViewer>>>;
}) {
  return (
    <div className="space-y-5 max-w-3xl">
      <Link
        href="/dashboard/exemplars"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Exemplars
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
          {MODE_LABELS[exemplar.mode]}
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-800">
            <Users className="w-3 h-3" />
            Shared by {exemplar.authorName ?? "a colleague"}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{exemplar.title}</h1>
        {exemplar.description && (
          <p className="text-gray-700">{exemplar.description}</p>
        )}
      </header>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
          Exemplar text
        </h2>
        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 leading-relaxed">
          {exemplar.full_text}
        </pre>
      </section>

      <p className="text-xs text-gray-500">
        Read-only — only the author can edit this exemplar. Pin it from
        your own assignments to reuse it with your students.
      </p>
    </div>
  );
}
