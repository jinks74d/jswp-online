/**
 * /admin/districts/[id] — district detail + edit (super-admin). Schools and
 * admins management land here in the next chunks; for now it's edit-in-place.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getDistrict } from "@/lib/queries/districts";
import { listSchoolsForDistrict } from "@/lib/queries/schools";
import { schoolLevelLabel } from "@/lib/school-levels";
import { CsvImporter } from "@/components/admin/csv-importer";
import { DistrictForm } from "../district-form";
import { SchoolForm } from "./school-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function DistrictDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireRole("super_admin");
  const { id } = await params;

  const district = await getDistrict(id);
  if (!district) notFound();

  const schools = await listSchoolsForDistrict(district.id);

  return (
    <div className="space-y-8 max-w-3xl">
      <Link
        href="/admin/districts"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Districts
      </Link>

      <header>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{district.name}</h1>
          {!district.active && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Inactive
            </span>
          )}
        </div>
        {district.subdomain && (
          <p className="text-sm text-gray-500 font-mono">
            {district.subdomain}.jswponline.com
          </p>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          District details
        </h2>
        <DistrictForm
          mode="edit"
          initial={{
            id: district.id,
            name: district.name,
            subdomain: district.subdomain,
            contact_email: district.contact_email,
            primary_color: district.primary_color,
            secondary_color: district.secondary_color,
            logo_url: district.logo_url,
            active: district.active,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Schools
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Level</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schools.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    <Link
                      href={`/admin/districts/${district.id}/schools/${s.id}`}
                      className="hover:text-blue-700"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {schoolLevelLabel(s.level) ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {s.active ? (
                      <span className="text-green-700">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/districts/${district.id}/schools/${s.id}`}
                      className="inline-flex items-center text-gray-400 hover:text-gray-700"
                      aria-label={`Manage ${s.name}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No schools yet. Add one below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Add a school
            </h3>
            <SchoolForm mode="create" districtId={district.id} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Import schools (CSV)
            </h3>
            <CsvImporter
              entity="schools"
              sampleHeaders={["name", "level"]}
              scope={{ districtId: district.id }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
