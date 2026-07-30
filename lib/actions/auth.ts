/**
 * Server actions for the auth flow: sign in, sign up, request reset,
 * update password, sign out.
 *
 * All actions run server-side, use the @supabase/ssr cookie-based session,
 * and call redirect() from next/navigation on success. On failure they
 * return a state object consumed by useFormState in the client form.
 */

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRedirectPath } from "@/lib/auth";

export type AuthFormState = {
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
    confirmPassword?: string;
  };
  success?: string;
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */

async function getSiteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol =
    host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https";
  return `${protocol}://${host}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ─── Sign in ─────────────────────────────────────────────────────────── */

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: error?.message ?? "Sign in failed. Please try again." };
  }

  // Fetch the user's profile to determine where to redirect.
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, district_id")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    // Auth succeeded but no profile exists — they're either still pending
    // admin approval or were denied. Land them on /pending which reads
    // their signup_requests row and shows status. The user stays logged
    // in so a freshly-approved profile is visible after a refresh.
    redirect("/pending");
  }

  // Subdomain mismatch check (prod only — in dev the middleware always
  // resolves to "demo" so this is effectively a no-op).
  const h = await headers();
  const districtFromSubdomain = h.get("x-jswp-district-id");
  const baseDomain = process.env.NEXT_PUBLIC_JSWP_BASE_DOMAIN;

  if (
    baseDomain &&
    districtFromSubdomain &&
    // Super admins are districtless and sign in on the apex domain — skip.
    profile.district_id &&
    districtFromSubdomain !== profile.district_id
  ) {
    const admin = createAdminClient();
    const { data: district } = await admin
      .from("districts")
      .select("subdomain")
      .eq("id", profile.district_id)
      .single();

    if (district?.subdomain) {
      // Sign out on the wrong subdomain so the cookie doesn't linger.
      await supabase.auth.signOut();
      redirect(`https://${district.subdomain}.${baseDomain}/login`);
    }
  }

  redirect(getRedirectPath(profile.role));
}

/* ─── Sign up ─────────────────────────────────────────────────────────── */

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const requestedRole = String(formData.get("requested_role") ?? "teacher");
  const requestedSchoolIdRaw = String(formData.get("requested_school_id") ?? "");
  const requestedSchoolId =
    requestedSchoolIdRaw === "" ? null : requestedSchoolIdRaw;
  const message = String(formData.get("message") ?? "").trim() || null;

  const fieldErrors: AuthFormState["fieldErrors"] = {};

  if (!email) fieldErrors.email = "Email is required.";
  else if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email.";

  if (!password) fieldErrors.password = "Password is required.";
  else if (password.length < 8)
    fieldErrors.password = "Password must be at least 8 characters.";

  if (password !== confirmPassword)
    fieldErrors.confirmPassword = "Passwords do not match.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  if (!firstName || !lastName) {
    return { error: "First and last name are required." };
  }

  if (
    requestedRole !== "teacher" &&
    requestedRole !== "school_admin" &&
    requestedRole !== "district_admin"
  ) {
    return { error: "Pick a valid role." };
  }

  // Resolve district from middleware-set header (apex signups have no
  // district; super_admin reviews those).
  const h = await headers();
  const requestedDistrictIdRaw = h.get("x-jswp-district-id");
  const requestedDistrictId = requestedDistrictIdRaw || null;

  const supabase = await createServerClient();
  const siteUrl = await getSiteUrl();

  // Create the auth.users row + send Supabase's email-confirmation link.
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/login?confirmed=1")}`,
    },
  });

  if (signUpError) return { error: signUpError.message };

  const newUserId = signUpData.user?.id;
  if (!newUserId) {
    return {
      error:
        "Account created, but we couldn't queue your application. Please contact support.",
    };
  }

  // Insert the signup_request via the admin client (no INSERT policy for
  // authenticated). Same partial-failure cleanup pattern as roster-import:
  // if this fails, delete the orphan auth user.
  const admin = createAdminClient();
  const { error: insertError } = await admin.from("signup_requests").insert({
    auth_user_id: newUserId,
    email,
    first_name: firstName,
    last_name: lastName,
    requested_role: requestedRole as "teacher" | "school_admin" | "district_admin",
    requested_district_id: requestedDistrictId,
    requested_school_id: requestedSchoolId,
    message,
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(newUserId).catch(() => {
      /* swallow — surfaced via insertError */
    });
    return { error: `Couldn't queue your application: ${insertError.message}` };
  }

  return {
    success:
      "Check your email for a confirmation link. Once you confirm and an administrator approves your account, you'll be able to sign in.",
  };
}

/* ─── Request password reset ──────────────────────────────────────────── */

export async function requestResetAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) return { fieldErrors: { email: "Email is required." } };
  if (!isValidEmail(email))
    return { fieldErrors: { email: "Enter a valid email." } };

  const supabase = await createServerClient();
  const siteUrl = await getSiteUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "If an account exists for that email, a reset link is on its way. Check your inbox.",
  };
}

/* ─── Update password (after reset link click) ────────────────────────── */

export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: AuthFormState["fieldErrors"] = {};

  if (!password) fieldErrors.password = "Password is required.";
  else if (password.length < 8)
    fieldErrors.password = "Password must be at least 8 characters.";

  if (password !== confirmPassword)
    fieldErrors.confirmPassword = "Passwords do not match.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  // Sign out so the user re-authenticates with the new password.
  await supabase.auth.signOut();
  redirect("/login?reset=1");
}

/* ─── Sign out ────────────────────────────────────────────────────────── */

export async function signOutAction(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
