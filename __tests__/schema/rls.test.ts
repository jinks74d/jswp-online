/**
 * RLS Policy Tests
 * ─────────────────────────────────────────────────────────────────────────
 * Verifies the RLS policies in migrations/0002_rls_policies.sql against a
 * live Supabase project by impersonating different users via password login.
 *
 * Prerequisites:
 *   1. migrations/0001–0004 have been applied to the Supabase project.
 *   2. scripts/seed-auth.ts has been run (test auth users exist).
 *   3. .env.local contains:
 *        NEXT_PUBLIC_SUPABASE_URL
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY
 *        SUPABASE_SERVICE_ROLE_KEY
 *
 * Test users from the seed:
 *   super admin  — 6e0c3f40-7ecd-4e83-a883-14daa4b0f91b (raymond@farsidedev.com)
 *   teacher      — 939c2df8-ae49-40b8-b216-bd4d6b61ea43 (teacher@demo.test)
 *   alex         — 30d8b2f9-0bf9-4044-a254-9b8a0612b584 (student)
 *   bailey       — 0dffb149-abcd-4381-9f51-aa143720a9fd (student)
 *
 * Test-only data created in beforeAll (cleaned up in afterAll):
 *   - A second district + school + teacher for cross-tenant isolation
 *   - An unreleased assignment in the demo district
 *   - student_writings for Alex and Bailey on the expository assignment
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

/* ─── Seed IDs (from migrations/0004_seed.sql) ────────────────────────── */

const IDS = {
  district: "00000000-0000-0000-0000-000000000001",
  school: "00000000-0000-0000-0000-000000000010",
  superAdmin: "6e0c3f40-7ecd-4e83-a883-14daa4b0f91b",
  teacher: "939c2df8-ae49-40b8-b216-bd4d6b61ea43",
  alex: "30d8b2f9-0bf9-4044-a254-9b8a0612b584",
  bailey: "0dffb149-abcd-4381-9f51-aa143720a9fd",
  classPeriod: "00000000-0000-0000-0000-000000003000",
  assignmentExpository: "00000000-0000-0000-0000-000000004000",
} as const;

/* ─── Test-only IDs (created in beforeAll, cleaned in afterAll) ───────── */

const TEST = {
  district2: "11111111-0000-0000-0000-000000000001",
  school2: "11111111-0000-0000-0000-000000000010",
  teacher2: "11111111-0000-0000-0000-000000000200",
  teacher2Email: "teacher2-rls-test@demo.test",
  unreleased: "11111111-0000-0000-0000-000000004000",
  unreleasedNull: "11111111-0000-0000-0000-000000004001",
  // Defense-in-depth probe: teacher_id matches IDS.teacher (in demo
  // district) but district_id/school_id point at the cross-tenant
  // fixture. Migration 0009's tightened assignments_teacher_own
  // policy must keep teacherClient from seeing this row.
  crossTenantOwned: "11111111-0000-0000-0000-000000004002",
  alexWriting: "22222222-0000-0000-0000-000000000001",
  baileyWriting: "22222222-0000-0000-0000-000000000002",
} as const;

/* ─── Clients (initialized in beforeAll) ──────────────────────────────── */

const svc = createServiceRoleClient();
const anonClient = createAnonClient();

let teacherClient: SupabaseClient;
let alexClient: SupabaseClient;
let baileyClient: SupabaseClient;
let superClient: SupabaseClient;
let teacher2Client: SupabaseClient;

/* ─── Setup & Teardown ────────────────────────────────────────────────── */

