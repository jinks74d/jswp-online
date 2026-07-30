# Multi-tenant Admin Management — Design Spec

> **Date:** 2026-06-02 · **Status:** Design approved (brainstorm); plan not yet written.
> **Scope:** Super-admin-down management UI for the tenant hierarchy, built top-down
> in shippable quick-win chunks, with CSV import for every entity.

---

## 1. Goal

Give the platform a working **management surface** for the multi-tenant hierarchy.
The data model, RLS, auth, subdomain routing, and branding already exist (Phase 2);
what's missing is the UI to **create and manage** districts → schools → admins →
teachers → classes → students. Start at the top (super-admin onboarding a district)
and work down.

## 2. Existing foundation (do not rebuild)

- **Schema** (`migrations/0001`): `districts`, `schools`, `subjects`, `classes`,
  `class_periods`, `class_teacher_assignments`, `class_student_enrollments`,
  `user_profiles` (roles `super_admin` / `district_admin` / `school_admin` /
  `teacher` / `student`). `audit_log` in `migrations/0005`.
- **RLS helpers**: `auth_user_is_admin_for_district/school`, `auth_user_district_id`,
  `auth_user_school_id`, etc. Scoping is already enforced at the DB.
- **Admin UI today**: `/admin` (sparse), `/admin/import/students` (roster CSV),
  `/admin/signups` (approve pending signups), `/admin/super-admins` (create supers).
- **Reusable code**: `lib/actions/roster-import.ts` (two-stage parse→preview→import,
  papaparse + xlsx, idempotent); `lib/actions/super-admins.ts` (service-role
  `createUser` + profile insert + temp password).

## 3. Decisions locked in brainstorm

| Decision | Choice |
|---|---|
| Entry point | **Super-admin onboarding, top-down** (District → School → School Admin → …) |
| UX shape | **Discrete management screens** (not a wizard); a wizard can wrap them later |
| User provisioning | **Direct-create with a one-time temp password** (reuse `super-admins` pattern). Email invites (Resend) are a fast-follow. |
| CSV import | **Every entity.** Reuse the two-stage preview UX. **Hybrid matching**: external ID → fall back to name-within-parent-scope; surface matched / new / ambiguous / error in preview before any write. Idempotent. |

## 4. Screen structure (discrete admin tree)

Reuse the existing `/admin` layout + `requireRole` gate. Every list screen pairs
**[+ Add]** (single form) with **[Import CSV]**.

```
/admin/districts                       super_admin: list + create + import
/admin/districts/[id]                  district detail (edit name/subdomain/branding) + Schools list
/admin/districts/[id]/schools/[sid]    school detail → tabs: Admins · Teachers · Classes · Students
```

Role-based entry points (same routes, scoped data):
- **super_admin** — sees all districts.
- **district_admin** — lands inside their own district; manages its schools + people.
- **school_admin** — lands inside their own school; manages its people + classes.

## 5. Reusable CSV importer (the one net-new piece of infra)

**Architecture: shared core + thin per-entity adapters.** (Rejected: a single generic
mega-importer — too abstract upfront; and six copies of `roster-import` — 6× duplication.)

- **Shared core (UI)** — `<CsvImporter descriptor={…} />`: upload → parse (papaparse/xlsx)
  → **preview table** bucketing rows as *matched / new / ambiguous / error* → confirm.
- **Shared core (server)** — `runImport(descriptor, rows)`: validates, resolves parents,
  commits idempotently under the service role, writes `audit_log`.
- **Per-entity descriptor** supplies: column map, `zod` schema, match strategy
  (external ID → name-in-scope), parent resolver, and commit function.
- **Build timing:** the framework lands in **chunk 1** built against the *Districts*
  descriptor — the simplest case (no parent to resolve) — so the core is proven before
  hierarchical entities use it. `roster-import.ts` is migrated to a descriptor at the
  **Students** step (6), not up front.

## 6. Provisioning helper (direct-create)

Generalize `super-admins.ts` into one helper:

```
createScopedUser({ role, districtId, schoolId, firstName, lastName, email })
  → service-role createUser + user_profiles insert
  → returns a one-time temp password (displayed once, never stored)
```

Powers Add-School-Admin, Add-Teacher, Add-Student (single create) **and** the commit
step of any people-CSV import. Self-signup can still never grant elevated roles.

## 7. Build sequence (each row = one audited chunk, independently shippable)

1. **Districts** — CRUD + CSV (super_admin). *First quick win; self-contained. Also
   stands up the reusable CSV importer framework against the simplest entity.*
2. **Schools** — CRUD + CSV (super / district admin).
3. **School Admins** — direct-create + CSV; introduces `createScopedUser`.
4. **Teachers** — direct-create + CSV.
5. **Classes** — `Subject → Class → Class Period` + teacher assignment + CSV.
6. **Students** — enroll + CSV (reuses roster logic as a descriptor).

## 8. Cross-cutting

- **RLS**: already models every scope — expect **few/no migrations** for steps 1–4.
- **Audit**: all privileged writes (creates, imports, role assignments) append to
  `audit_log` (its first non-roster writers).
- **Temp passwords**: shown once on screen, never persisted.

## 9. Open items (decide when reached, not now)

- **`Subject → Class → Class Period` vs. "Classes":** the owner's mental model collapses
  three schema levels into "Classes." Reconcile at step 5 (surface options: expose all
  three, or auto-create a default Subject/Class so the admin only manages Periods).
- **Email invites (Resend):** fast-follow after direct-create proves the flows.
- **Bulk *hierarchical* CSV** (one file seeding district+schools+people at once): out of
  scope for v1; per-entity files only.

## 10. Out of scope / YAGNI

- SIS live sync (Clever/ClassLink) — the external-ID match strategy *prepares* for it, but no integration now.
- Onboarding wizard — deferred (discrete screens first).
- Soft-delete/restore UX beyond the existing `active` flags.
