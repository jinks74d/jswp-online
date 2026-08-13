/**
 * District management server actions (super-admin only).
 *
 * Writes go through the RLS server client (districts_super_admin_all enforces
 * the role at the DB); requireRole is a defense-in-depth gate at the action
 * layer. The audit_log insert uses the admin client because audit_log has no
 * INSERT policy — the service role is its only writer.
 *
 * A district is created with two required Points of Contact (POCs), each a real
 * district_admin login account. Because districts <-> user_profiles form a
 * circular FK, createDistrict inserts the district first, then the two POC
 * accounts (which need district_id), then backfills primary_poc_id /
 * secondary_poc_id. The set-password invite is sent separately and on demand
 * via inviteDistrictPoc (so a district can be created now and invited later,
 * and invites can be re-sent).
 *
 * Two POCs is the intentional ceiling for district-admin management (product
 * decision, Raymond, 2026-07-02). The super-admin UI manages exactly the
 * primary + secondary POC; there is deliberately no "add an Nth district admin"
 * table. A rare additional district_admin can still be granted via the
 * /admin/signups approval flow (an editable role), but that is the escape
 * hatch, not the primary model — do not build multi-admin CRUD here without a
 * fresh decision.
 */

"use server";

import "server-only";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit-log";
import { createScopedUser } from "@/lib/scoped-users";
import { sendEmail } from "@/lib/email/client";
import { buildConfirmUrl } from "@/lib/auth-links";
import { renderDistrictPocInvite } from "@/lib/email/templates/district-poc-invite";

type PocFieldErrors = {
  primary_poc_first_name?: string;
  primary_poc_last_name?: string;
  primary_poc_email?: string;
  primary_poc_phone?: string;
  secondary_poc_first_name?: string;
  secondary_poc_last_name?: string;
  secondary_poc_email?: string;
  secondary_poc_phone?: string;
};

export type DistrictFormState = {
  error?: string;
  fieldErrors?: {
    name?: string;
    subdomain?: string;
    contact_email?: string;
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
  } & PocFieldErrors;
  success?: string;
};

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\//;

function emptyToNull(s: string): string | null {
  const v = s.trim();
  return v === "" ? null : v;
}

function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

function parseDistrictForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    subdomain: String(formData.get("subdomain") ?? "")
      .trim()
      .toLowerCase(),
    contactEmail: emptyToNull(String(formData.get("contact_email") ?? "")),
    primaryColor: emptyToNull(String(formData.get("primary_color") ?? "")),
    secondaryColor: emptyToNull(String(formData.get("secondary_color") ?? "")),
    logoUrl: emptyToNull(String(formData.get("logo_url") ?? "")),
    active:
      formData.get("active") === "on" || formData.get("active") === "true",
  };
}

type ParsedDistrict = ReturnType<typeof parseDistrictForm>;

function validate(f: ParsedDistrict): DistrictFormState["fieldErrors"] | null {
  const fe: NonNullable<DistrictFormState["fieldErrors"]> = {};
  if (!f.name) fe.name = "District name is required.";
  if (f.subdomain && !SUBDOMAIN_RE.test(f.subdomain))
    fe.subdomain = "Lowercase letters, numbers, and hyphens only (max 63).";
  if (f.contactEmail && !EMAIL_RE.test(f.contactEmail))
    fe.contact_email = "Enter a valid email address.";
  if (f.primaryColor && !HEX_RE.test(f.primaryColor))
    fe.primary_color = "Use a hex color like #1E40AF.";
  if (f.secondaryColor && !HEX_RE.test(f.secondaryColor))
    fe.secondary_color = "Use a hex color like #1E40AF.";
  if (f.logoUrl && !URL_RE.test(f.logoUrl))
    fe.logo_url = "Must start with http:// or https://.";
  return Object.keys(fe).length ? fe : null;
}

type ParsedPoc = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

function parsePoc(formData: FormData, prefix: "primary" | "secondary"): ParsedPoc {
  return {
    firstName: String(formData.get(`${prefix}_poc_first_name`) ?? "").trim(),
    lastName: String(formData.get(`${prefix}_poc_last_name`) ?? "").trim(),
    email: String(formData.get(`${prefix}_poc_email`) ?? "").trim(),
    phone: String(formData.get(`${prefix}_poc_phone`) ?? "").trim(),
  };
}

