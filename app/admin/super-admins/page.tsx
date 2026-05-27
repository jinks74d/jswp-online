/**
 * Super admin management. Super-admin-only: lists existing super admins and
 * lets one create another. The admin layout gates to all three admin roles,
 * so this page re-gates to super_admin specifically.
 */

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { AddSuperAdminForm } from "./add-form";

export const dynamic = "force-dynamic";

export default async function SuperAdminsPage() {
  await requireRole("super_admin");

  const supabase = await createServerClient();
  const { data: admins, error } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name, email, active, created_at")
    .eq("role", "super_admin")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load super admins: ${error.message}`);
  }

  const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Super admins</h1>
        <p className="text-gray-600">
          Platform owners with full access across all districts. Super admins
          belong to no district.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Existing super admins
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
              {(admins ?? []).map((a) => (
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
                    {a.created_at
                      ? dateFmt.format(new Date(a.created_at))
                      : "—"}
                  </td>
                </tr>
              ))}
              {(admins ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No super admins yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Add a super admin
        </h2>
        <AddSuperAdminForm />
      </section>
    </div>
  );
}
