# Scope — District management reconciliation (`/admin/districts`)

> Backlog item "Rebuild district management UI under `/admin/districts`" (identified chunk P7-6).
> Reconciled 2026-07-02 against the current `/admin`, `/district`, `/school` surfaces.
>
> **Headline: the item is ~80% done.** The backlog was written when P7-6 deleted the v1
> super-admin district CRUD; it has since been rebuilt (commits `e40efb9`, `8333bc4`,
> `3959987`, `7d9032e` + the district/school shells). Only two slices remain, one of which
> the backlog already defers.

## Requirement-by-requirement

### 1. District CRUD (list / detail / create / edit) + branding + POC — ✅ DONE
- **List:** `app/admin/districts/page.tsx` → `districts-browser.tsx`.
- **Create:** `new-district-panel.tsx` + `district-form.tsx` → `createDistrict` action.
- **Detail:** `app/admin/districts/[id]/page.tsx` (header card, stats, schools table, branding + POC rail).
- **Edit:** `edit-district-panel.tsx` → `updateDistrict` action.
- **Branding:** `district-form.tsx` has a Branding section — `primary_color`, `secondary_color`,
  `logo_url`, hex-validated via `isValidHexColor`.
- **POC:** dual Points-of-Contact section (primary + secondary: first/last/email/phone).
- Writes go through RLS (`districts_super_admin_all`) with audit-logged actions in `lib/actions/districts.ts`.

### 2. District-admin role assignment (add/remove) — ✅ DONE (via a specific, already-decided model)
Not an arbitrary "add/remove N admins" list. The shipped model is:
- **A district's admins ARE its two POCs.** `createDistrict` provisions two real `district_admin`
  login accounts (primary/secondary); `updateDistrict` edits them; `inviteDistrictPoc` sends/re-sends
  a set-password invite via Resend (create-now / invite-later, re-sendable).
- **Plus** the self-service path: `/admin/signups` → `decision-form.tsx` can approve a signup with an
  editable `role` (including `district_admin`), district, and school.

⚠ **Confirm, don't build:** if you want more than two district admins per district, or an explicit
add/remove-admin table decoupled from the POC slots, that's a *product* change to the POC model —
flag for a decision, not a gap to fill.

### 3. Cross-district user listing for super-admin — ❌ GENUINE GAP
No flat "all users across all districts" surface. `admin-nav.tsx` offers only: Signup requests,
Import students, Districts, Super admins. Super admins reach users by drilling
district → school → subject → class → period; `/admin/super-admins` lists *only* super admins.
There is no global user search/list.
- **Is it load-bearing for onboarding? Probably not** — drill-down covers the common case. Value is
  operational (support: "find user X across tenants"). Small-to-medium build if wanted.

### 4. Cross-district analytics — ❌ GAP, but already DEFERRED
`/district/analytics` and `/district/assignments` are `ComingSoon` stubs; the `/admin` dashboard is a
stub ("proper dashboard … in Phase 6"). The backlog itself defers this until the per-assignment
analytics shape from chunk 5.2 stabilizes, and expects it to reuse those card components. **Leave deferred.**

## Conclusion / recommendation

The backlog item's original framing ("rebuild the deleted CRUD") is **obsolete** — close it and
replace with the two carved-out slices:

1. **Cross-district user listing for super-admin** — the only unblocked, genuinely-missing piece.
   Medium value (operational, not onboarding-blocking), small-to-medium effort.
2. **Cross-district analytics** — keep deferred behind chunk 5.2 (unchanged).

Plus a one-line **product question** for you: is the 2-POC model the intended ceiling for district
admins, or do you want an explicit multi-admin add/remove table? (Answer decides whether #2's
requirement is truly "done" or needs a follow-up.)

**My recommendation for the immediate next build:** *not* this item. It's mostly done, and the one
remaining unblocked slice (cross-district user list) is operational polish, not onboarding-critical.
Given that, the better near-term pickup is the small self-contained **Storage upload UI failure
surface** win, and revisit the cross-district user list when a support/ops need for it actually surfaces.

## Files reviewed
`app/admin/districts/**` (page, districts-browser, district-form, new-district-panel,
[id]/page, edit-district-panel, poc-invite-button), `app/admin/admin-nav.tsx`, `app/admin/page.tsx`,
`app/admin/signups/**`, `app/admin/super-admins/**`, `app/district/**` (analytics/assignments stubs),
`lib/actions/districts.ts`, `lib/actions/auth.ts`.