/** Validate one POC; writes errors into `fe` under the prefixed keys. */
function validatePoc(
  poc: ParsedPoc,
  prefix: "primary" | "secondary",
  fe: NonNullable<DistrictFormState["fieldErrors"]>
): void {
  if (!poc.firstName) fe[`${prefix}_poc_first_name`] = "First name is required.";
  if (!poc.lastName) fe[`${prefix}_poc_last_name`] = "Last name is required.";
  if (!poc.email) fe[`${prefix}_poc_email`] = "Email is required.";
  else if (!EMAIL_RE.test(poc.email))
    fe[`${prefix}_poc_email`] = "Enter a valid email address.";
  if (!poc.phone) fe[`${prefix}_poc_phone`] = "Phone number is required.";
  else if (digitCount(poc.phone) < 7)
    fe[`${prefix}_poc_phone`] = "Enter a valid phone number.";
}

function isUniqueViolation(message: string | undefined): boolean {
  return /duplicate|unique|already exists/i.test(message ?? "");
}

async function getSiteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol =
    host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https";
  return `${protocol}://${host}`;
}

export async function createDistrict(
  _prev: DistrictFormState,
  formData: FormData
): Promise<DistrictFormState> {
  const actor = await requireRole("super_admin");
  const f = parseDistrictForm(formData);
  const primary = parsePoc(formData, "primary");
  const secondary = parsePoc(formData, "secondary");

  const fe: NonNullable<DistrictFormState["fieldErrors"]> = validate(f) ?? {};
  validatePoc(primary, "primary", fe);
  validatePoc(secondary, "secondary", fe);
  if (
    primary.email &&
    secondary.email &&
    primary.email.toLowerCase() === secondary.email.toLowerCase()
  ) {
    fe.secondary_poc_email = "Secondary POC must use a different email.";
  }
  if (Object.keys(fe).length) return { fieldErrors: fe };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("districts")
    .insert({
      name: f.name,
      subdomain: f.subdomain || null,
      contact_email: f.contactEmail,
      primary_color: f.primaryColor,
      secondary_color: f.secondaryColor,
      logo_url: f.logoUrl,
      active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error?.message))
      return { fieldErrors: { subdomain: "That subdomain is already taken." } };
    return { error: error?.message ?? "Could not create the district." };
  }

  const districtId = data.id;
  const admin = createAdminClient();

  // Create the two POC district_admin accounts. On any failure, roll the whole
  // thing back (delete created accounts + the district) so we never leave a
  // half-provisioned district behind.
  const created: string[] = [];

  async function rollback() {
    for (const uid of created) {
      // deleting auth.users cascades to user_profiles (FK ON DELETE CASCADE).
      await admin.auth.admin.deleteUser(uid).catch(() => {});
    }
    await supabase.from("districts").delete().eq("id", districtId);
  }

  const primaryRes = await createScopedUser({
    role: "district_admin",
    districtId,
    schoolId: null,
    firstName: primary.firstName,
    lastName: primary.lastName,
    email: primary.email,
    phone: primary.phone,
  });
  if (!primaryRes.ok) {
    await rollback();
    if (primaryRes.duplicateEmail)
      return {
        fieldErrors: {
          primary_poc_email: "An account with this email already exists.",
        },
      };
    return { error: primaryRes.error };
  }
  created.push(primaryRes.userId);

  const secondaryRes = await createScopedUser({
    role: "district_admin",
    districtId,
    schoolId: null,
    firstName: secondary.firstName,
    lastName: secondary.lastName,
    email: secondary.email,
    phone: secondary.phone,
  });
  if (!secondaryRes.ok) {
    await rollback();
    if (secondaryRes.duplicateEmail)
      return {
        fieldErrors: {
          secondary_poc_email: "An account with this email already exists.",
        },
      };
    return { error: secondaryRes.error };
  }
  created.push(secondaryRes.userId);

  // Backfill the POC FKs now that both accounts exist.
  const { error: pocErr } = await supabase
    .from("districts")
    .update({
      primary_poc_id: primaryRes.userId,
      secondary_poc_id: secondaryRes.userId,
    })
    .eq("id", districtId);
  if (pocErr) {
    await rollback();
    return { error: pocErr.message };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "district.create",
    target_scope: { district_id: districtId },
    metadata: {
      name: f.name,
      subdomain: f.subdomain || null,
      primary_poc_email: primary.email,
      secondary_poc_email: secondary.email,
    },
    district_id: districtId,
    school_id: null,
  });

  revalidatePath("/admin/districts");
  return {
    success: `Created “${f.name}”. Send the POC invites from the district page.`,
  };
}

