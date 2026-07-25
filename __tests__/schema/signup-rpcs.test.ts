/**
 * Signup approval RPC authorization tests — migration 0042.
 * ─────────────────────────────────────────────────────────────────────────
 * approve_signup_request / deny_signup_request are SECURITY DEFINER and
 * callable by any `authenticated` JWT. Because definer rights bypass RLS
 * inside the function body, the RLS-scoped client the action layer uses
 * provides NO protection — the functions must authorize themselves.
 *
 * As shipped in 0006 they did not, and anyone who could load the public
 * /signup form could self-approve as super_admin. The first describe block
 * below is the regression test for exactly that path.
 *
 * Role ceiling under test (locked with the product owner):
 *   super_admin    → teacher | school_admin | district_admin, any district
 *   district_admin → teacher | school_admin | district_admin,
 *                    ONLY within their own district
 *   school_admin   → teacher | school_admin, ONLY at their own school
 *   nobody         → super_admin
 *
 * Prerequisites: same as rls.test.ts (migrations applied incl. 0042,
 * scripts/seed-auth.ts run, .env.local populated).
 *
 * Run with: npm run test:rls
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createServiceRoleClient,
  createUserClient,
  createAnonClient,
} from "./_helpers/clients";

/* ─── Seed IDs (migrations/0004_seed.sql) ─────────────────────────────── */

const IDS = {
  district: "00000000-0000-0000-0000-000000000001",
  school: "00000000-0000-0000-0000-000000000010",
  superAdmin: "6e0c3f40-7ecd-4e83-a883-14daa4b0f91b",
  teacher: "939c2df8-ae49-40b8-b216-bd4d6b61ea43",
  alex: "30d8b2f9-0bf9-4044-a254-9b8a0612b584",
} as const;

/* ─── Test-only fixtures (33333333- namespace; cleaned in afterAll) ───── */

const T = {
  // A second district + school, for the cross-district negative cases.
  district2: "33333333-0000-0000-0000-000000000001",
  school2: "33333333-0000-0000-0000-000000000010",
  // A second school inside the PRIMARY district — lets us prove a
  // school_admin is bounded to their own school, not merely their district.
  schoolB: "33333333-0000-0000-0000-000000000011",

  districtAdmin: "33333333-0000-0000-0000-000000000100",
  districtAdminEmail: "district-admin-rpc-test@demo.test",
  schoolAdmin: "33333333-0000-0000-0000-000000000101",
  schoolAdminEmail: "school-admin-rpc-test@demo.test",
} as const;

const svc = createServiceRoleClient();
const anonClient = createAnonClient();

let superClient: SupabaseClient;
let districtAdminClient: SupabaseClient;
let schoolAdminClient: SupabaseClient;
let teacherClient: SupabaseClient;
let studentClient: SupabaseClient;

/** Auth users created per-test; torn down in afterAll (CASCADE cleans the rest). */
const createdAuthUsers: string[] = [];

/**
 * Create an auth user + a pending signup_request for them, exactly as the
 * public /signup flow does (service role, since there is no INSERT policy).
 * Returns the request id and the new user's own authenticated client — the
 * profileless "attacker" perspective.
 */
async function makePendingRequest(opts: {
  email: string;
  requestedDistrictId?: string | null;
  requestedSchoolId?: string | null;
}): Promise<{ requestId: string; authUserId: string }> {
  const { data: created, error: authErr } = await svc.auth.admin.createUser({
    email: opts.email,
    password: "signup-rpc-test-password-123",
    email_confirm: true,
  });
  if (authErr || !created?.user) {
    throw new Error(`Failed to create auth user: ${authErr?.message}`);
  }
  createdAuthUsers.push(created.user.id);

  const { data: sr, error: srErr } = await svc
    .from("signup_requests")
    .insert({
      auth_user_id: created.user.id,
      email: opts.email,
      first_name: "Pending",
      last_name: "Applicant",
      requested_role: "teacher",
      requested_district_id:
        opts.requestedDistrictId === undefined
          ? IDS.district
          : opts.requestedDistrictId,
      requested_school_id: opts.requestedSchoolId ?? null,
    })
    .select("id")
    .single();
  if (srErr || !sr) {
    throw new Error(`Failed to create signup_request: ${srErr?.message}`);
  }

  return { requestId: sr.id, authUserId: created.user.id };
}

