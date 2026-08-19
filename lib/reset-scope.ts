/**
 * Who may send a password reset to whom.
 *
 * Split out of lib/actions/password-reset.ts for two reasons. A `"use server"`
 * module may only export async functions, so this could not be exported from
 * there at all; and this is the security decision in the feature — everything
 * else is link-minting and mail delivery. A mistake here emails a
 * password-set link for someone's account to an administrator who should not
 * have been able to reach it, which is the kind of bug that never announces
 * itself.
 *
 * Enforced in TypeScript rather than by an RLS policy because the send runs on
 * the admin client and so bypasses RLS entirely. The containment below
 * deliberately mirrors what auth_user_is_admin_for_district() and
 * auth_user_is_admin_for_school() already encode, rather than inventing a
 * second hierarchy (CLAUDE.md §14.4).
 *
 * Pure — no Supabase, no `server-only`. Tested in __tests__/lib/reset-scope.test.ts.
 */

import type { Database } from "@/lib/database.types";

type JswpRole = Database["public"]["Enums"]["jswp_role"];

/** The subset of a profile the decision needs, on either side. */
export type ResetParty = {
  id: string;
  role: JswpRole;
  district_id: string | null;
  school_id: string | null;
};

export function canReset(actor: ResetParty, target: ResetParty): boolean {
  // Not a security boundary — an admin resetting their own password is
  // harmless — but it routes them to the self-service form, which is the flow
  // built for someone who is currently signed in.
  if (actor.id === target.id) return false;

  // A platform-wide account is never resettable by a tenant-scoped admin.
  // Without this, a district admin could mail a password-set link for a super
  // admin into an inbox they may well control, and that is a full compromise
  // of every district on the platform rather than of one.
  if (target.role === "super_admin") return actor.role === "super_admin";

  switch (actor.role) {
    case "super_admin":
      return true;

    case "district_admin":
      // Explicit null check: two districtless users must not match each other
      // through `null === null`. The column is NOT NULL for every role that
      // can be a target today, so this is a guard against a future role
      // (district_analyst already sits outside the school hierarchy) rather
      // than a live hole.
      return (
        actor.district_id !== null && target.district_id === actor.district_id
      );

    case "school_admin":
      // Same reasoning, and it bites harder here: district admins and
      // analysts legitimately carry school_id = null, so a loose comparison
      // would let one school admin reset every districtless admin above them.
      return actor.school_id !== null && target.school_id === actor.school_id;

    // Teachers are deliberately excluded. Resetting a student's password is a
    // real and common need in K-12, but it is a policy decision about minors'
    // accounts rather than a technical one and wants an explicit answer first.
    // Tracked in docs/BACKLOG.md.
    case "teacher":
    case "student":
    case "district_analyst":
    default:
      return false;
  }
}
