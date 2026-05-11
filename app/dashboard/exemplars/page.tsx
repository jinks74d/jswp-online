/**
 * /dashboard/exemplars — list the viewer's own exemplars and
 * same-school colleagues' shared exemplars (chunks 6.1 + 6.3).
 *
 * Single chronological list (most-recently-updated first). Non-owned
 * rows carry a "Shared by …" chip; owned rows show Draft/Published
 * + (if shared) a Shared pill. Clicking either opens the detail
 * page, which decides between edit and read-only view based on
 * ownership.
 */

import Link from "next/link";
import { Library, Plus, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listForViewer, type ExemplarListItem } from "@/lib/queries/exemplars";

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
  const exemplars = await listForViewer(profile.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exemplars</h1>
          <p className="text-gray-600">
            Reference essays and paragraphs you can publish to your students.
            Colleagues at your school can share theirs with you to use.
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
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-gray-500 mb-1">
                  {MODE_LABELS[e.mode]}
                  {e.ownedByViewer ? (
                    <>
                      <PublishedPill published={e.is_published} />
                      {e.shared_with_school && <SharedPill />}
                    </>
                  ) : (
                    <SharedByChip name={e.authorName} />
                  )}
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

function SharedPill() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">
      <Users className="w-3 h-3" />
      Shared
    </span>
  );
}

function SharedByChip({ name }: { name: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-800">
      <Users className="w-3 h-3" />
      Shared by {name ?? "a colleague"}
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
        paragraph to reference while they write. Or wait for a
        colleague to share one with you.
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