/* ─── Setup ───────────────────────────────────────────────────────────── */

beforeAll(async () => {
  // Second district + school (cross-district negatives).
  await svc
    .from("districts")
    .upsert({
      id: T.district2,
      name: "Signup RPC Test District",
      subdomain: "signup-rpc-test",
      contact_email: "signup-rpc@test.test",
    })
    .throwOnError();

  await svc
    .from("schools")
    .upsert({
      id: T.school2,
      district_id: T.district2,
      name: "Signup RPC Test School",
      level: "high",
    })
    .throwOnError();

  // A sibling school in the PRIMARY district.
  await svc
    .from("schools")
    .upsert({
      id: T.schoolB,
      district_id: IDS.district,
      name: "Signup RPC Sibling School",
      level: "middle",
    })
    .throwOnError();

  // district_admin in the primary district.
  for (const [uid, email, role, schoolId] of [
    [T.districtAdmin, T.districtAdminEmail, "district_admin", null],
    [T.schoolAdmin, T.schoolAdminEmail, "school_admin", IDS.school],
  ] as const) {
    const { data: existing } = await svc.auth.admin.getUserById(uid);
    if (!existing?.user) {
      const { error } = await svc.auth.admin.createUser({
        id: uid,
        email,
        password: "signup-rpc-test-password-123",
        email_confirm: true,
      });
      if (error) throw new Error(`Failed to create ${role}: ${error.message}`);
    }
    await svc
      .from("user_profiles")
      .upsert({
        id: uid,
        district_id: IDS.district,
        school_id: schoolId,
        role,
        email,
        first_name: role === "district_admin" ? "Dana" : "Sam",
        last_name: "Admin",
        active: true,
      })
      .throwOnError();
  }

  superClient = await createUserClient(IDS.superAdmin);
  districtAdminClient = await createUserClient(T.districtAdmin);
  schoolAdminClient = await createUserClient(T.schoolAdmin);
  teacherClient = await createUserClient(IDS.teacher);
  studentClient = await createUserClient(IDS.alex);
}, 60_000);

afterAll(async () => {
  // Deleting the auth user CASCADEs user_profiles (id FK) and
  // signup_requests (auth_user_id FK).
  for (const uid of [...createdAuthUsers, T.districtAdmin, T.schoolAdmin]) {
    await svc.auth.admin.deleteUser(uid).catch(() => {
      /* already gone */
    });
  }
  await svc.from("schools").delete().eq("id", T.schoolB);
  await svc.from("schools").delete().eq("id", T.school2);
  await svc.from("districts").delete().eq("id", T.district2);
}, 60_000);

/* ═══════════════════════════════════════════════════════════════════════
   1. The 0006 vulnerability — self-elevation from the public signup form
   ═══════════════════════════════════════════════════════════════════════ */

