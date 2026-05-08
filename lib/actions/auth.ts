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
    // Auth succeeded but no profile exists — likely an unverified or
    // un-provisioned user. Sign them back out and surface a message.
    await supabase.auth.signOut();
    return {
      error:
        "Your account has not been provisioned yet. Please contact your district administrator.",
    };
  }

  // Subdomain mismatch check (prod only — in dev the middleware always
  // resolves to "demo" so this is effectively a no-op).
  const h = await headers();
  const districtFromSubdomain = h.get("x-jswp-district-id");
  const baseDomain = process.env.NEXT_PUBLIC_JSWP_BASE_DOMAIN;

  if (
    baseDomain &&
    districtFromSubdomain &&
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

  const fieldErrors: AuthFormState["fieldErrors"] = {};

  if (!email) fieldErrors.email = "Email is required.";
  else if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email.";

  if (!password) fieldErrors.password = "Password is required.";
  else if (password.length < 8)
    fieldErrors.password = "Password must be at least 8 characters.";

  if (password !== confirmPassword)
    fieldErrors.confirmPassword = "Passwords do not match.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const supabase = await createServerClient();
  const siteUrl = await getSiteUrl();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/login?confirmed=1`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "Check your email for a confirmation link. Once confirmed, an administrator will need to assign you to a district before you can sign in.",
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
