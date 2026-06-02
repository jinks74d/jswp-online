/**
 * /admin/districts — super-admin district management: list every district and
 * create a new one. Super-admin-only (the admin layout gates to all three
 * admin roles, so this page re-gates).
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listDistricts } from "@/lib/queries/districts";
import { DistrictForm } from "./district-form";

export const dynamic = "force-dynamic";

export default async function DistrictsPage() {
  await requireRole("super_admin");

  const districts = await listDistricts();
  const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Districts</h1>
        <p className="text-gray-600">
          Every district on the platform. Create one to begin onboarding its
          schools and admins.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          All districts
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Subdomain</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {districts.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900 font-medium">
                    <Link
                      href={`/admin/districts/${d.id}`}
                      className="hover:text-blue-700"
                    >
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {d.subdomain ? (
                      <span className="font-mono text-xs">
                        {d.subdomain}.jswponline.com
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {d.active ? (
                      <span className="text-green-700">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {d.created_at ? dateFmt.format(new Date(d.created_at)) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/districts/${d.id}`}
                      className="inline-flex items-center text-gray-400 hover:text-gray-700"
                      aria-label={`Manage ${d.name}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {districts.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    No districts yet. Create the first one below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Add a district
        </h2>
        <DistrictForm mode="create" />
      </section>
    </div>
  );
}
