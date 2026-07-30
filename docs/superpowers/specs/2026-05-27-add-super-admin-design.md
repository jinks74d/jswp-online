# Design: Add Super Admin (in-app)

_Date: 2026-05-27 · Branch: v2_

## Problem

Super admins are the developers/owners of JSWP Online (Louis Educational
Concepts). There is currently **no in-app way to create one**:

- The self-signup → admin approval flow (`signup_requests` +
  `approve_signup_request` RPC) deliberately refuses to grant `super_admin`
  (DB `CHECK (requested_role IN ('teacher','school_admin','district_admin'))`).
- `scripts/seed-auth.ts` intentionally does not seed the live super admin.
- The only super admin (`raymond@farsidedev.com`) was created by hand.

We need a way for an existing super admin to add another super admin from
inside the app.

## Decisions (locked with the owner)

1. **Mechanism:** in-app admin page (not a CLI script).
2. **New accounts only** — no promotion of existing users.
3. **Temporary password** — the creating admin types an initial password and
   shares it out-of-band; the new admin changes it after first login. No
   dependency on email delivery.
4. **Super admins have no district.** They are platform owners, not scoped to
   any district or school.
5. Clear the district from the existing super_admin row so reality matches the
   new rule.

## Schema problem and fix

`user_profiles.district_id` is declared `NOT NULL` (migration `0001`), but the
same table carries `CHECK (role = 'super_admin' OR district_id IS NOT NULL)`.
The CHECK shows the original intent was **super admins may have a NULL
district**, but the `NOT NULL` column constraint contradicts it. The seed
worked around this by assigning the demo district
(`00000000-0000-0000-0000-000000000001`) to the super_admin row — wiring a
fake district onto a districtless role.

**Fix — migration `0021_user_profiles_nullable_district.sql`:**

```sql
BEGIN;

ALTER TABLE user_profiles ALTER COLUMN district_id DROP NOT NULL;

-- Existing CHECK still forces every NON-super-admin to have a district.
-- Make the existing super_admin row(s) truly districtless.
UPDATE user_profiles SET district_id = NULL WHERE role = 'super_admin';

COMMIT;
```

This only loosens the constraint for super admins. The existing CHECK continues
to require a district for teachers, students, and school/district admins.

## Type change

- `lib/database.types.ts`: `UserProfiles.district_id` `string` → `string | null`.
- `lib/auth.ts` `getCurrentDistrict(): Promise<string>` — throw a clear error if
  the profile has no district (super-admin pages do not call it; teacher /
  student / scoped-admin flows always have one). Fix any other type errors the
  nullability surfaces, type-honestly (no casting null away).

The ~24 files that read `district_id` are teacher/school/student/district-admin
flows where the value is non-null at runtime; the change forces explicit
null-handling only where a super admin could reach the code.

## Components

### Page — `app/admin/super-admins/page.tsx`

- Server component. `requireRole("super_admin")` at the top (the admin layout
  allows all three admin roles, so the page must re-gate to super-admin-only).
- Fetches existing super admins via the RLS-scoped server client
  (`user_profiles_super_admin_all` policy permits this read).
- Renders:
  1. Read-only table of existing super admins — name, email, active, created.
  2. The "Add super admin" form component (client).

### Form — `app/admin/super-admins/add-form.tsx`

- Client component using `useActionState`, matching
  `app/admin/signups/[id]/decision-form.tsx`.
- Fields: first name, last name, email, temporary password (show/hide toggle +
  a "generate" button that fills a strong random password).
- Inline field errors; a success state that confirms creation and reminds the
  admin to share the password out-of-band.

### Server action — `lib/actions/super-admins.ts` → `createSuperAdmin`

`"use server"` + `import "server-only"`.

1. `requireRole("super_admin")` — capture the acting admin's profile.
2. Validate: valid email, first/last name present, password length ≥ 10.
   Return `fieldErrors` on failure.
3. `createAdminClient().auth.admin.createUser({ email, password,
   email_confirm: true })` → capture new user id.
4. Insert `user_profiles`: `id` = new user id, `role: 'super_admin'`,
   `district_id: null`, `school_id: null`, `first_name`, `last_name`, `email`.
5. **Orphan guard:** if the profile insert fails, call
   `admin.auth.admin.deleteUser(newUserId)` before returning the error.
6. `audit_log` insert: `action: 'super_admin.create'`, `actor_id` = acting
   admin, `metadata: { new_user_id, email }`, district/school NULL.
7. `revalidatePath('/admin/super-admins')`, return success state.

Return type mirrors the existing `DecisionFormState` shape
(`{ error?, fieldErrors?, success? }`).

### Nav — `app/admin/layout.tsx`

- Add a "Super admins" link to the admin header `<nav>`, rendered only when
  `profile.role === "super_admin"`.

## Error handling

- **Duplicate email** — `auth.admin.createUser` fails for an existing auth
  email, and `user_profiles.email` is `UNIQUE`. Surface a friendly field error
  on the email input; never leave an orphan auth user.
- All errors surface inline via `useActionState`, never as silent failures.

## Security

- Page and action both gate with `requireRole("super_admin")` — defense in
  depth; the layout's broader gate is not relied upon.
- Service-role admin client is used only server-side in the action.
- Every creation writes an `audit_log` row.

## Out of scope (YAGNI)

Editing, deactivating, or deleting super admins; promoting existing users;
email-invite flow; MFA. Add-only for this iteration.

## Verification

- `npm run type-check` clean after the nullability change (proves the ripple is
  handled).
- Manual: as a super admin, open `/admin/super-admins`, add an admin, log in as
  the new account with the temp password, confirm super-admin access and that
  the new row has `district_id = NULL`.
- Manual: confirm the "Super admins" nav link is hidden for a district_admin /
  school_admin.
- Confirm a district_admin hitting `/admin/super-admins` directly is redirected
  to `/forbidden`.
