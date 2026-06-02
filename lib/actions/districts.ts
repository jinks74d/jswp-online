/**
 * District management server actions (super-admin only).
 *
 * Writes go through the RLS server client (districts_super_admin_all enforces
 * the role at the DB); requireRole is a defense-in-depth gate at the action
 * layer. The audit_log insert uses the admin client because audit_log has no
 * INSERT policy — the service role is its only writer.
 */

"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type DistrictFormState = {
  error?: string;
  fieldErrors?: {
    name?: string;
    subdomain?: string;
    contact_email?: string;
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
  };
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

function isUniqueViolation(message: string | undefined): boolean {
  return /duplicate|unique|already exists/i.test(message ?? "");
}

export async function createDistrict(
  _prev: DistrictFormState,
  formData: FormData
): Promise<DistrictFormState> {
  const actor = await requireRole("super_admin");
  const f = parseDistrictForm(formData);
  const fe = validate(f);
  if (fe) return { fieldErrors: fe };

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

  await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: actor.id,
      action: "district.create",
      target_scope: { district_id: data.id },
      metadata: { name: f.name, subdomain: f.subdomain || null },
      district_id: data.id,
      school_id: null,
    });

  revalidatePath("/admin/districts");
  return { success: `Created “${f.name}”.` };
}

export async function updateDistrict(
  _prev: DistrictFormState,
  formData: FormData
): Promise<DistrictFormState> {
  const actor = await requireRole("super_admin");
  const id = String(formData.get("district_id") ?? "");
  if (!id) return { error: "Missing district id." };

  const f = parseDistrictForm(formData);
  const fe = validate(f);
  if (fe) return { fieldErrors: fe };

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

  await createAdminClient()
    .from("audit_log")
    .insert({
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
