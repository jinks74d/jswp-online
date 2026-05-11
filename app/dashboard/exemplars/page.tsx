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
import {
  listForViewer,
  type ExemplarListItem,
  type StepFilter,
} from "@/lib/queries/exemplars";
import {
  STEP_TAG_VALUES,
  STEP_TAG_LABELS,
  isStepTag,
} from "@/lib/exemplar-limits";

export const dynamic = "force-dynamic";

const MODE_LABELS: Record<ExemplarListItem["mode"], string> = {
  expository: "Expository",
  argumentation: "Argumentation",
  literary: "Literary",
  narrative: "Narrative",
};

type SearchParams = Promise<{ step?: string }>;

function parseStepFilter(raw: string | undefined): StepFilter {
  if (!raw || raw === "all") return "all";
  if (raw === "untagged") return "untagged";
  if (isStepTag(raw)) return raw;
  return "all";
}

export default async function ExemplarsListPage({
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
  const { step: rawStep } = await searchParams;
  const stepFilter = parseStepFilter(rawStep);
  const exemplars = await listForViewer(profile.id, stepFilter);

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

      <FilterChips current={stepFilter} />

      {exemplars.length === 0 ? (
        <FilteredEmptyState filter={stepFilter} />
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

function FilterChips({ current }: { current: StepFilter }) {
  const chips: ReadonlyArray<{ value: StepFilter; label: string }> = [
    { value: "all", label: "All" },
    ...STEP_TAG_VALUES.map((v) => ({ value: v, label: STEP_TAG_LABELS[v] })),
    { value: "untagged", label: "Untagged" },
  ];

  return (
    <nav
      aria-label="Filter exemplars by step"
      className="flex flex-wrap gap-1.5"
    >
      {chips.map((c) => {
        const active = c.value === current;
        const href =
          c.value === "all"
            ? "/dashboard/exemplars"
            : `/dashboard/exemplars?step=${c.value}`;
        return (
          <Link
            key={c.value}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
              active
                ? "border-blue-600 bg-blue-50 text-blue-800"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}

function FilteredEmptyState({ filter }: { filter: StepFilter }) {
  if (filter === "all") {
    return <EmptyState />;
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-700">
      No exemplars match this filter.{" "}
      <Link
        href="/dashboard/exemplars"
        className="text-blue-600 hover:text-blue-800"
      >
        Show all
      </Link>
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
