/**
 * /dashboard/assignments — minimal list. Title + mode + status. Filters
 * and dashboards land in chunk 3.4.
 */

import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  getTeacherAssignments,
  isPublished,
} from "@/lib/queries/assignments";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const profile = await requireUser();
  const assignments = await getTeacherAssignments(profile.id);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Assignments</h1>
          <p className="text-gray-600">
            Drafts and published assignments you&apos;ve authored.
          </p>
        </div>
        <Link
          href="/dashboard/assignments/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New assignment
        </Link>
      </header>

      {assignments.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Title</th>
                  <th className="px-3 py-2 text-left font-medium">Mode</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Class</th>
                  <th className="px-3 py-2 text-left font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-900">
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/assignments/${a.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {a.title || "(untitled)"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-600 capitalize">
                      {a.mode}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge published={isPublished(a)} />
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {a.class_name && a.class_period_label
                        ? `${a.class_name} · ${a.class_period_label}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {new Date(a.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {assignments.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/assignments/${a.id}`}
                className="block bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge published={isPublished(a)} />
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    {a.mode}
                  </span>
                </div>
                <div className="font-medium text-gray-900">
                  {a.title || "(untitled)"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {a.class_name && a.class_period_label
                    ? `${a.class_name} · ${a.class_period_label}`
                    : "Not assigned to a class"}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
      <FileText className="w-10 h-10 text-gray-400 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-gray-900">
        No assignments yet
      </h2>
      <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
        Create your first assignment to get started. The mode picker walks
        you through Expository, Argumentation, Literary, or Narrative — each
        with the right structural defaults from the JSWP guides.
      </p>
      <Link
        href="/dashboard/assignments/new"
        className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
      >
        <Plus className="w-4 h-4" />
        New assignment
      </Link>
    </div>
  );
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        published
          ? "bg-green-100 text-green-800"
          : "bg-gray-100 text-gray-700"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}
