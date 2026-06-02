/**
 * /admin/districts/[id] — district detail + edit (super-admin). Schools and
 * admins management land here in the next chunks; for now it's edit-in-place.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getDistrict } from "@/lib/queries/districts";
import { DistrictForm } from "../district-form";

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

  return (
    <div className="space-y-6 max-w-xl">
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

      <p className="text-xs text-gray-400">
        Schools and admins for this district arrive in the next chunk.
      </p>
    </div>
  );
}
