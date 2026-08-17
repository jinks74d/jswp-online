import type { Metadata } from "next";
/**
 * /admin/districts/[id] — district detail (super-admin). A white header card
 * with a crimson accent + Edit-details modal, a four-up stats row, a Schools
 * table with add/import actions, and a right rail (branding + points of contact).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import {
  getDistrict,
  getDistrictPocs,
  type DistrictPoc,
} from "@/lib/queries/districts";
import { listSchoolsForDistrict } from "@/lib/queries/schools";
import { schoolLevelLabel } from "@/lib/school-levels";
import { isValidHexColor } from "@/lib/district-branding.types";
import { StatTile } from "@/components/ui/stat-tile";
import { type DistrictInitial } from "../district-form";
import { EditDistrictPanel } from "./edit-district-panel";
import { SchoolActions } from "./school-actions";
import { PocInviteButton } from "./poc-invite-button";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export const metadata: Metadata = { title: "District" };

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
  const pocs = await getDistrictPocs(district);

  const activeSchools = schools.filter((s) => s.active).length;
  const contactsSet = (pocs.primary ? 1 : 0) + (pocs.secondary ? 1 : 0);
  const levelLabels = Array.from(
    new Set(
      schools
        .map((s) => schoolLevelLabel(s.level))
        .filter((l): l is string => !!l)
    )
  );
  const levelsDisplay = levelLabels.length > 0 ? levelLabels.join(", ") : "—";

  const primary =
    district.primary_color && isValidHexColor(district.primary_color)
      ? district.primary_color
      : null;
  const secondary =
    district.secondary_color && isValidHexColor(district.secondary_color)
      ? district.secondary_color
      : null;

  const editInitial: DistrictInitial = {
    id: district.id,
    name: district.name,
    subdomain: district.subdomain,
    contact_email: district.contact_email,
    primary_color: district.primary_color,
    secondary_color: district.secondary_color,
    logo_url: district.logo_url,
    active: district.active,
    primaryPoc: pocs.primary
      ? {
          first_name: pocs.primary.first_name,
          last_name: pocs.primary.last_name,
          email: pocs.primary.email,
          phone: pocs.primary.phone,
        }
      : undefined,
    secondaryPoc: pocs.secondary
      ? {
          first_name: pocs.secondary.first_name,
          last_name: pocs.secondary.last_name,
          email: pocs.secondary.email,
          phone: pocs.secondary.phone,
        }
      : undefined,
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/districts"
        className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Districts
      </Link>

      {/* ── Header card ─────────────────────────────────────────────── */}
      <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="w-1.5 shrink-0 bg-rose-600" aria-hidden="true" />
        <div className="flex flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <LogoTile logoUrl={district.logo_url} />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">
                {district.name}
              </h1>
              {district.subdomain ? (
                <p className="mt-0.5 font-mono text-sm text-gray-500">
                  {district.subdomain}.jswponline.com
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-gray-500">No subdomain set</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill active={district.active} />
            <EditDistrictPanel initial={editInitial} />
          </div>
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Schools" value={schools.length} />
        <StatTile label="Active" value={activeSchools} accent />
        <StatTile label="Contacts set" value={`${contactsSet}/2`} />
        <StatTile label="Levels" value={levelsDisplay} />
      </dl>

      {/* ── Main + rail ─────────────────────────────────────────────── */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Schools */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Schools
            </h2>
            <span className="text-xs text-gray-500">{schools.length} total</span>
          </div>

          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr className="border-b border-gray-100">
                <th scope="col" className="px-5 py-2 font-medium">Name</th>
                <th scope="col" className="px-5 py-2 font-medium">Level</th>
                <th scope="col" className="px-5 py-2 font-medium">Status</th>
                <th scope="col" className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schools.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    <Link
                      href={`/admin/districts/${district.id}/schools/${s.id}`}
                      className="hover:text-rose-700"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {schoolLevelLabel(s.level) ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    {s.active ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full border border-gray-400" aria-hidden="true" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/districts/${district.id}/schools/${s.id}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:text-gray-700"
                      aria-label={`Manage ${s.name}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                    No schools yet. Add one below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="border-t border-gray-100 p-4">
            <SchoolActions districtId={district.id} />
          </div>
        </div>

        {/* Rail */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Branding
            </h2>
            <div className="space-y-4">
              <Swatch label="Primary" color={primary} />
              <Swatch label="Secondary" color={secondary} />
              {!primary && !secondary && !district.logo_url && (
                <p className="text-sm text-gray-500">
                  No custom branding yet. Add a logo and colors in Edit.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Points of Contact
            </h2>
            <div className="mt-4 space-y-4">
              <PocCard label="Primary" poc={pocs.primary} districtId={district.id} />
              <div className="border-t border-gray-100" />
              <PocCard label="Secondary" poc={pocs.secondary} districtId={district.id} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Presentational helpers ───────────────────────────────────────────── */

function LogoTile({ logoUrl }: { logoUrl: string | null }) {
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <Building2 className="h-7 w-7 text-gray-300" aria-hidden="true" />
      )}
    </span>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full border border-gray-400" aria-hidden="true" />
      Inactive
    </span>
  );
}


function Swatch({ label, color }: { label: string; color: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-9 w-9 shrink-0 rounded-md border border-gray-200"
        style={{
          backgroundColor: color ?? undefined,
          backgroundImage: color
            ? undefined
            : "repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 4px,#e5e7eb 4px,#e5e7eb 8px)",
        }}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="font-mono text-xs text-gray-500">{color ?? "—"}</p>
      </div>
    </div>
  );
}

function PocCard({
  label,
  poc,
  districtId,
}: {
  label: string;
  poc: DistrictPoc | null;
  districtId: string;
}) {
  if (!poc) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className="mt-1 text-sm text-gray-500">Not set.</p>
      </div>
    );
  }

  const name = [poc.first_name, poc.last_name].filter(Boolean).join(" ") || "—";
  const invitedLabel = poc.invited_at
    ? `Invited ${new Date(poc.invited_at).toLocaleDateString()}`
    : "Not invited yet";

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900">{name}</p>
      {poc.email && (
        <a
          href={`mailto:${poc.email}`}
          className="block break-all text-sm text-rose-600 hover:text-rose-700"
        >
          {poc.email}
        </a>
      )}
      {poc.phone && <p className="text-sm text-gray-600">{poc.phone}</p>}
      <p className="mt-1 text-xs text-gray-500">{invitedLabel}</p>
      <PocInviteButton
        userId={poc.id}
        districtId={districtId}
        alreadyInvited={!!poc.invited_at}
      />
    </div>
  );
}
