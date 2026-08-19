/**
 * Admin-initiated password reset.
 *
 * The forgot-password form (requestResetAction) covers a user who can still
 * reach their own inbox and remembers which address they signed up with. This
 * covers the case that actually generates support load in a school: a teacher
 * or student who cannot get in, standing in front of someone who can help.
 *
 * Mechanically the same as inviteDistrictPoc — mint a Supabase recovery link
 * with the service role, wrap it in buildConfirmUrl so the token is verified
 * server-side where cookies stick, and deliver through Resend rather than
 * Supabase's default mailer.
 *
 * Two things differ from the self-service path, both deliberate:
 *
 *   1. It does NOT return the generic "if an account exists…" reply. That
 *      wording exists to stop an ANONYMOUS caller using the form to discover
 *      which addresses are registered — notably which children attend a given
 *      district. An authenticated admin acting inside their own scope already
 *      knows who is in it, so the ambiguity would buy no privacy and would
 *      leave them unable to tell "sent" from "that user does not exist".
 *
 *   2. It is scope-checked rather than open. The rule lives in
 *      lib/reset-scope.ts, which is where it is also tested.
 */

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { getDistrictBrandingFromHeaders } from "@/lib/branding-headers";
import { sendEmail } from "@/lib/email/client";
import { renderPasswordReset } from "@/lib/email/templates/password-reset";
import { buildConfirmUrl } from "@/lib/auth-links";
import { canSendResetEmail } from "@/lib/reset-throttle";
import { writeAuditLog } from "@/lib/audit-log";
import { canReset } from "@/lib/reset-scope";
export type SendResetResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Send a set-a-new-password link to one user.
 *
 * Returns a plain result rather than throwing so the calling button can render
 * the outcome inline. A failure to deliver is reported with the provider's
 * reason — the same call the POC invite makes, and for the same reason:
 * retrying never fixes a sender-domain misconfiguration, and a generic "try
 * again" sends an admin in circles.
 */
export async function sendPasswordResetToUser(
  userId: string
): Promise<SendResetResult> {
  const actor = await requireUser();

  if (!userId) return { ok: false, error: "No user specified." };

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("user_profiles")
    .select("id, email, first_name, role, district_id, school_id")
    .eq("id", userId)
    .maybeSingle();

  if (!target) return { ok: false, error: "That user could not be found." };
  if (!canReset(actor, target)) {
    return { ok: false, error: "You can't send a reset to that user." };
  }
  if (!target.email) {
    return {
      ok: false,
      error: "That user has no email address on file to send to.",
    };
  }

  // Throttle BEFORE minting, for the reason requestResetAction gives:
  // generateLink is what stamps recovery_sent_at, so checking afterwards
  // would always read our own write. Two admins looking at the same stuck
  // teacher is the realistic way this gets hit.
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const lastSent = (authUser?.user as unknown as Record<string, unknown>)
    ?.recovery_sent_at;
  if (
    !canSendResetEmail(typeof lastSent === "string" ? lastSent : null)
  ) {
    return {
      ok: false,
      error:
        "A reset link was sent to that user less than a minute ago. Give it a moment before sending another.",
    };
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email: target.email,
    });

  // NOT properties.action_link — that returns its tokens in a hash fragment
  // the server never receives, which lands the recipient on a page with no
  // session and an "expired link" message. See lib/auth-links.ts.
  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    return {
      ok: false,
      error: linkError?.message ?? "Could not generate a reset link.",
    };
  }

  const resetUrl = buildConfirmUrl({
    siteUrl: await getSiteUrl(),
    hashedToken,
    type: "recovery",
    next: "/reset-password?recovery=1",
  });

  const branding = await getDistrictBrandingFromHeaders();
  const message = renderPasswordReset({
    firstName: target.first_name,
    districtName: branding.name,
    primaryColor: branding.primary_color ?? "#2563eb",
    resetUrl,
    // Swaps "we received a request" for "an administrator has sent you a
    // link", and drops the "ignore this if you didn't ask" line that would
    // otherwise tell the user to discard what their admin just sent.
    initiatedBy: "admin",
  });

  const sent = await sendEmail({ to: target.email, ...message });

  await writeAuditLog({
    actor_id: actor.id,
    action: "user.password_reset.send",
    target_scope: { user_id: target.id },
    metadata: { email: target.email, delivery: sent.ok ? "sent" : "failed" },
    district_id: target.district_id,
    school_id: target.school_id,
  });

  if (!sent.ok) {
    return {
      ok: false,
      error: `The link was created but the email didn't send: ${sent.error ?? "unknown error"}`,
    };
  }

  revalidatePath("/admin/users");
  revalidatePath("/district/users");
  revalidatePath("/school/teachers");
  revalidatePath("/school/students");

  return { ok: true, message: `Reset link sent to ${target.email}.` };
}
