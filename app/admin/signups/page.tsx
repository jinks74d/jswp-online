/**
 * Signup review queue. RLS-scoped — admins only see requests in their
 * district/school (super_admin sees all). Filter chips toggle between
 * pending / decided.
 */

import Link from "next/link";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string }>;

export default async function SignupQueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { status } = await searchParams;
  const filter =
    status === "approved" || status === "denied" ? status : "pending";

  const supabase = await createServerClient();
  const { data: rows, error } = await supabase
    .from("signup_requests")
    .select(
      "id, email, first_name, last_name, requested_role, status, created_at, message"
    )
    .eq("status", filter)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Signup requests</h1>
        <p className="text-gray-600">
          Review and approve or deny pending account applications.
        </p>
      </header>

      <div className="flex items-center gap-2">
        <FilterChip
          label="Pending"
          active={filter === "pending"}
          href="/admin/signups"
          icon={<Clock className="w-4 h-4" />}
        />
        <FilterChip
          label="Approved"
          active={filter === "approved"}
          href="/admin/signups?status=approved"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <FilterChip
          label="Denied"
          active={filter === "denied"}
          href="/admin/signups?status=denied"
          icon={<XCircle className="w-4 h-4" />}
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {!rows || rows.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
          No {filter} signup requests.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">
                  Requested role
                </th>
                <th className="px-3 py-2 text-left font-medium">Submitted</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-900">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    {r.first_name} {r.last_name}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.email}</td>
                  <td className="px-3 py-2 text-gray-600">{r.requested_role}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/signups/${r.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  href,
  icon,
}: {
  label: string;
  active: boolean;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
