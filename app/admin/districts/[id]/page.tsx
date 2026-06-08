/**
 * /admin/districts/[id] — district detail (super-admin). Two-column dashboard:
 * a branded banner (logo + district colors), a Schools-focused main column, and
 * a right rail with branding summary, quick stats, and a collapsed edit form.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  School as SchoolIcon,
  Upload,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getDistrict } from "@/lib/queries/districts";
import { listSchoolsForDistrict } from "@/lib/queries/schools";
import { schoolLevelLabel } from "@/lib/school-levels";
import { getContrastColor } from "@/lib/district-branding.utils";
import { isValidHexColor } from "@/lib/district-branding.types";
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
  const activeSchools = schools.filter((s) => s.active).length;

  // Only treat colors as "branded" when they're real hex values.
  const primary =
    district.primary_color && isValidHexColor(district.primary_color)
      ? district.primary_color
      : null;
  const secondary =
    district.secondary_color && isValidHexColor(district.secondary_color)
      ? district.secondary_color
      : null;
  const onPrimary = primary ? getContrastColor(primary) : undefined;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/admin/districts"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Districts
      </Link>

      {/* ── Branded banner ───────────────────────────────────────────── */}
      <header
        className="rounded-xl border border-gray-200 overflow-hidden"
        style={primary ? { backgroundColor: primary, color: onPrimary } : undefined}
      >
        <div className="p-6 flex items-center gap-4">
          <LogoTile logoUrl={district.logo_url} branded={!!primary} />
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1
                className="text-2xl font-bold truncate"
                style={primary ? undefined : { color: "#111827" }}
              >
                {district.name}
              </h1>
              {!district.active && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={
                    primary
                      ? { backgroundColor: "rgba(255,255,255,0.22)", color: onPrimary }
                      : { backgroundColor: "#f3f4f6", color: "#4b5563" }
                  }
                >
                  Inactive
                </span>
              )}
            </div>
            {district.subdomain ? (
              <p
                className="text-sm font-mono mt-0.5"
                style={primary ? { opacity: 0.9 } : { color: "#6b7280" }}
              >
                {district.subdomain}.jswponline.com
              </p>
            ) : (
              <p
                className="text-sm mt-0.5"
                style={primary ? { opacity: 0.85 } : { color: "#9ca3af" }}
              >
                No subdomain set
              </p>
            )}
          </div>
        </div>
        {secondary && <div className="h-1.5" style={{ backgroundColor: secondary }} />}
      </header>

      {/* ── Two-column dashboard ─────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Main: Schools */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Schools
            </h2>
            <span className="text-xs text-gray-400">
              {schools.length} total
            </span>
          </div>

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
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      No schools yet. Add one below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Disclosure
            icon={<Plus className="w-4 h-4" />}
            label="Add a school"
            defaultOpen={schools.length === 0}
          >
            <SchoolForm mode="create" districtId={district.id} />
          </Disclosure>

          <Disclosure icon={<Upload className="w-4 h-4" />} label="Import schools (CSV)">
            <CsvImporter
              entity="schools"
              sampleHeaders={["name", "level"]}
              scope={{ districtId: district.id }}
            />
          </Disclosure>
        </div>

        {/* Rail: branding + stats + edit */}
        <aside className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Branding
            </h2>
            <Swatch label="Primary" color={primary} />
            <Swatch label="Secondary" color={secondary} />
            {!primary && !secondary && !district.logo_url && (
              <p className="text-sm text-gray-400">
                No custom branding yet. Add a logo and colors in Edit.
              </p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              At a glance
            </h2>
            <dl className="space-y-2 text-sm">
              <Stat
                icon={<SchoolIcon className="w-4 h-4 text-gray-400" />}
                label="Schools"
                value={schools.length}
              />
              <Stat
                icon={<Building2 className="w-4 h-4 text-gray-400" />}
                label="Active schools"
                value={activeSchools}
              />
            </dl>
          </div>

          <Disclosure icon={<Pencil className="w-4 h-4" />} label="Edit district details">
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
          </Disclosure>
        </aside>
      </div>
    </div>
  );
}

/* ── Presentational helpers ───────────────────────────────────────────── */

function LogoTile({
  logoUrl,
  branded,
}: {
  logoUrl: string | null;
  branded: boolean;
}) {
  if (logoUrl) {
    return (
      <span className="inline-block p-5 rounded-lg bg-white shadow-sm shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* Definite width anchors logos (esp. SVGs with a viewBox but no
            intrinsic width/height); height scales by ratio, capped at 125. */}
        <img
          src={logoUrl}
          alt="District logo"
          className="block w-[250px] h-auto max-h-[125px] object-contain"
        />
      </span>
    );
  }
  return (
    <span
      className="flex items-center justify-center w-32 h-16 rounded-lg shrink-0"
      style={branded ? { backgroundColor: "rgba(255,255,255,0.18)" } : { backgroundColor: "#f3f4f6" }}
    >
      <Building2 className="w-7 h-7" style={branded ? undefined : { color: "#9ca3af" }} />
    </span>
  );
}

function Swatch({ label, color }: { label: string; color: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-9 h-9 rounded-md border border-gray-200 shrink-0"
        style={{
          backgroundColor: color ?? undefined,
          backgroundImage: color
            ? undefined
            : "repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 4px,#e5e7eb 4px,#e5e7eb 8px)",
        }}
      />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-mono text-gray-900">{color ?? "—"}</p>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-gray-600">
        {icon}
        {label}
      </dt>
      <dd className="font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function Disclosure({
  icon,
  label,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex items-center gap-2 cursor-pointer list-none select-none rounded-md bg-white border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
        <ChevronRight className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" />
        {icon}
        {label}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