describe("approve_signup_request — profileless self-signup user", () => {
  it("cannot self-approve as super_admin (the 0006 escalation)", async () => {
    const { requestId, authUserId } = await makePendingRequest({
      email: "attacker-super@demo.test",
    });
    const attacker = await createUserClient(authUserId);

    const { error } = await attacker.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "super_admin",
      p_district_id: null,
      p_school_id: null,
      p_decision_notes: null,
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    // And no profile was created.
    const { data: profile } = await svc
      .from("user_profiles")
      .select("id")
      .eq("id", authUserId)
      .maybeSingle();
    expect(profile).toBeNull();
  });

  it("cannot self-approve even as a plain teacher", async () => {
    const { requestId, authUserId } = await makePendingRequest({
      email: "attacker-teacher@demo.test",
      requestedSchoolId: IDS.school,
    });
    const attacker = await createUserClient(authUserId);

    const { error } = await attacker.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "teacher",
      p_district_id: IDS.district,
      p_school_id: IDS.school,
      p_decision_notes: null,
    });

    expect(error?.code).toBe("42501");
  });

  it("cannot deny an arbitrary request", async () => {
    const target = await makePendingRequest({ email: "deny-target@demo.test" });
    const { authUserId } = await makePendingRequest({
      email: "attacker-deny@demo.test",
    });
    const attacker = await createUserClient(authUserId);

    const { error } = await attacker.rpc("deny_signup_request", {
      p_signup_request_id: target.requestId,
      p_denial_reason: "nope",
      p_decision_notes: null,
    });

    expect(error?.code).toBe("42501");

    const { data: sr } = await svc
      .from("signup_requests")
      .select("status")
      .eq("id", target.requestId)
      .single();
    expect(sr?.status).toBe("pending");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   2. Non-admin roles
   ═══════════════════════════════════════════════════════════════════════ */

describe("approve_signup_request — non-admin roles", () => {
  it("rejects a student", async () => {
    const { requestId } = await makePendingRequest({
      email: "student-probe@demo.test",
      requestedSchoolId: IDS.school,
    });
    const { error } = await studentClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "teacher",
      p_district_id: IDS.district,
      p_school_id: IDS.school,
      p_decision_notes: null,
    });
    expect(error?.code).toBe("42501");
  });

  it("rejects a teacher", async () => {
    const { requestId } = await makePendingRequest({
      email: "teacher-probe@demo.test",
      requestedSchoolId: IDS.school,
    });
    const { error } = await teacherClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "teacher",
      p_district_id: IDS.district,
      p_school_id: IDS.school,
      p_decision_notes: null,
    });
    expect(error?.code).toBe("42501");
  });

  it("rejects an anonymous caller", async () => {
    const { requestId } = await makePendingRequest({
      email: "anon-probe@demo.test",
      requestedSchoolId: IDS.school,
    });
    const { error } = await anonClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "teacher",
      p_district_id: IDS.district,
      p_school_id: IDS.school,
      p_decision_notes: null,
    });
    expect(error).not.toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   3. Role ceiling — nobody mints a super_admin
   ═══════════════════════════════════════════════════════════════════════ */

describe("approve_signup_request — super_admin is never grantable", () => {
  it("blocks even a super_admin from granting super_admin here", async () => {
    const { requestId } = await makePendingRequest({
      email: "super-grant-probe@demo.test",
      requestedSchoolId: IDS.school,
    });
    const { error } = await superClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "super_admin",
      p_district_id: null,
      p_school_id: null,
      p_decision_notes: null,
    });
    expect(error?.code).toBe("42501");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   4. district_admin — own district only, all three roles
   ═══════════════════════════════════════════════════════════════════════ */

describe("approve_signup_request — district_admin", () => {
  it("CAN approve another district_admin in their own district", async () => {
    const { requestId, authUserId } = await makePendingRequest({
      email: "peer-district-admin@demo.test",
    });

    const { error } = await districtAdminClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "district_admin",
      p_district_id: IDS.district,
      p_school_id: null,
      p_decision_notes: "peer admin",
    });

    expect(error).toBeNull();

    const { data: profile } = await svc
      .from("user_profiles")
      .select("role, district_id, school_id")
      .eq("id", authUserId)
      .single();
    expect(profile?.role).toBe("district_admin");
    expect(profile?.district_id).toBe(IDS.district);
  });

  it("CANNOT approve into a different district", async () => {
    const { requestId } = await makePendingRequest({
      email: "cross-district-probe@demo.test",
    });

    const { error } = await districtAdminClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "district_admin",
      p_district_id: T.district2,
      p_school_id: null,
      p_decision_notes: null,
    });

    expect(error?.code).toBe("42501");
  });

  it("CANNOT approve a request belonging to another district", async () => {
    // Request scoped to district2 — outside this admin's read scope.
    const { requestId } = await makePendingRequest({
      email: "foreign-request-probe@demo.test",
      requestedDistrictId: T.district2,
      requestedSchoolId: T.school2,
    });

    const { error } = await districtAdminClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "teacher",
      p_district_id: IDS.district,
      p_school_id: IDS.school,
      p_decision_notes: null,
    });

    expect(error?.code).toBe("42501");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   5. school_admin — own school only, no district_admin grants
   ═══════════════════════════════════════════════════════════════════════ */