export async function updateDistrict(
  _prev: DistrictFormState,
  formData: FormData
): Promise<DistrictFormState> {
  const actor = await requireRole("super_admin");
  const id = String(formData.get("district_id") ?? "");
  if (!id) return { error: "Missing district id." };

  const f = parseDistrictForm(formData);
  const primary = parsePoc(formData, "primary");
  const secondary = parsePoc(formData, "secondary");
  const fe: NonNullable<DistrictFormState["fieldErrors"]> = validate(f) ?? {};

  const admin = createAdminClient();

  // Resolve the district's real POC account ids from the DB (don't trust the
  // client) so we know which slots update an existing account vs. provision one.
  const { data: dist, error: distErr } = await admin
    .from("districts")
    .select("primary_poc_id, secondary_poc_id")
    .eq("id", id)
    .maybeSingle();
  if (distErr || !dist) {
    return { error: distErr?.message ?? "District not found." };
  }

  const slots = [
    {
      prefix: "primary" as const,
      poc: primary,
      existingId: dist.primary_poc_id,
      fk: "primary_poc_id" as const,
    },
    {
      prefix: "secondary" as const,
      poc: secondary,
      existingId: dist.secondary_poc_id,
      fk: "secondary_poc_id" as const,
    },
  ];

  // A POC slot is validated when it already has an account (you can't blank an
  // existing contact) or when any field was filled (adding a missing contact).
  const hasAny = (p: ParsedPoc) =>
    !!(p.firstName || p.lastName || p.email || p.phone);
  for (const s of slots) {
    if (s.existingId || hasAny(s.poc)) validatePoc(s.poc, s.prefix, fe);
  }
  if (
    primary.email &&
    secondary.email &&
    primary.email.toLowerCase() === secondary.email.toLowerCase()
  ) {
    fe.secondary_poc_email = "Secondary POC must use a different email.";
  }
  if (Object.keys(fe).length) return { fieldErrors: fe };

  // Current POC emails, to skip auth email churn when unchanged.
  const existingIds = slots
    .map((s) => s.existingId)
    .filter((v): v is string => !!v);
  const currentEmail = new Map<string, string | null>();
  if (existingIds.length > 0) {
    const { data: rows } = await admin
      .from("user_profiles")
      .select("id, email")
      .in("id", existingIds);
    for (const r of rows ?? []) currentEmail.set(r.id, r.email);
  }

  // District fields go through the RLS client (districts_super_admin_all).
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("districts")
    .update({
      name: f.name,
      subdomain: f.subdomain || null,
      contact_email: f.contactEmail,
      primary_color: f.primaryColor,
      secondary_color: f.secondaryColor,
      logo_url: f.logoUrl,
      active: f.active,
    })
    .eq("id", id);

  if (error) {
    if (isUniqueViolation(error.message))
      return { fieldErrors: { subdomain: "That subdomain is already taken." } };
    return { error: error.message };
  }

  // Apply POC changes: update existing accounts, provision newly-added ones.
  const newFk: { primary_poc_id?: string; secondary_poc_id?: string } = {};
  for (const s of slots) {
    if (s.existingId) {
      const prev = currentEmail.get(s.existingId);
      if (prev !== undefined && prev?.toLowerCase() !== s.poc.email.toLowerCase()) {
        const { error: emailErr } = await admin.auth.admin.updateUserById(
          s.existingId,
          { email: s.poc.email }
        );
        if (emailErr) {
          if (/already|exists|registered/i.test(emailErr.message))
            return {
              fieldErrors: {
                [`${s.prefix}_poc_email`]:
                  "An account with this email already exists.",
              },
            };
          return { error: emailErr.message };
        }
      }
      const { error: upErr } = await admin
        .from("user_profiles")
        .update({
          first_name: s.poc.firstName,
          last_name: s.poc.lastName,
          email: s.poc.email,
          phone: s.poc.phone,
        })
        .eq("id", s.existingId);
      if (upErr) return { error: upErr.message };
    } else if (hasAny(s.poc)) {
      const res = await createScopedUser({
        role: "district_admin",
        districtId: id,
        schoolId: null,
        firstName: s.poc.firstName,
        lastName: s.poc.lastName,
        email: s.poc.email,
        phone: s.poc.phone,
      });
      if (!res.ok) {
        if (res.duplicateEmail)
          return {
            fieldErrors: {
              [`${s.prefix}_poc_email`]:
                "An account with this email already exists.",
            },
          };
        return { error: res.error };
      }
      newFk[s.fk] = res.userId;
    }
  }
  if (Object.keys(newFk).length > 0) {
    const { error: fkErr } = await supabase
      .from("districts")
      .update(newFk)
      .eq("id", id);
    if (fkErr) return { error: fkErr.message };
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "district.update",
    target_scope: { district_id: id },
    metadata: { name: f.name, active: f.active },
    district_id: id,
    school_id: null,
  });

  revalidatePath("/admin/districts");
  revalidatePath(`/admin/districts/${id}`);
  return { success: "Saved." };
}

