/**
 * Read-only pinned-exemplars surface on the assignment detail page
 * (chunk 6.2).
 *
 * Renders only when the assignment has pins. Each row links to the
 * exemplar's edit page so the teacher can jump straight to the
 * source. Draft pins are flagged so the teacher can see why a
 * pinned exemplar isn't surfacing to students.
 */

import Link from "next/link";
import { BookOpenCheck, ChevronRight } from "lucide-react";
import type { PinnedExemplarRow } from "@/lib/queries/assignment-exemplars";

interface Props {
  pinned: readonly PinnedExemplarRow[];
}

export function PinnedExemplarsList({ pinned }: Props) {
  if (pinned.length === 0) return null;

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <header className="flex items-center gap-2 mb-2">
        <BookOpenCheck className="w-4 h-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-900">
          Pinned exemplars
        </h2>
        <span className="text-xs text-gray-500">({pinned.length})</span>
      </header>
      <ul className="divide-y divide-gray-100">
        {pinned.map((p) => (
          <li key={p.exemplar_id}>
            <Link
              href={`/dashboard/exemplars/${p.exemplar_id}`}
              className="flex items-center justify-between gap-3 py-2 hover:text-blue-700"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {p.title}
                  {!p.is_published && (
                    <span className="ml-2 inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      Draft
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs text-gray-600 truncate">
                    {p.description}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