describe("approve_signup_request — school_admin", () => {
  it("CAN approve a teacher at their own school", async () => {
    const { requestId, authUserId } = await makePendingRequest({
      email: "own-school-teacher@demo.test",
      requestedSchoolId: IDS.school,
    });

    const { error } = await schoolAdminClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "teacher",
      p_district_id: IDS.district,
      p_school_id: IDS.school,
      p_decision_notes: null,
    });

    expect(error).toBeNull();

    const { data: profile } = await svc
      .from("user_profiles")
      .select("role, school_id")
      .eq("id", authUserId)
      .single();
    expect(profile?.role).toBe("teacher");
    expect(profile?.school_id).toBe(IDS.school);
  });

  it("CANNOT grant district_admin (no escalation above own level)", async () => {
    const { requestId } = await makePendingRequest({
      email: "school-admin-escalate@demo.test",
      requestedSchoolId: IDS.school,
    });

    const { error } = await schoolAdminClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "district_admin",
      p_district_id: IDS.district,
      p_school_id: null,
      p_decision_notes: null,
    });

    expect(error?.code).toBe("42501");
  });

  it("CANNOT approve into a sibling school in the same district", async () => {
    const { requestId } = await makePendingRequest({
      email: "sibling-school-probe@demo.test",
      requestedSchoolId: IDS.school,
    });

    const { error } = await schoolAdminClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "teacher",
      p_district_id: IDS.district,
      p_school_id: T.schoolB,
      p_decision_notes: null,
    });

    expect(error?.code).toBe("42501");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   6. Referential + state-machine integrity
   ═══════════════════════════════════════════════════════════════════════ */

describe("approve_signup_request — integrity checks", () => {
  it("rejects a school that belongs to a different district", async () => {
    const { requestId } = await makePendingRequest({
      email: "mismatch-probe@demo.test",
    });

    const { error } = await superClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "teacher",
      p_district_id: IDS.district,
      p_school_id: T.school2, // lives in district2
      p_decision_notes: null,
    });

    expect(error?.code).toBe("22023");
  });

  it("still rejects a non-pending request", async () => {
    const { requestId } = await makePendingRequest({
      email: "double-approve-probe@demo.test",
      requestedSchoolId: IDS.school,
    });

    const first = await superClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "teacher",
      p_district_id: IDS.district,
      p_school_id: IDS.school,
      p_decision_notes: null,
    });
    expect(first.error).toBeNull();

    const second = await superClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "teacher",
      p_district_id: IDS.district,
      p_school_id: IDS.school,
      p_decision_notes: null,
    });
    expect(second.error?.code).toBe("P0001");
  });

  it("records decided_by from auth.uid(), not a caller-supplied id", async () => {
    const { requestId } = await makePendingRequest({
      email: "decided-by-probe@demo.test",
      requestedSchoolId: IDS.school,
    });

    const { error } = await districtAdminClient.rpc("approve_signup_request", {
      p_signup_request_id: requestId,
      p_role: "teacher",
      p_district_id: IDS.district,
      p_school_id: IDS.school,
      p_decision_notes: null,
    });
    expect(error).toBeNull();

    const { data: sr } = await svc
      .from("signup_requests")
      .select("decided_by, status")
      .eq("id", requestId)
      .single();

    expect(sr?.status).toBe("approved");
    expect(sr?.decided_by).toBe(T.districtAdmin);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   7. deny_signup_request — happy path still works for an in-scope admin
   ═══════════════════════════════════════════════════════════════════════ */

describe("deny_signup_request", () => {
  it("lets an in-scope district_admin deny", async () => {
    const { requestId } = await makePendingRequest({
      email: "deny-ok-probe@demo.test",
      requestedSchoolId: IDS.school,
    });

    const { error } = await districtAdminClient.rpc("deny_signup_request", {
      p_signup_request_id: requestId,
      p_denial_reason: "Not a district employee.",
      p_decision_notes: null,
    });
    expect(error).toBeNull();

    const { data: sr } = await svc
      .from("signup_requests")
      .select("status, denial_reason, decided_by")
      .eq("id", requestId)
      .single();
    expect(sr?.status).toBe("denied");
    expect(sr?.decided_by).toBe(T.districtAdmin);
  });

  it("still requires a denial reason", async () => {
    const { requestId } = await makePendingRequest({
      email: "deny-noreason-probe@demo.test",
      requestedSchoolId: IDS.school,
    });

    const { error } = await districtAdminClient.rpc("deny_signup_request", {
      p_signup_request_id: requestId,
      p_denial_reason: "   ",
      p_decision_notes: null,
    });
    expect(error?.code).toBe("P0001");
  });
});