beforeAll(async () => {
  // 1. Create cross-tenant auth user (idempotent)
  const { data: existing } = await svc.auth.admin.getUserById(TEST.teacher2);
  if (!existing?.user) {
    const { error: authErr } = await svc.auth.admin.createUser({
      id: TEST.teacher2,
      email: TEST.teacher2Email,
      password: "rls-test-password-123",
      email_confirm: true,
    });
    if (authErr) {
      throw new Error(`Failed to create test auth user: ${authErr.message}`);
    }
  }

  // 2. Second district + school
  await svc
    .from("districts")
    .upsert({
      id: TEST.district2,
      name: "RLS Test District",
      subdomain: "rls-test",
      primary_color: "#FF0000",
      contact_email: "rls@test.test",
    })
    .throwOnError();

  await svc
    .from("schools")
    .upsert({
      id: TEST.school2,
      district_id: TEST.district2,
      name: "RLS Test School",
      level: "high",
    })
    .throwOnError();

  // 3. Teacher2 profile in second district
  await svc
    .from("user_profiles")
    .upsert({
      id: TEST.teacher2,
      district_id: TEST.district2,
      school_id: TEST.school2,
      role: "teacher",
      first_name: "Other",
      last_name: "Teacher",
      email: TEST.teacher2Email,
    })
    .throwOnError();

  // 4. Unreleased assignment in demo district (released_at far in the future)
  await svc
    .from("assignments")
    .upsert({
      id: TEST.unreleased,
      teacher_id: IDS.teacher,
      class_period_id: IDS.classPeriod,
      district_id: IDS.district,
      school_id: IDS.school,
      title: "RLS Test — Unreleased",
      prompt: "This assignment should not be visible to students yet.",
      mode: "expository",
      is_essay: false,
      num_body_paragraphs: 1,
      default_chunk_ratio: "two_plus_to_one",
      default_chunks_per_bp: 1,
      released_at: "2099-01-01T00:00:00Z",
    })
    .throwOnError();

  // 4b. Unreleased assignment with released_at = NULL (regression guard for
  // migration 0008: NULL must mean hidden, not "released by default").
  await svc
    .from("assignments")
    .upsert({
      id: TEST.unreleasedNull,
      teacher_id: IDS.teacher,
      class_period_id: IDS.classPeriod,
      district_id: IDS.district,
      school_id: IDS.school,
      title: "RLS Test — Null Release",
      prompt: "released_at NULL — should be hidden from students.",
      mode: "expository",
      is_essay: false,
      num_body_paragraphs: 1,
      default_chunk_ratio: "two_plus_to_one",
      default_chunks_per_bp: 1,
      released_at: null,
    })
    .throwOnError();

  // 4c. Cross-tenant-owned probe for migration 0009: teacher_id matches
  // the demo-district teacher but district_id/school_id point at the
  // cross-tenant fixture. Only insertable via service role; the tightened
  // policy must keep teacherClient from seeing it.
  await svc
    .from("assignments")
    .upsert({
      id: TEST.crossTenantOwned,
      teacher_id: IDS.teacher,
      class_period_id: null,
      district_id: TEST.district2,
      school_id: TEST.school2,
      title: "RLS Test — Cross-Tenant Owned",
      prompt: "Mismatched district/school; teacher must not read.",
      mode: "expository",
      is_essay: false,
      num_body_paragraphs: 1,
      default_chunk_ratio: "two_plus_to_one",
      default_chunks_per_bp: 1,
      released_at: null,
    })
    .throwOnError();

  // 5. Student writings for Alex and Bailey on the expository assignment.
  // Phase 4 browser testing may have left student_writings rows with a
  // different id but the same business key (assignment_id, student_id,
  // draft_number=1). An UPSERT alone can't repair this: with onConflict
  // on the business key, Postgres tries to UPDATE the existing row's id
  // to TEST.alexWriting/baileyWriting and trips FK constraints from
  // dependent tables (prompt_decodings, body_paragraphs, etc.). Clear
  // any pre-existing row for that key first — ON DELETE CASCADE wipes
  // dependents — then upsert clean rows with our fixed test ids.
  await svc
    .from("student_writings")
    .delete()
    .eq("assignment_id", IDS.assignmentExpository)
    .in("student_id", [IDS.alex, IDS.bailey])
    .eq("draft_number", 1);

  await svc
    .from("student_writings")
    .upsert(
      [
        {
          id: TEST.alexWriting,
          assignment_id: IDS.assignmentExpository,
          student_id: IDS.alex,
          draft_number: 1,
          status: "in_progress",
          chunk_ratio: "two_plus_to_one",
        },
        {
          id: TEST.baileyWriting,
          assignment_id: IDS.assignmentExpository,
          student_id: IDS.bailey,
          draft_number: 1,
          status: "in_progress",
          chunk_ratio: "two_plus_to_one",
        },
      ],
      { onConflict: "assignment_id,student_id,draft_number" }
    )
    .throwOnError();

  // 6. Create authenticated clients for each test user (sets password + signs in)
  [teacherClient, alexClient, baileyClient, superClient, teacher2Client] =
    await Promise.all([
      createUserClient(IDS.teacher),
      createUserClient(IDS.alex),
      createUserClient(IDS.bailey),
      createUserClient(IDS.superAdmin),
      createUserClient(TEST.teacher2),
    ]);
}, 30_000);

