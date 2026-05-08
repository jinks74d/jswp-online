/**
 * Signup request detail view. Shows submitter info, the user's optional
 * message, and an admin form to either approve (with editable role +
 * district + school) or deny (with required reason).
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DecisionForm, type DistrictOption, type SchoolOption } from "./decision-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function SignupDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const supabase = await createServerClient();
  const { data: sr } = await supabase
    .from("signup_requests")
    .select(
      `id, auth_user_id, email, first_name, last_name,
       requested_role, requested_district_id, requested_school_id,
       message, status, denial_reason, decision_notes,
       decided_at, created_at`
    )
    .eq("id", id)
    .maybeSingle();

  if (!sr) notFound();

  // Districts + schools the admin can pick from (RLS auto-scopes).
  const { data: districts } = await supabase
    .from("districts")
    .select("id, name")
    .eq("active", true)
    .order("name");

  // For schools we need to fetch all in scope; we'll filter client-side
  // by selected district. Use admin client to get the cross-district set
  // for super_admin (RLS would still scope district_admin/school_admin).
  const admin = createAdminClient();
  const { data: schools } = await admin
    .from("schools")
    .select("id, name, district_id")
    .eq("active", true)
    .order("name");

  const districtOptions: DistrictOption[] =
    (districts ?? []).map((d) => ({ id: d.id, name: d.name }));
  const schoolOptions: SchoolOption[] =
    (schools ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      district_id: s.district_id,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/signups"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to queue
        </Link>
        <span className="text-xs uppercase tracking-wide text-gray-500">
          {sr.status}
        </span>
      </div>

      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          {sr.first_name} {sr.last_name}
        </h1>
        <p className="text-gray-600">{sr.email}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard label="Requested role" value={sr.requested_role} />
        <DetailCard
          label="Submitted"
          value={new Date(sr.created_at).toLocaleString()}
        />
        <DetailCard
          label="Requested district"
          value={
            districtOptions.find((d) => d.id === sr.requested_district_id)
              ?.name ?? "—"
          }
        />
        <DetailCard
          label="Requested school"
          value={
            schoolOptions.find((s) => s.id === sr.requested_school_id)?.name ??
            "—"
          }
        />
      </div>

      {sr.message && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
            Message
          </div>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">
            {sr.message}
          </p>
        </div>
      )}

      <DecisionForm
        signupRequestId={sr.id}
        status={sr.status}
        denialReason={sr.denial_reason}
        decisionNotes={sr.decision_notes}
        defaultRole={sr.requested_role}
        defaultDistrictId={sr.requested_district_id}
        defaultSchoolId={sr.requested_school_id}
        districts={districtOptions}
        schools={schoolOptions}
      />
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}
