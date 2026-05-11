/**
 * /dashboard/exemplars — list the teacher's own exemplars (chunk 6.1).
 *
 * Private-by-author: only the viewing teacher's rows appear (RLS
 * exemplars_owner_all + explicit created_by filter in the query).
 * Sharing across teachers is 6.2+.
 */

import Link from "next/link";
import { Library, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listForTeacher, type ExemplarListItem } from "@/lib/queries/exemplars";

export const dynamic = "force-dynamic";

const MODE_LABELS: Record<ExemplarListItem["mode"], string> = {
  expository: "Expository",
  argumentation: "Argumentation",
  literary: "Literary",
  narrative: "Narrative",
};

export default async function ExemplarsListPage() {
  const profile = await requireRole([
    "teacher",
    "school_admin",
    "district_admin",
    "super_admin",
  ]);
  const exemplars = await listForTeacher(profile.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exemplars</h1>
          <p className="text-gray-600">
            Reference essays and paragraphs you can publish to your students.
          </p>
        </div>
        <Link
          href="/dashboard/exemplars/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New exemplar
        </Link>
      </header>

      {exemplars.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
          {exemplars.map((e) => (
            <li key={e.id}>
              <Link
                href={`/dashboard/exemplars/${e.id}`}
                className="block hover:bg-gray-50 px-4 py-3"
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 mb-1">
                  {MODE_LABELS[e.mode]}
                  <PublishedPill published={e.is_published} />
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {e.title}
                </div>
                {e.description && (
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                    {e.description}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Updated {formatDate(e.updated_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PublishedPill({ published }: { published: boolean }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
        published
          ? "bg-green-100 text-green-800"
          : "bg-gray-100 text-gray-700"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
      <Library className="w-10 h-10 text-gray-400 mx-auto mb-3" />
      <h2 className="text-lg font-semibold text-gray-900">
        No exemplars yet
      </h2>
      <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
        Create an exemplar to give your students a model essay or
        paragraph to reference while they write.
      </p>
      <Link
        href="/dashboard/exemplars/new"
        className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
      >
        <Plus className="w-4 h-4" />
        Create your first exemplar
      </Link>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
