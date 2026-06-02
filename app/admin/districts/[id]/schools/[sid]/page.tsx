/**
 * /admin/districts/[id]/schools/[sid] — school detail + edit. Admins (school
 * tabs) and classes land here in later chunks; for now it's edit-in-place.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/queries/schools";
import { getDistrict } from "@/lib/queries/districts";
import { listSchoolUsersByRole } from "@/lib/queries/school-users";
import { createSchoolAdmin, createTeacher } from "@/lib/actions/school-users";
import { CsvImporter } from "@/components/admin/csv-importer";
import { SchoolForm } from "../../school-form";
import { AddSchoolUserForm } from "./add-school-user-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; sid: string }>;

export default async function SchoolDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["super_admin", "district_admin"]);
  const { id, sid } = await params;

  const school = await getSchool(sid);
  // Guard against a school id that belongs to a different district in the URL.
  if (!school || school.district_id !== id) notFound();

  const district = await getDistrict(id);
  const admins = await listSchoolUsersByRole(school.id, "school_admin");
  const teachers = await listSchoolUsersByRole(school.id, "teacher");
  const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

  return (
    <div className="space-y-8 max-w-3xl">
      <Link
        href={`/admin/districts/${id}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {district?.name ?? "district"}
      </Link>

      <header>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
          {!school.active && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Inactive
            </span>
          )}
        </div>
        {school.level && (
          <p className="text-sm text-gray-500 capitalize">{school.level}</p>
        )}
      </header>

      <section className="space-y-3 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          School details
        </h2>
        <SchoolForm
          mode="edit"
          districtId={id}
          initial={{
            id: school.id,
            name: school.name,
            level: school.level,
            active: school.active,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          School admins
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 text-gray-900">
                    {[a.first_name, a.last_name].filter(Boolean).join(" ") ||
                      "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{a.email ?? "—"}</td>
                  <td className="px-4 py-2">
                    {a.active ? (
                      <span className="text-green-700">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {a.created_at ? dateFmt.format(new Date(a.created_at)) : "—"}
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No school admins yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Add an admin
            </h3>
            <AddSchoolUserForm
              schoolId={school.id}
              action={createSchoolAdmin}
              roleLabel="admin"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Import admins (CSV)
            </h3>
            <CsvImporter
              entity="school_admins"
              sampleHeaders={["first_name", "last_name", "email"]}
              scope={{ schoolId: school.id }}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Teachers
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-gray-900">
                    {[t.first_name, t.last_name].filter(Boolean).join(" ") ||
                      "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{t.email ?? "—"}</td>
                  <td className="px-4 py-2">
                    {t.active ? (
                      <span className="text-green-700">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {t.created_at ? dateFmt.format(new Date(t.created_at)) : "—"}
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No teachers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Add a teacher
            </h3>
            <AddSchoolUserForm
              schoolId={school.id}
              action={createTeacher}
              roleLabel="teacher"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Import teachers (CSV)
            </h3>
            <CsvImporter
              entity="teachers"
              sampleHeaders={["first_name", "last_name", "email"]}
              scope={{ schoolId: school.id }}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Subjects &amp; classes
        </h2>
        <Link
          href={`/admin/districts/${id}/schools/${school.id}/subjects`}
          className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-400 transition-colors"
        >
          <div>
            <div className="text-sm font-medium text-gray-900">
              Manage subjects, classes &amp; periods
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              Build the Subject → Class → Period structure and assign teachers.
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </Link>
      </section>
    </div>
  );
}
