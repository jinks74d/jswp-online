/**
 * Grant and revoke cross-district analytics access (migration 0061).
 *
 * Super-admin only, both here and in the database: district_access_grants
 * carries no INSERT/UPDATE/DELETE policy at all, so these actions must use the
 * admin client and the requireRole gate is the real authorization check. A
 * district admin cannot grant access to their own district — the whole point
 * of the role is cross-tenant visibility, which is a platform-level decision.
 *
 * Both actions write to audit_log. A grant hands one person read access to a
 * district's aggregate data indefinitely; who did that, and when, is exactly
 * the kind of privileged action 0005 exists to record.
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit-log";

export type GrantResult = { ok: true } | { ok: false; error: string };

/**
 * Grant a user read access to one district's analytics.
 *
 * Idempotent: re-granting an existing pair is a no-op rather than an error,
 * because the composite primary key makes the pair the fact and a double
 * click should not fail. The audit row is still written — "attempted to grant
 * what was already granted" is legitimate history.
 */
export async function grantDistrictAccess(
  userId: string,
  districtId: string
): Promise<GrantResult> {
  const actor = await requireRole("super_admin");
  const admin = createAdminClient();

  // Refuse to grant to a role the grant cannot help. The gate function only
  // consults grants; handing one to a teacher would create a row that reads
  // as access while conferring none, which is worse than refusing.
  const { data: target, error: lookupError } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (lookupError || !target) {
    return { ok: false, error: "That user could not be found." };
  }
  if (target.role !== "district_analyst") {
    return {
      ok: false,
      error:
        "Cross-district analytics grants apply only to the district analyst role.",
    };
  }

  const { error } = await admin
    .from("district_access_grants")
    .upsert(
      { user_id: userId, district_id: districtId, granted_by: actor.id },
      { onConflict: "user_id,district_id", ignoreDuplicates: true }
    );

  if (error) {
    return { ok: false, error: `Could not grant access: ${error.message}` };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "district_access.grant",
    district_id: districtId,
    target_scope: { user_id: userId, district_id: districtId },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Revoke a user's access to one district's analytics.
 *
 * A revoked grant is a deleted row, not a flag — the history lives in
 * audit_log, so there is no second copy here to drift from it (0061 §3).
 */
export async function revokeDistrictAccess(
  userId: string,
  districtId: string
): Promise<GrantResult> {
  const actor = await requireRole("super_admin");
  const admin = createAdminClient();

  const { error } = await admin
    .from("district_access_grants")
    .delete()
    .eq("user_id", userId)
    .eq("district_id", districtId);

  if (error) {
    return { ok: false, error: `Could not revoke access: ${error.message}` };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "district_access.revoke",
    district_id: districtId,
    target_scope: { user_id: userId, district_id: districtId },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/** Every district one user has been granted. Super-admin view. */
export async function listGrantsForUser(
  userId: string
): Promise<readonly string[]> {
  await requireRole("super_admin");

  const { data, error } = await createAdminClient()
    .from("district_access_grants")
    .select("district_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to load grants: ${error.message}`);
  }
  return (data ?? []).map((r) => r.district_id);
}