/* ─── POC invitations ────────────────────────────────────────────────────
 *
 * Sends (or re-sends) a set-password invite to a district POC. Generates a
 * Supabase recovery link (?code → /reset-password, same flow as forgot
 * password) and delivers it through the branded Resend template. Best-effort
 * email: invited_at is only stamped when the send is attempted.
 */

export type PocInviteState = { error?: string; success?: string };

export async function inviteDistrictPoc(
  _prev: PocInviteState,
  formData: FormData
): Promise<PocInviteState> {
  const actor = await requireRole("super_admin");
  const userId = String(formData.get("user_id") ?? "");
  const districtId = String(formData.get("district_id") ?? "");
  if (!userId || !districtId) return { error: "Missing POC or district id." };

  const admin = createAdminClient();

  // Confirm the target is a district_admin POC of this district.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, role, first_name, email, district_id")
    .eq("id", userId)
    .maybeSingle();

  if (
    !profile ||
    !profile.email ||
    profile.role !== "district_admin" ||
    profile.district_id !== districtId
  ) {
    return { error: "That contact isn’t a district admin for this district." };
  }

  const siteUrl = await getSiteUrl();
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
    });

  // See lib/auth-links.ts: action_link returns its tokens in a hash fragment
  // the server never receives, so the invite landed the recipient on a page
  // with no session and an "expired link" message. Verify server-side instead.
  const hashedToken = linkData?.properties?.hashed_token;
  const actionLink = hashedToken
    ? buildConfirmUrl({
        siteUrl,
        hashedToken,
        type: "recovery",
        next: "/reset-password?recovery=1",
      })
    : null;
  if (linkError || !actionLink) {
    return {
      error: linkError?.message ?? "Could not generate the invite link.",
    };
  }

  const { data: district } = await admin
    .from("districts")
    .select("name")
    .eq("id", districtId)
    .maybeSingle();

  const email = renderDistrictPocInvite({
    firstName: profile.first_name ?? "there",
    districtName: district?.name ?? "your district",
    inviteUrl: actionLink,
  });
  const sent = await sendEmail({ to: profile.email, ...email });

  // Only stamp invited_at when the message actually went out. Stamping on a
  // failed send made the POC row read "Invited <today>" for an invite that was
  // never delivered — the one piece of UI a super admin uses to decide whether
  // to chase it.
  if (sent.ok) {
    await admin
      .from("user_profiles")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", userId);
  }

  await writeAuditLog({
    actor_id: actor.id,
    action: "district.poc.invite",
    target_scope: { district_id: districtId, user_id: userId },
    metadata: { email: profile.email, delivery: sent.ok ? "sent" : "failed" },
    district_id: districtId,
    school_id: null,
  });

  revalidatePath(`/admin/districts/${districtId}`);

  if (!sent.ok) {
    // Surface the provider's reason. This action is super-admin-only, and the
    // generic "try again" sent the admin in circles — retrying never fixes a
    // sender/domain misconfiguration, which is what this failure usually is.
    return {
      error: `Could not send the invite to ${profile.email}: ${sent.error}`,
    };
  }
  return { success: `Invite sent to ${profile.email}.` };
}
