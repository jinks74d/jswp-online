import type { Metadata } from "next";
/**
 * /dashboard/assignments — minimal list. Title + mode + status. Filters
 * and dashboards land in chunk 3.4.
 */

import Link from "next/link";
import { Eye, FileText, Pencil, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  getTeacherAssignments,
  isPublished,
  formatAssignmentClasses,
} from "@/lib/queries/assignments";
import { DeleteAssignmentButton } from "./delete-assignment-button";
import { PublishToggleButton } from "./publish-toggle-button";

const iconLink =
  "inline-flex items-center justify-center p-1.5 rounded-md text-stone-600 hover:bg-stone-100 hover:text-stone-700";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My Assignments" };

export default async function AssignmentsPage() {
  const profile = await requireUser();
  const assignments = await getTeacherAssignments(profile.id);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Assignments</h1>
          <p className="text-stone-600">
            Drafts and published assignments you&apos;ve authored.
          </p>
        </div>
        <Link
          href="/dashboard/assignments/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          New assignment
        </Link>
      </header>

      {assignments.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-stone-700">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Title
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Mode
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Class
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Updated
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-gray-900">
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
                    <td className="px-3 py-2 text-stone-600 capitalize">
                      {a.mode}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge published={isPublished(a)} />
                    </td>
                    <td className="px-3 py-2 text-stone-600">
                      {a.class_periods.length > 0
                        ? formatAssignmentClasses(a.class_periods)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-stone-600">
                      {new Date(a.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard/assignments/${a.id}`}
                          title="View"
                          aria-label={`View ${a.title || "assignment"}`}
                          className={iconLink}
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </Link>
                        <Link
                          href={`/dashboard/assignments/${a.id}#edit`}
                          title="Edit"
                          aria-label={`Edit ${a.title || "assignment"}`}
                          className={iconLink}
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </Link>
                        <PublishToggleButton
                          assignmentId={a.id}
                          title={a.title || ""}
                          published={isPublished(a)}
                          studentWritingCount={a.student_writing_count}
                        />
                        <DeleteAssignmentButton
                          assignmentId={a.id}
                          title={a.title || ""}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="bg-white border border-stone-200 rounded-xl shadow-sm p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge published={isPublished(a)} />
                  <span className="text-xs uppercase tracking-wide text-stone-600">
                    {a.mode}
                  </span>
                </div>
                <Link
                  href={`/dashboard/assignments/${a.id}`}
                  className="font-medium text-gray-900 hover:text-blue-700"
                >
                  {a.title || "(untitled)"}
                </Link>
                <div className="text-xs text-stone-600 mt-1">
                  {formatAssignmentClasses(a.class_periods)}
                </div>
                <div className="mt-3 flex items-center gap-3 border-t border-stone-100 pt-2 text-sm">
                  <Link
                    href={`/dashboard/assignments/${a.id}`}
                    className="inline-flex items-center gap-1 text-stone-600 hover:text-gray-900"
                  >
                    <Eye className="w-4 h-4" aria-hidden="true" />
                    View
                  </Link>
                  <Link
                    href={`/dashboard/assignments/${a.id}#edit`}
                    className="inline-flex items-center gap-1 text-stone-600 hover:text-gray-900"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                    Edit
                  </Link>
                  <div className="ml-auto flex items-center gap-1">
                    <PublishToggleButton
                      assignmentId={a.id}
                      title={a.title || ""}
                      published={isPublished(a)}
                      studentWritingCount={a.student_writing_count}
                    />
                    <DeleteAssignmentButton
                      assignmentId={a.id}
                      title={a.title || ""}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-8 text-center">
      <FileText
        className="w-10 h-10 text-gray-400 mx-auto mb-4"
        aria-hidden="true"
      />
      <h2 className="text-lg font-semibold text-gray-900">
        No assignments yet
      </h2>
      <p className="text-sm text-stone-600 mt-2 max-w-md mx-auto">
        Create your first assignment to get started. The mode picker walks
        you through Expository, Argumentation, Literary, or Narrative — each
        with the right structural defaults from the JSWP guides.
      </p>
      <Link
        href="/dashboard/assignments/new"
        className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
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
          : "bg-stone-100 text-stone-700"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}