afterAll(async () => {
  // Clean up test-only data in reverse dependency order
  await svc
    .from("student_writings")
    .delete()
    .in("id", [TEST.alexWriting, TEST.baileyWriting]);
  await svc
    .from("assignments")
    .delete()
    .in("id", [TEST.unreleased, TEST.unreleasedNull, TEST.crossTenantOwned]);
  await svc.from("user_profiles").delete().eq("id", TEST.teacher2);
  await svc.from("schools").delete().eq("id", TEST.school2);
  await svc.from("districts").delete().eq("id", TEST.district2);
  await svc.auth.admin.deleteUser(TEST.teacher2);
}, 15_000);

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Tests                                                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

describe("Teacher access to assignments", () => {
  it("teacher can read their own assignments", async () => {
    const { data, error } = await teacherClient
      .from("assignments")
      .select("id")
      .eq("teacher_id", IDS.teacher);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(4); // 4 seed assignments
  });

  it("teacher can read the unreleased assignment (they own it)", async () => {
    const { data, error } = await teacherClient
      .from("assignments")
      .select("id")
      .eq("id", TEST.unreleased)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBe(TEST.unreleased);
  });
});

describe("Cross-tenant isolation", () => {
  it("other-district teacher cannot read Demo District assignments", async () => {
    const { data, error } = await teacher2Client
      .from("assignments")
      .select("id")
      .eq("id", IDS.assignmentExpository);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("other-district teacher cannot read Demo District student writings", async () => {
    const { data, error } = await teacher2Client
      .from("student_writings")
      .select("id")
      .eq("id", TEST.alexWriting);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("other-district teacher cannot read Demo District user profiles", async () => {
    const { data, error } = await teacher2Client
      .from("user_profiles")
      .select("id")
      .eq("id", IDS.teacher);

    // teacher2 is in a different school, so same-school policy won't match;
    // self-read won't match; admin policies won't match.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("other-district teacher can read their own profile", async () => {
    const { data, error } = await teacher2Client
      .from("user_profiles")
      .select("id, email")
      .eq("id", TEST.teacher2)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.email).toBe(TEST.teacher2Email);
  });

  // Migration 0009 — defense-in-depth on assignments_teacher_own.
  // teacher_id alone is no longer sufficient; district_id and school_id
  // must also match the caller's profile. Service-role inserted a row
  // where teacher_id = IDS.teacher (Demo District) but the tenancy
  // columns point at TEST.district2 / TEST.school2.
  it("blocks read when teacher_id matches but district/school diverge (defense-in-depth)", async () => {
    const { data, error } = await teacherClient
      .from("assignments")
      .select("id")
      .eq("id", TEST.crossTenantOwned);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("Student access to assignments", () => {
  it("Alex can read released assignments in enrolled class period", async () => {
    const { data, error } = await alexClient
      .from("assignments")
      .select("id")
      .eq("id", IDS.assignmentExpository);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].id).toBe(IDS.assignmentExpository);
  });

  it("Alex cannot read unreleased assignments", async () => {
    const { data, error } = await alexClient
      .from("assignments")
      .select("id")
      .eq("id", TEST.unreleased);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  // Regression guard for migration 0008: NULL released_at must mean hidden.
  // Previously the policy treated NULL as released-by-default, contradicting
  // the publish/unpublish contract.
  it("Alex cannot read assignments with released_at = NULL", async () => {
    const { data, error } = await alexClient
      .from("assignments")
      .select("id")
      .eq("id", TEST.unreleasedNull);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("Alex CAN read once released_at is set to past", async () => {
    // Flip released_at from NULL → past; then revert in finally.
    await svc
      .from("assignments")
      .update({ released_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", TEST.unreleasedNull)
      .throwOnError();

    try {
      const { data, error } = await alexClient
        .from("assignments")
        .select("id")
        .eq("id", TEST.unreleasedNull);

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data!.length).toBe(1);
    } finally {
      await svc
        .from("assignments")
        .update({ released_at: null })
        .eq("id", TEST.unreleasedNull);
    }
  });
});

describe("Student writing isolation", () => {
  it("Alex can read their own student_writings", async () => {
    const { data, error } = await alexClient
      .from("student_writings")
      .select("id")
      .eq("id", TEST.alexWriting)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBe(TEST.alexWriting);
  });

  it("Alex cannot see Bailey's student_writings", async () => {
    const { data, error } = await alexClient
      .from("student_writings")
      .select("id")
      .eq("id", TEST.baileyWriting);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("Bailey cannot see Alex's student_writings", async () => {
    const { data, error } = await baileyClient
      .from("student_writings")
      .select("id")
      .eq("id", TEST.alexWriting);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("Teacher access to writings", () => {
  it("teacher can see Alex's writing on their assignment", async () => {
    const { data, error } = await teacherClient
      .from("student_writings")
      .select("id")
      .eq("id", TEST.alexWriting)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBe(TEST.alexWriting);
  });

  it("teacher can see Bailey's writing on their assignment", async () => {
    const { data, error } = await teacherClient
      .from("student_writings")
      .select("id")
      .eq("id", TEST.baileyWriting)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBe(TEST.baileyWriting);
  });

  it("teacher can see all writings for their assignment", async () => {
    const { data, error } = await teacherClient
      .from("student_writings")
      .select("id")
      .eq("assignment_id", IDS.assignmentExpository);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Anon has no access", () => {
  it("anon cannot read assignments", async () => {
    const { data, error } = await anonClient.from("assignments").select("id");

    // RLS blocks anon — returns empty or error depending on table config
    if (error) {
      expect(error.code).toBeDefined();
    } else {
      expect(data).toEqual([]);
    }
  });

  it("anon cannot read student_writings", async () => {
    const { data, error } = await anonClient
      .from("student_writings")
      .select("id");

    if (error) {
      expect(error.code).toBeDefined();
    } else {
      expect(data).toEqual([]);
    }
  });

  it("anon cannot read user_profiles", async () => {
    const { data, error } = await anonClient
      .from("user_profiles")
      .select("id");

    if (error) {
      expect(error.code).toBeDefined();
    } else {
      expect(data).toEqual([]);
    }
  });

  it("anon cannot read districts", async () => {
    const { data, error } = await anonClient.from("districts").select("id");

    if (error) {
      expect(error.code).toBeDefined();
    } else {
      expect(data).toEqual([]);
    }
  });
});

describe("Super admin sees all", () => {
  it("super admin can read assignments across districts", async () => {
    const { data, error } = await superClient
      .from("assignments")
      .select("id")
      .eq("id", IDS.assignmentExpository)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBe(IDS.assignmentExpository);
  });

  it("super admin can read student writings", async () => {
    const { data, error } = await superClient
      .from("student_writings")
      .select("id")
      .in("id", [TEST.alexWriting, TEST.baileyWriting]);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(2);
  });

  it("super admin can read user profiles in any district", async () => {
    // Read a profile from the demo district
    const { data: d1, error: e1 } = await superClient
      .from("user_profiles")
      .select("id")
      .eq("id", IDS.teacher)
      .single();

    expect(e1).toBeNull();
    expect(d1).not.toBeNull();

    // Read a profile from the second district
    const { data: d2, error: e2 } = await superClient
      .from("user_profiles")
      .select("id")
      .eq("id", TEST.teacher2)
      .single();

    expect(e2).toBeNull();
    expect(d2).not.toBeNull();
  });

  it("super admin can read districts", async () => {
    const { data, error } = await superClient
      .from("districts")
      .select("id")
      .in("id", [IDS.district, TEST.district2]);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(2);
  });
});
