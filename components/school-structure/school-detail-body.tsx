/**
 * Shared school-detail body. Rendered by both the super-admin route
 * (/admin/districts/[id]/schools/[sid]) and the district-admin route
 * (/district/schools/[sid]). `basePath` is the prefix up to the district
 * context (`/admin/districts/${id}` or `/district`); everything below
 * (`/schools/${sid}/…`) is identical, so all internal links derive from it.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, School as SchoolIcon } from "lucide-react";
import { getSchool } from "@/lib/queries/schools";
import { getDistrict } from "@/lib/queries/districts";
import {
  listSchoolUsersByRole,
  type SchoolUserRow,
} from "@/lib/queries/school-users";
import { createSchoolAdmin, createTeacher } from "@/lib/actions/school-users";
import { CsvImporter } from "@/components/admin/csv-importer";
import { schoolLevelLabel } from "@/lib/school-levels";
import { adminKindLabel } from "@/lib/admin-kinds";
import { isValidHexColor } from "@/lib/district-branding.types";
import { getContrastColor } from "@/lib/district-branding.utils";
import { SchoolForm } from "./school-form";
import { AddSchoolUserForm } from "./add-school-user-form";
import { SchoolTabs } from "./school-tabs";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export async function SchoolDetailBody({
  districtId,
  schoolId,
  basePath,
  backHref,
  backLabel,
}: {
  districtId: string;
  schoolId: string;
  basePath: string;
  backHref: string;
  /** Falls back to the district name when omitted (super-admin context). */
  backLabel?: string;
}) {
  const school = await getSchool(schoolId);
  // Guard against a school id that belongs to a different district in the URL.
  if (!school || school.district_id !== districtId) notFound();

  const district = await getDistrict(districtId);
  const admins = await listSchoolUsersByRole(school.id, "school_admin");
  const teachers = await listSchoolUsersByRole(school.id, "teacher");

  // Branding resolves school colours first, then the district's as fallback.
  const valid = (c: string | null | undefined) =>
    c && isValidHexColor(c) ? c : null;
  const primary = valid(school.primary_color) ?? valid(district?.primary_color);
  const secondary =
    valid(school.secondary_color) ?? valid(district?.secondary_color);

  return (
    <div className="max-w-5xl space-y-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)] hover:opacity-80"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {backLabel ?? district?.name ?? "district"}
      </Link>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4">
        {school.logo_url ? (
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-white"
            style={{ borderColor: primary ?? "#e5e7eb" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={school.logo_url}
              alt=""
              className="h-full w-full object-contain p-1.5"
            />
          </span>
        ) : (
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: primary ?? "#e11d48",
              color: primary ? getContrastColor(primary) : "#ffffff",
            }}
          >
            <SchoolIcon className="h-7 w-7" aria-hidden="true" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <span>{schoolLevelLabel(school.level) ?? "No level set"}</span>
            <span aria-hidden="true">·</span>
            <StatusText active={school.active} />
          </div>
          {secondary && (
            <span
              className="mt-2 block h-1.5 w-16 rounded-full"
              style={{ backgroundColor: secondary }}
              aria-hidden="true"
            />
          )}
        </div>
      </header>

      {/* ── School details ──────────────────────────────────────────── */}
      <section>
        <SectionLabel>School details</SectionLabel>
        <div className="max-w-xl">
          <SchoolForm
            mode="edit"
            districtId={districtId}
            initial={{
              id: school.id,
              name: school.name,
              level: school.level,
              active: school.active,
              address: school.address,
              logo_url: school.logo_url,
              primary_color: school.primary_color,
              secondary_color: school.secondary_color,
            }}
          />
        </div>
      </section>

      {/* ── Manage (admins, teachers, subjects & classes) ───────────── */}
      <section id="manage" className="scroll-mt-24">
        <SchoolTabs
          label="Manage"
          tabs={[
            {
              id: "admins",
              label: "School admins",
              count: admins.length,
              content: (
                <>
                  <DataTable
                    columns={["Name", "Role", "Email", "Status", "Added"]}
                    empty="No school admins yet."
                    rows={admins.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {fullName(a)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {adminKindLabel(a.admin_kind)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {a.email ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusText active={a.active} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {added(a.created_at)}
                        </td>
                      </tr>
                    ))}
                  />

                  <div className="mt-4 grid gap-6 lg:grid-cols-2">
                    <div>
                      <SectionLabel>Add an admin</SectionLabel>
                      <AddSchoolUserForm
                        schoolId={school.id}
                        action={createSchoolAdmin}
                        roleLabel="admin"
                        showAdminKind
                      />
                    </div>
                    <div>
                      <SectionLabel>Import admins (CSV)</SectionLabel>
                      <CsvImporter
                        entity="school_admins"
                        sampleHeaders={["first_name", "last_name", "email"]}
                        scope={{ schoolId: school.id }}
                      />
                    </div>
                  </div>
                </>
              ),
            },
            {
              id: "teachers",
              label: "Teachers",
              count: teachers.length,
              content: (
                <>
                  <DataTable
                    columns={["Name", "Email", "Status", "Added"]}
                    empty="No teachers yet."
                    rows={teachers.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {fullName(t)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {t.email ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusText active={t.active} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {added(t.created_at)}
                        </td>
                      </tr>
                    ))}
                  />

                  <div className="mt-4 grid gap-6 lg:grid-cols-2">
                    <div>
                      <SectionLabel>Add a teacher</SectionLabel>
                      <AddSchoolUserForm
                        schoolId={school.id}
                        action={createTeacher}
                        roleLabel="teacher"
                      />
                    </div>
                    <div>
                      <SectionLabel>Import teachers (CSV)</SectionLabel>
                      <CsvImporter
                        entity="teachers"
                        sampleHeaders={["first_name", "last_name", "email"]}
                        scope={{ schoolId: school.id }}
                      />
                    </div>
                  </div>
                </>
              ),
            },
            {
              id: "subjects",
              label: "Subjects & classes",
              content: (
                <Link
                  href={`${basePath}/schools/${school.id}/subjects`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Manage subjects, classes &amp; periods
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600">
                      Build the Subject → Class → Period structure and assign
                      teachers.
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                </Link>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}

/* ── Presentational helpers ───────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="h-0.5 w-5 rounded-full bg-[var(--brand)]" aria-hidden="true" />
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {children}
      </h2>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: readonly string[];
  rows: React.ReactNode[];
  empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-300">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-4 py-2.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length > 0 ? (
            rows
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-gray-500"
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusText({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${
        active ? "text-emerald-600" : "text-gray-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "border border-gray-400"
        }`}
        aria-hidden="true"
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function fullName(u: SchoolUserRow): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
}

function added(createdAt: string | null): string {
  return createdAt ? dateFmt.format(new Date(createdAt)) : "—";
}
