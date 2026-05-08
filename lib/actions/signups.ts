/**
 * Server actions for the admin-side signup_requests review queue:
 *   approveSignup — calls approve_signup_request RPC, sends approval email
 *   denySignup    — calls deny_signup_request RPC, sends denial email
 *   deleteDeniedSignup — permanently removes a denied request + auth.users
 *
 * RPCs are SECURITY DEFINER (defined in migration 0006) and atomically
 * lock the signup_request row, so concurrent admin actions can't double-
 * apply. The action layer enforces scope via requireRole + RLS-scoped
 * read; the RPC enforces state-machine rules (must be 'pending').
 */

"use server";

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { renderAccountApproved } from "@/lib/email/templates/account-approved";
import { renderAccountDenied } from "@/lib/email/templates/account-denied";

export type DecisionFormState = {
  error?: string;
  fieldErrors?: {
    role?: string;
    district_id?: string;
    school_id?: string;
    denial_reason?: string;
  };
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

async function getSiteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol =
    host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https";
  return `${protocol}://${host}`;
}

async function getDistrictName(districtId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("districts")
    .select("name")
    .eq("id", districtId)
    .single();
  return data?.name ?? "your district";
}

/* ─── Approve ────────────────────────────────────────────────────────── */

export async function approveSignup(
  _prev: DecisionFormState,
  formData: FormData
): Promise<DecisionFormState> {
  const adminProfile = await requireRole([
    "super_admin",
    "district_admin",
    "school_admin",
  ]);

  const signupRequestId = String(formData.get("signup_request_id") ?? "");
  const role = String(formData.get("role") ?? "") as
    | "teacher"
    | "school_admin"
    | "district_admin";
  const districtId = String(formData.get("district_id") ?? "");
  const schoolIdRaw = String(formData.get("school_id") ?? "");
  const schoolId = schoolIdRaw === "" ? null : schoolIdRaw;
  const decisionNotes = String(formData.get("decision_notes") ?? "").trim() || null;

  const fieldErrors: DecisionFormState["fieldErrors"] = {};
  if (!["teacher", "school_admin", "district_admin"].includes(role))
    fieldErrors.role = "Pick a role.";
  if (!districtId) fieldErrors.district_id = "Pick a district.";
  if (role !== "district_admin" && !schoolId)
    fieldErrors.school_id = "School is required for this role.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // Use the RLS-scoped client so admins outside scope can't approve.
  const supabase = await createServerClient();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "approve_signup_request" as never,
    {
      p_signup_request_id: signupRequestId,
      p_role: role,
      p_district_id: districtId,
      p_school_id: schoolId,
      p_decided_by: adminProfile.id,
      p_decision_notes: decisionNotes,
    } as never
  );

  if (rpcError) {
    return { error: rpcError.message };
  }

  // Pull fields we need for the audit log + email. The RPC returned the
  // new user_profiles row but we also want the request's email/first_name.
  const admin = createAdminClient();
  const { data: sr } = await admin
    .from("signup_requests")
    .select("email, first_name, auth_user_id")
    .eq("id", signupRequestId)
    .single();

  await admin.from("audit_log").insert({
    actor_id: adminProfile.id,
    action: "signup.approve",
    target_scope: { signup_request_id: signupRequestId },
    metadata: {
      auth_user_id: sr?.auth_user_id ?? null,
      role,
      district_id: districtId,
      school_id: schoolId,
    },
    district_id: districtId,
    school_id: schoolId,
  });

  // Best-effort email.
  if (sr) {
    const districtName = await getDistrictName(districtId);
    const siteUrl = await getSiteUrl();
    const email = renderAccountApproved({
      firstName: sr.first_name,
      districtName,
      loginUrl: `${siteUrl}/login`,
    });
    await sendEmail({ to: sr.email, ...email });
  }

  // Discard the unused rpcData reference (TS strict-mode lint).
  void rpcData;

  revalidatePath("/admin/signups");
  redirect("/admin/signups");
}

/* ─── Deny ───────────────────────────────────────────────────────────── */

export async function denySignup(
  _prev: DecisionFormState,
  formData: FormData
): Promise<DecisionFormState> {
  const adminProfile = await requireRole([
    "super_admin",
    "district_admin",
    "school_admin",
  ]);

  const signupRequestId = String(formData.get("signup_request_id") ?? "");
  const denialReason = String(formData.get("denial_reason") ?? "").trim();
  const decisionNotes = String(formData.get("decision_notes") ?? "").trim() || null;

  if (!denialReason) {
    return { fieldErrors: { denial_reason: "A reason is required." } };
  }

  const supabase = await createServerClient();
  const { error: rpcError } = await supabase.rpc(
    "deny_signup_request" as never,
    {
      p_signup_request_id: signupRequestId,
      p_decided_by: adminProfile.id,
      p_denial_reason: denialReason,
      p_decision_notes: decisionNotes,
    } as never
  );

  if (rpcError) {
    return { error: rpcError.message };
  }

  const admin = createAdminClient();
  const { data: sr } = await admin
    .from("signup_requests")
    .select("email, first_name, auth_user_id, requested_district_id, requested_school_id")
    .eq("id", signupRequestId)
    .single();

  await admin.from("audit_log").insert({
    actor_id: adminProfile.id,
    action: "signup.deny",
    target_scope: { signup_request_id: signupRequestId },
    metadata: {
      auth_user_id: sr?.auth_user_id ?? null,
      denial_reason: denialReason,
    },
    district_id: sr?.requested_district_id ?? null,
    school_id: sr?.requested_school_id ?? null,
  });

  if (sr) {
    const districtName = sr.requested_district_id
      ? await getDistrictName(sr.requested_district_id)
      : "JSWP Online";
    const email = renderAccountDenied({
      firstName: sr.first_name,
      districtName,
      denialReason,
    });
    await sendEmail({ to: sr.email, ...email });
  }

  revalidatePath("/admin/signups");
  redirect("/admin/signups");
}

/* ─── Permanently delete denied request ──────────────────────────────── */

export async function deleteDeniedSignup(formData: FormData): Promise<void> {
  const adminProfile = await requireRole([
    "super_admin",
    "district_admin",
    "school_admin",
  ]);

  const signupRequestId = String(formData.get("signup_request_id") ?? "");

  // Read via RLS-scoped client first — confirms admin has scope AND that
  // status='denied' (RLS DELETE policy enforces both).
  const supabase = await createServerClient();
  const { data: sr, error: readErr } = await supabase
    .from("signup_requests")
    .select("auth_user_id, requested_district_id, requested_school_id, status")
    .eq("id", signupRequestId)
    .single();

  if (readErr || !sr) {
    throw new Error("Signup request not found or not in your scope.");
  }
  if (sr.status !== "denied") {
    throw new Error("Only denied requests can be permanently deleted.");
  }

  // Delete the auth.users row first; CASCADE drops the signup_requests row.
  const admin = createAdminClient();
  const { error: delErr } = await admin.auth.admin.deleteUser(sr.auth_user_id);
  if (delErr) {
    // Auth user might already be gone — try removing the request directly.
    await supabase.from("signup_requests").delete().eq("id", signupRequestId);
  }

  await admin.from("audit_log").insert({
    actor_id: adminProfile.id,
    action: "signup.delete",
    target_scope: { signup_request_id: signupRequestId },
    metadata: { auth_user_id: sr.auth_user_id },
    district_id: sr.requested_district_id ?? null,
    school_id: sr.requested_school_id ?? null,
  });

  revalidatePath("/admin/signups");
  redirect("/admin/signups");
}
