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

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
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
  // Migration 0050 probe: released, and carrying the LEGACY class_period_id
  // pointing at the student's own period, but with no assignment_class_periods
  // row. Student visibility must flow through the junction only — if the
  // legacy column still granted access, this would be readable.
  releasedNoPeriodRow: "11111111-0000-0000-0000-000000004003",
  alexWriting: "22222222-0000-0000-0000-000000000001",
  baileyWriting: "22222222-0000-0000-0000-000000000002",
  // Migration 0051 probes. Both are periods the demo teacher must NOT be able
  // to pair an assignment with:
  //   untaughtPeriod — same school, but no class_teacher_assignments row.
  //   foreignPeriod  — a different school entirely (with the subject + class
  //                    it hangs off, since school2 has none from the seed).
  untaughtPeriod: "11111111-0000-0000-0000-000000003000",
  foreignSubject: "11111111-0000-0000-0000-000000001000",
  foreignClass: "11111111-0000-0000-0000-000000002000",
  foreignPeriod: "11111111-0000-0000-0000-000000003001",
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

  // 3b. Migration 0051 fixtures — two periods the demo teacher cannot assign
  // to. `untaughtPeriod` sits in the demo school's own English I class but
  // deliberately gets NO class_teacher_assignments row; `foreignPeriod` sits
  // in the cross-tenant school, which needs its own subject + class first.
  await svc
    .from("class_periods")
    .upsert({
      id: TEST.untaughtPeriod,
      class_id: "00000000-0000-0000-0000-000000002000",
      school_id: IDS.school,
      period_label: "RLS Untaught",
      academic_year: "2025-2026",
    })
    .throwOnError();

  await svc
    .from("subjects")
    .upsert({
      id: TEST.foreignSubject,
      school_id: TEST.school2,
      name: "RLS Test Subject",
    })
    .throwOnError();

  await svc
    .from("classes")
    .upsert({
      id: TEST.foreignClass,
      subject_id: TEST.foreignSubject,
      school_id: TEST.school2,
      name: "RLS Test Class",
    })
    .throwOnError();

  await svc
    .from("class_periods")
    .upsert({
      id: TEST.foreignPeriod,
      class_id: TEST.foreignClass,
      school_id: TEST.school2,
      period_label: "RLS Foreign",
      academic_year: "2025-2026",
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
      default_chunk_ratio: "nonlit_expository_two_plus_to_one",
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
      default_chunk_ratio: "nonlit_expository_two_plus_to_one",
      default_chunks_per_bp: 1,
      released_at: null,
    })
    .throwOnError();

  // 4b-ii. Since migration 0050, student visibility is decided by
  // assignment_class_periods, not assignments.class_period_id. Both probes
  // above must therefore be genuinely REACHABLE by the student's period —
  // otherwise they'd be hidden because they were assigned to nobody, and the
  // release-gate assertions below would pass for the wrong reason.
  await svc
    .from("assignment_class_periods")
    .upsert(
      [TEST.unreleased, TEST.unreleasedNull].map((assignment_id) => ({
        assignment_id,
        class_period_id: IDS.classPeriod,
        due_at: null,
      }))
    )
    .throwOnError();

  // 4b-iii. Migration 0050 probe — see TEST.releasedNoPeriodRow. Released and
  // pointing at the student's period via the legacy column, but deliberately
  // given NO junction row.
  await svc
    .from("assignments")
    .upsert({
      id: TEST.releasedNoPeriodRow,
      teacher_id: IDS.teacher,
      class_period_id: IDS.classPeriod,
      district_id: IDS.district,
      school_id: IDS.school,
      title: "RLS Test — Released, No Period Row",
      prompt: "Legacy class_period_id only; must stay hidden from students.",
      mode: "expository",
      is_essay: false,
      num_body_paragraphs: 1,
      default_chunk_ratio: "nonlit_expository_two_plus_to_one",
      default_chunks_per_bp: 1,
      released_at: "2020-01-01T00:00:00Z",
    })
    .throwOnError();
  await svc
    .from("assignment_class_periods")
    .delete()
    .eq("assignment_id", TEST.releasedNoPeriodRow);

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
      default_chunk_ratio: "nonlit_expository_two_plus_to_one",
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
          chunk_ratio: "nonlit_expository_two_plus_to_one",
        },
        {
          id: TEST.baileyWriting,
          assignment_id: IDS.assignmentExpository,
          student_id: IDS.bailey,
          draft_number: 1,
          status: "in_progress",
          chunk_ratio: "nonlit_expository_two_plus_to_one",
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
    .in("id", [
      TEST.unreleased,
      TEST.unreleasedNull,
      TEST.crossTenantOwned,
      TEST.releasedNoPeriodRow,
    ]);
  await svc
    .from("class_periods")
    .delete()
    .in("id", [TEST.untaughtPeriod, TEST.foreignPeriod]);
  await svc.from("classes").delete().eq("id", TEST.foreignClass);
  await svc.from("subjects").delete().eq("id", TEST.foreignSubject);
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

/* ─── Migration 0050: one assignment, many class periods ─────────────── */

describe("Assignment class periods (migration 0050)", () => {
  it("a released assignment with NO junction row is hidden, even though the legacy class_period_id points at the student's period", async () => {
    // The migration's central claim: visibility moved to
    // assignment_class_periods. If the legacy column still granted access
    // this row would be readable, and every per-period rule below would be
    // decorative.
    const { data, error } = await alexClient
      .from("assignments")
      .select("id")
      .eq("id", TEST.releasedNoPeriodRow);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("adding a junction row for the student's period reveals it", async () => {
    await svc
      .from("assignment_class_periods")
      .upsert({
        assignment_id: TEST.releasedNoPeriodRow,
        class_period_id: IDS.classPeriod,
        due_at: null,
      })
      .throwOnError();

    try {
      const { data, error } = await alexClient
        .from("assignments")
        .select("id")
        .eq("id", TEST.releasedNoPeriodRow);

      expect(error).toBeNull();
      expect(data!.length).toBe(1);
    } finally {
      await svc
        .from("assignment_class_periods")
        .delete()
        .eq("assignment_id", TEST.releasedNoPeriodRow);
    }
  });

  it("a student sees the junction row for their own period", async () => {
    const { data, error } = await alexClient
      .from("assignment_class_periods")
      .select("assignment_id, class_period_id")
      .eq("assignment_id", IDS.assignmentExpository);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    // Never another class's schedule — the read policy restricts students to
    // periods they are enrolled in.
    for (const row of data!) {
      expect(row.class_period_id).toBe(IDS.classPeriod);
    }
  });

  it("a student cannot assign an assignment to a class period", async () => {
    const { error } = await alexClient
      .from("assignment_class_periods")
      .insert({
        assignment_id: IDS.assignmentExpository,
        class_period_id: IDS.classPeriod,
        due_at: null,
      });

    expect(error).not.toBeNull();
  });

  it("the owning teacher can read every period on their assignment", async () => {
    const { data, error } = await teacherClient
      .from("assignment_class_periods")
      .select("assignment_id")
      .eq("assignment_id", IDS.assignmentExpository);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("a teacher from another school cannot read them", async () => {
    const { data, error } = await teacher2Client
      .from("assignment_class_periods")
      .select("assignment_id")
      .eq("assignment_id", IDS.assignmentExpository);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anon cannot read them", async () => {
    const { data } = await anonClient
      .from("assignment_class_periods")
      .select("assignment_id");

    expect(data ?? []).toEqual([]);
  });
});

/* ─── Migration 0051: the period side of the pairing ─────────────────── */

describe("Assignment class period write scope (migration 0051)", () => {
  // Every case below uses TEST.releasedNoPeriodRow: an assignment the demo
  // teacher OWNS, so auth_user_can_write_assignment is satisfied (verified
  // directly via RPC) and the only thing that can reject the write is a
  // period-side check.
  //
  // These pass against the live DB even BEFORE 0051 is applied — live already
  // enforces a period-side rule that the committed 0050 text does not state.
  // They are here to pin that behaviour down so the drift cannot come back:
  // built from migrations alone, 0050's policy would admit every one of the
  // forged writes below. See the header of 0051.

  afterEach(async () => {
    await svc
      .from("assignment_class_periods")
      .delete()
      .eq("assignment_id", TEST.releasedNoPeriodRow);
  });

  it("a teacher cannot pair their own assignment with a period they do not teach", async () => {
    const { error } = await teacherClient
      .from("assignment_class_periods")
      .insert({
        assignment_id: TEST.releasedNoPeriodRow,
        class_period_id: TEST.untaughtPeriod,
        due_at: null,
      });

    expect(error).not.toBeNull();

    // And nothing landed — a rejected WITH CHECK must not leave a row behind.
    const { data } = await svc
      .from("assignment_class_periods")
      .select("class_period_id")
      .eq("assignment_id", TEST.releasedNoPeriodRow);
    expect(data).toEqual([]);
  });

  it("a teacher cannot pair their own assignment with a period in another school", async () => {
    // The cross-tenant case: this is what would have handed another
    // district's students access to the assignment.
    const { error } = await teacherClient
      .from("assignment_class_periods")
      .insert({
        assignment_id: TEST.releasedNoPeriodRow,
        class_period_id: TEST.foreignPeriod,
        due_at: null,
      });

    expect(error).not.toBeNull();

    const { data } = await svc
      .from("assignment_class_periods")
      .select("class_period_id")
      .eq("assignment_id", TEST.releasedNoPeriodRow);
    expect(data).toEqual([]);
  });

  it("a teacher can still pair their assignment with a period they DO teach", async () => {
    // Guards against over-tightening: the ordinary authoring path must work.
    const { error } = await teacherClient
      .from("assignment_class_periods")
      .insert({
        assignment_id: TEST.releasedNoPeriodRow,
        class_period_id: IDS.classPeriod,
        due_at: null,
      });

    expect(error).toBeNull();

    const { data } = await svc
      .from("assignment_class_periods")
      .select("class_period_id")
      .eq("assignment_id", TEST.releasedNoPeriodRow);
    expect(data!.map((r) => r.class_period_id)).toEqual([IDS.classPeriod]);
  });

  it("an admin CAN pair a period in their school that they do not teach", async () => {
    // 0051's second branch. Admins do not appear in class_teacher_assignments,
    // so if this branch were missing the policy would silently break admin
    // assignment authoring — the failure mode of over-tightening rather than
    // under-tightening. Verified against live: for this user
    // auth_user_is_admin_for_school is true while
    // auth_user_teaches_class_period is false, so ONLY the admin branch can
    // be carrying the insert.
    const { error } = await superClient
      .from("assignment_class_periods")
      .insert({
        assignment_id: TEST.releasedNoPeriodRow,
        class_period_id: TEST.untaughtPeriod,
        due_at: null,
      });

    expect(error).toBeNull();

    const { data } = await svc
      .from("assignment_class_periods")
      .select("class_period_id")
      .eq("assignment_id", TEST.releasedNoPeriodRow);
    expect(data!.map((r) => r.class_period_id)).toEqual([TEST.untaughtPeriod]);
  });

  it("an admin still cannot pair a period from another school", async () => {
    // Same-school is checked independently of role, so the admin branch does
    // not become a cross-tenant bypass.
    const { error } = await superClient
      .from("assignment_class_periods")
      .insert({
        assignment_id: TEST.releasedNoPeriodRow,
        class_period_id: TEST.foreignPeriod,
        due_at: null,
      });

    expect(error).not.toBeNull();
  });

  it("a teacher cannot delete a pairing for a period they do not teach", async () => {
    // FOR ALL means 0050's gap covered DELETE too. The row is planted by the
    // service role because the teacher can no longer create it themselves.
    await svc
      .from("assignment_class_periods")
      .insert({
        assignment_id: TEST.releasedNoPeriodRow,
        class_period_id: TEST.untaughtPeriod,
        due_at: null,
      })
      .throwOnError();

    // RLS filters the row out of the DELETE rather than raising, so the
    // assertion is on survival, not on `error`.
    await teacherClient
      .from("assignment_class_periods")
      .delete()
      .eq("assignment_id", TEST.releasedNoPeriodRow);

    const { data } = await svc
      .from("assignment_class_periods")
      .select("class_period_id")
      .eq("assignment_id", TEST.releasedNoPeriodRow);
    expect(data!.map((r) => r.class_period_id)).toEqual([TEST.untaughtPeriod]);
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

describe("Exemplars (chunk 6.1)", () => {
  // Three exemplars seeded via service role:
  //   - publishedOwned: teacher's, published, expository — Alex should see
  //   - draftOwned: teacher's, draft, expository — Alex should NOT see
  //   - otherTeacher: teacher2's, published, expository — Alex should NOT see
  const publishedOwnedId = "44444444-0000-0000-0000-000000000001";
  const draftOwnedId = "44444444-0000-0000-0000-000000000002";
  const otherTeacherId = "44444444-0000-0000-0000-000000000003";

  beforeAll(async () => {
    await svc
      .from("exemplars")
      .upsert([
        {
          id: publishedOwnedId,
          district_id: IDS.district,
          school_id: IDS.school,
          created_by: IDS.teacher,
          title: "Published exemplar — Sports",
          description: "Demo expository exemplar",
          mode: "expository",
          full_text: "Working together to achieve a goal requires…",
          is_published: true,
        },
        {
          id: draftOwnedId,
          district_id: IDS.district,
          school_id: IDS.school,
          created_by: IDS.teacher,
          title: "Draft exemplar — Teamwork",
          description: null,
          mode: "expository",
          full_text: "Not ready for students yet.",
          is_published: false,
        },
        {
          id: otherTeacherId,
          district_id: TEST.district2,
          school_id: TEST.school2,
          created_by: TEST.teacher2,
          title: "Other teacher's exemplar",
          description: null,
          mode: "expository",
          full_text: "Should be invisible to Alex.",
          is_published: true,
        },
      ])
      .throwOnError();
  });

  afterAll(async () => {
    await svc
      .from("exemplars")
      .delete()
      .in("id", [publishedOwnedId, draftOwnedId, otherTeacherId]);
  });

  it("teacher can read their own exemplars (published + draft)", async () => {
    const { data, error } = await teacherClient
      .from("exemplars")
      .select("id, is_published")
      .in("id", [publishedOwnedId, draftOwnedId]);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(2);
  });

  it("teacher cannot read another teacher's exemplars", async () => {
    const { data, error } = await teacherClient
      .from("exemplars")
      .select("id")
      .eq("id", otherTeacherId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("student reads published exemplar from their teacher", async () => {
    const { data, error } = await alexClient
      .from("exemplars")
      .select("id")
      .eq("id", publishedOwnedId);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(1);
  });

  it("student cannot read draft exemplar (even from their teacher)", async () => {
    const { data, error } = await alexClient
      .from("exemplars")
      .select("id")
      .eq("id", draftOwnedId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("student cannot read exemplars from a different teacher", async () => {
    const { data, error } = await alexClient
      .from("exemplars")
      .select("id")
      .eq("id", otherTeacherId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anon cannot read exemplars", async () => {
    const { data, error } = await anonClient.from("exemplars").select("id");

    if (error) {
      expect(error.code).toBeDefined();
    } else {
      expect(data).toEqual([]);
    }
  });
});

describe("Exemplar content_format (chunk 6.6a)", () => {
  const formatPlain = "99999999-0000-0000-0000-000000000001";
  const formatHtml = "99999999-0000-0000-0000-000000000002";

  beforeAll(async () => {
    await svc
      .from("exemplars")
      .upsert([
        {
          id: formatPlain,
          district_id: IDS.district,
          school_id: IDS.school,
          created_by: IDS.teacher,
          title: "content_format RLS — plain",
          mode: "expository",
          full_text: "Plain exemplar.",
          is_published: true,
          content_format: "plain",
        },
        {
          id: formatHtml,
          district_id: IDS.district,
          school_id: IDS.school,
          created_by: IDS.teacher,
          title: "content_format RLS — html",
          mode: "expository",
          full_text:
            '<p><span class="jswp-cd">Sanitized content.</span></p>',
          is_published: true,
          content_format: "html",
        },
      ])
      .throwOnError();
  });

  afterAll(async () => {
    await svc
      .from("exemplars")
      .delete()
      .in("id", [formatPlain, formatHtml]);
  });

  it("teacher reads content_format on own exemplars", async () => {
    const { data, error } = await teacherClient
      .from("exemplars")
      .select("id, content_format")
      .in("id", [formatPlain, formatHtml]);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(2);
    const byId = new Map(data!.map((r) => [r.id, r.content_format]));
    expect(byId.get(formatPlain)).toBe("plain");
    expect(byId.get(formatHtml)).toBe("html");
  });

  it("teacher updates content_format on own exemplar", async () => {
    const { error } = await teacherClient
      .from("exemplars")
      .update({ content_format: "html" })
      .eq("id", formatPlain);
    expect(error).toBeNull();

    const { data } = await svc
      .from("exemplars")
      .select("content_format")
      .eq("id", formatPlain)
      .single();
    expect(data?.content_format).toBe("html");

    // Restore for downstream tests
    await svc
      .from("exemplars")
      .update({ content_format: "plain" })
      .eq("id", formatPlain);
  });

  it("CHECK constraint rejects invalid content_format values", async () => {
    // Service role bypasses RLS but still has to honor the CHECK
    // constraint. This verifies the schema-level enum guard.
    const { error } = await svc
      .from("exemplars")
      .update({ content_format: "markdown" })
      .eq("id", formatPlain);
    expect(error).not.toBeNull();
  });

  it("cross-tenant teacher cannot read content_format", async () => {
    const { data, error } = await teacher2Client
      .from("exemplars")
      .select("content_format")
      .eq("id", formatHtml);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("Exemplar step_tags (chunk 6.5)", () => {
  const taggedExemplar = "88888888-0000-0000-0000-000000000001";

  beforeAll(async () => {
    await svc
      .from("exemplars")
      .upsert({
        id: taggedExemplar,
        district_id: IDS.district,
        school_id: IDS.school,
        created_by: IDS.teacher,
        title: "Step-tag RLS — tagged",
        mode: "expository",
        full_text: "Tagged exemplar content.",
        is_published: true,
        shared_with_school: false,
        step_tags: ["thesis", "topic_sentence_dev"],
      })
      .throwOnError();
  });

  afterAll(async () => {
    await svc.from("exemplars").delete().eq("id", taggedExemplar);
  });

  it("teacher reads their own exemplar's step_tags", async () => {
    const { data, error } = await teacherClient
      .from("exemplars")
      .select("step_tags")
      .eq("id", taggedExemplar)
      .single();
    expect(error).toBeNull();
    expect(data?.step_tags).toEqual(["thesis", "topic_sentence_dev"]);
  });

  it("teacher updates step_tags on their own exemplar", async () => {
    const { error } = await teacherClient
      .from("exemplars")
      .update({ step_tags: ["paragraph_form"] })
      .eq("id", taggedExemplar);
    expect(error).toBeNull();

    const { data } = await svc
      .from("exemplars")
      .select("step_tags")
      .eq("id", taggedExemplar)
      .single();
    expect(data?.step_tags).toEqual(["paragraph_form"]);

    // Restore for downstream tests
    await svc
      .from("exemplars")
      .update({ step_tags: ["thesis", "topic_sentence_dev"] })
      .eq("id", taggedExemplar);
  });

  it("teacher clears step_tags to null", async () => {
    const { error } = await teacherClient
      .from("exemplars")
      .update({ step_tags: null })
      .eq("id", taggedExemplar);
    expect(error).toBeNull();

    const { data } = await svc
      .from("exemplars")
      .select("step_tags")
      .eq("id", taggedExemplar)
      .single();
    expect(data?.step_tags).toBeNull();

    // Restore for downstream tests
    await svc
      .from("exemplars")
      .update({ step_tags: ["thesis", "topic_sentence_dev"] })
      .eq("id", taggedExemplar);
  });

  it("cross-tenant teacher cannot read step_tags", async () => {
    const { data, error } = await teacher2Client
      .from("exemplars")
      .select("step_tags")
      .eq("id", taggedExemplar);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("Promote-to-exemplar read access (chunk 6.4)", () => {
  // Promote-to-exemplar reads final_drafts.full_text via the
  // student_writing join. The teacher review surface uses
  // hasFinalDraftForPromotion + getWritingPrefillData; both rely on
  // student_writings_teacher_select for the writing visibility and
  // final_drafts's existing policy for the content. These tests
  // verify the access boundary at the SQL layer.
  const finalDraftAlex = "77777777-0000-0000-0000-000000000001";

  beforeAll(async () => {
    await svc
      .from("final_drafts")
      .upsert({
        id: finalDraftAlex,
        student_writing_id: TEST.alexWriting,
        full_text: "Alex's polished essay content for promotion.",
        title: "Promotion test",
      })
      .throwOnError();
  });

  afterAll(async () => {
    await svc.from("final_drafts").delete().eq("id", finalDraftAlex);
  });

  it("supervising teacher can read final_draft content via the writing join", async () => {
    const { data, error } = await teacherClient
      .from("student_writings")
      .select("id, final_draft:final_drafts ( full_text )")
      .eq("id", TEST.alexWriting)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const fdRaw = (data as unknown as { final_draft: unknown }).final_draft;
    const fd = Array.isArray(fdRaw)
      ? (fdRaw[0] as { full_text: string } | undefined)
      : (fdRaw as { full_text: string } | null);
    expect(fd?.full_text).toContain("Alex's polished essay");
  });

  it("teacher in another district cannot read this writing's final_draft", async () => {
    const { data, error } = await teacher2Client
      .from("final_drafts")
      .select("full_text")
      .eq("id", finalDraftAlex);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anon cannot read final_drafts", async () => {
    const { data, error } = await anonClient
      .from("final_drafts")
      .select("id");
    if (error) {
      expect(error.code).toBeDefined();
    } else {
      expect(data).toEqual([]);
    }
  });
});

describe("School-shared exemplars (chunk 6.3)", () => {
  // Self-contained fixtures.
  //   sharedPublished     — teacher's, published, expository, SHARED
  //   sharedDraft         — teacher's, draft, expository, SHARED (peer preview)
  //   unsharedPublished   — teacher's, published, expository, NOT shared
  //   crossSchoolShared   — teacher2's, published, expository, SHARED at School Y
  //
  // teacher2 is at a different school (TEST.school2 in TEST.district2).
  // To make teacher2 a same-school peer for one test, we'd need a third
  // teacher in the demo school; instead we test cross-school isolation
  // by confirming that the demo teacher cannot see teacher2's shared
  // exemplar.
  const sharedPublished = "66666666-0000-0000-0000-000000000001";
  const sharedDraft = "66666666-0000-0000-0000-000000000002";
  const unsharedPublished = "66666666-0000-0000-0000-000000000003";
  const crossSchoolShared = "66666666-0000-0000-0000-000000000004";

  beforeAll(async () => {
    await svc
      .from("exemplars")
      .upsert([
        {
          id: sharedPublished,
          district_id: IDS.district,
          school_id: IDS.school,
          created_by: IDS.teacher,
          title: "Share RLS — shared published",
          mode: "expository",
          full_text: "x",
          is_published: true,
          shared_with_school: true,
        },
        {
          id: sharedDraft,
          district_id: IDS.district,
          school_id: IDS.school,
          created_by: IDS.teacher,
          title: "Share RLS — shared draft",
          mode: "expository",
          full_text: "x",
          is_published: false,
          shared_with_school: true,
        },
        {
          id: unsharedPublished,
          district_id: IDS.district,
          school_id: IDS.school,
          created_by: IDS.teacher,
          title: "Share RLS — unshared published",
          mode: "expository",
          full_text: "x",
          is_published: true,
          shared_with_school: false,
        },
        {
          id: crossSchoolShared,
          district_id: TEST.district2,
          school_id: TEST.school2,
          created_by: TEST.teacher2,
          title: "Share RLS — cross-school shared",
          mode: "expository",
          full_text: "x",
          is_published: true,
          shared_with_school: true,
        },
      ])
      .throwOnError();
  });

  afterAll(async () => {
    await svc
      .from("exemplars")
      .delete()
      .in("id", [
        sharedPublished,
        sharedDraft,
        unsharedPublished,
        crossSchoolShared,
      ]);
  });

  it("teacher2 (different school) cannot see the demo teacher's shared exemplar", async () => {
    const { data, error } = await teacher2Client
      .from("exemplars")
      .select("id")
      .eq("id", sharedPublished);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("demo teacher cannot see teacher2's shared exemplar (cross-school)", async () => {
    const { data, error } = await teacherClient
      .from("exemplars")
      .select("id")
      .eq("id", crossSchoolShared);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("non-author cannot update a shared exemplar", async () => {
    // teacher2 can't see the row, so the UPDATE simply affects 0 rows.
    // Verify by reading back as svc that the title is unchanged.
    await teacher2Client
      .from("exemplars")
      .update({ title: "HIJACKED" })
      .eq("id", sharedPublished);

    const { data } = await svc
      .from("exemplars")
      .select("title")
      .eq("id", sharedPublished)
      .single();
    expect(data?.title).toBe("Share RLS — shared published");
  });

  it("teacher cannot pin a non-shared colleague's exemplar (via direct insert)", async () => {
    // teacher2 trying to pin the demo teacher's UNSHARED exemplar to a
    // teacher2-owned assignment. RLS rejects (assignment ownership +
    // exemplar ownership/share both fail).
    const { error } = await teacher2Client
      .from("assignment_exemplars")
      .insert({
        assignment_id: IDS.assignmentExpository,
        exemplar_id: unsharedPublished,
        pinned_by: TEST.teacher2,
      });
    expect(error).not.toBeNull();
  });

  it("anon cannot read shared exemplars", async () => {
    const { data, error } = await anonClient
      .from("exemplars")
      .select("id")
      .eq("id", sharedPublished);
    if (error) {
      expect(error.code).toBeDefined();
    } else {
      expect(data).toEqual([]);
    }
  });

  it("orphaned exemplar (created_by = NULL) remains readable via share path", async () => {
    // Simulate an author leaving by NULLing created_by on a shared row.
    await svc
      .from("exemplars")
      .update({ created_by: null })
      .eq("id", sharedPublished)
      .throwOnError();

    try {
      // The demo teacher is at the same school. They should still see it
      // via exemplars_school_teacher_read (the policy's created_by !=
      // auth.uid() evaluates NULL != uuid → NULL, which is treated as
      // FALSE; but the rest of the predicate matches — wait, NULL means
      // policy DOESN'T match for this row via the school path either).
      //
      // Actually orphan rows fall through to: any policy that grants
      // SELECT on this row. The school_teacher_read path needs
      // created_by != auth.uid() to be TRUE; with NULL it's NULL (not
      // TRUE). So an orphaned shared row is invisible via this path.
      //
      // Admin paths still grant access via auth_user_is_admin_for_school.
      // For non-admin teachers, orphaned shared exemplars become
      // effectively unreadable. Document this rather than fight it —
      // the test here just confirms current behavior so future changes
      // surface intentionally.
      const { data } = await teacherClient
        .from("exemplars")
        .select("id")
        .eq("id", sharedPublished);
      expect(data).toEqual([]);
    } finally {
      await svc
        .from("exemplars")
        .update({ created_by: IDS.teacher })
        .eq("id", sharedPublished);
    }
  });

  it("pin survives unshare (assignment_exemplars row independent of share state)", async () => {
    // Pin sharedPublished to the demo expository assignment as the
    // demo teacher (owns the assignment + owns the exemplar — but the
    // test is about the survival of the pin row, not the WITH CHECK).
    await svc
      .from("assignment_exemplars")
      .upsert(
        {
          assignment_id: IDS.assignmentExpository,
          exemplar_id: sharedPublished,
          pinned_by: IDS.teacher,
        },
        { onConflict: "assignment_id,exemplar_id" }
      )
      .throwOnError();

    // Toggle share off.
    await svc
      .from("exemplars")
      .update({ shared_with_school: false })
      .eq("id", sharedPublished)
      .throwOnError();

    try {
      const { data } = await svc
        .from("assignment_exemplars")
        .select("exemplar_id")
        .eq("assignment_id", IDS.assignmentExpository)
        .eq("exemplar_id", sharedPublished);
      expect(data?.length).toBe(1);
    } finally {
      await svc
        .from("exemplars")
        .update({ shared_with_school: true })
        .eq("id", sharedPublished);
      await svc
        .from("assignment_exemplars")
        .delete()
        .eq("assignment_id", IDS.assignmentExpository)
        .eq("exemplar_id", sharedPublished);
    }
  });
});

describe("Assignment-exemplar pins (chunk 6.2)", () => {
  // Self-contained fixtures (don't rely on the Exemplars block's
  // lifecycle, which would already have cleaned up by the time we run).
  //
  // Three exemplars seeded fresh:
  //   pinPublishedOwned   — teacher's, published, expository (pinnable)
  //   pinDraftOwned       — teacher's, draft, expository (write-pin only)
  //   pinOtherTeacher     — teacher2's, published, expository (forbidden)
  //
  // One pin row is pre-seeded: pinPublishedOwned pinned to the released
  // seed expository assignment. Alex (enrolled in that period) should
  // be able to read it.
  const pinPublishedOwned = "55555555-0000-0000-0000-000000000001";
  const pinDraftOwned = "55555555-0000-0000-0000-000000000002";
  const pinOtherTeacher = "55555555-0000-0000-0000-000000000003";

  beforeAll(async () => {
    await svc
      .from("exemplars")
      .upsert([
        {
          id: pinPublishedOwned,
          district_id: IDS.district,
          school_id: IDS.school,
          created_by: IDS.teacher,
          title: "Pin RLS — published owned",
          description: null,
          mode: "expository",
          full_text: "Pinned exemplar text.",
          is_published: true,
        },
        {
          id: pinDraftOwned,
          district_id: IDS.district,
          school_id: IDS.school,
          created_by: IDS.teacher,
          title: "Pin RLS — draft owned",
          description: null,
          mode: "expository",
          full_text: "Draft exemplar text.",
          is_published: false,
        },
        {
          id: pinOtherTeacher,
          district_id: TEST.district2,
          school_id: TEST.school2,
          created_by: TEST.teacher2,
          title: "Pin RLS — other teacher",
          description: null,
          mode: "expository",
          full_text: "Other-teacher exemplar text.",
          is_published: true,
        },
      ])
      .throwOnError();

    await svc
      .from("assignment_exemplars")
      .upsert(
        {
          assignment_id: IDS.assignmentExpository,
          exemplar_id: pinPublishedOwned,
          pinned_by: IDS.teacher,
        },
        { onConflict: "assignment_id,exemplar_id" }
      )
      .throwOnError();
  });

  afterAll(async () => {
    await svc
      .from("assignment_exemplars")
      .delete()
      .eq("assignment_id", IDS.assignmentExpository);
    await svc
      .from("exemplars")
      .delete()
      .in("id", [pinPublishedOwned, pinDraftOwned, pinOtherTeacher]);
  });

  it("teacher can read pins on their assignment", async () => {
    const { data, error } = await teacherClient
      .from("assignment_exemplars")
      .select("exemplar_id")
      .eq("assignment_id", IDS.assignmentExpository);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it("teacher can pin and unpin their own exemplar", async () => {
    const { error: pinErr } = await teacherClient
      .from("assignment_exemplars")
      .insert({
        assignment_id: IDS.assignmentExpository,
        exemplar_id: pinDraftOwned,
        pinned_by: IDS.teacher,
      });
    expect(pinErr).toBeNull();

    const { error: unpinErr } = await teacherClient
      .from("assignment_exemplars")
      .delete()
      .eq("assignment_id", IDS.assignmentExpository)
      .eq("exemplar_id", pinDraftOwned);
    expect(unpinErr).toBeNull();
  });

  it("teacher cannot pin another teacher's exemplar", async () => {
    const { error } = await teacherClient
      .from("assignment_exemplars")
      .insert({
        assignment_id: IDS.assignmentExpository,
        exemplar_id: pinOtherTeacher,
        pinned_by: IDS.teacher,
      });
    expect(error).not.toBeNull();
  });

  it("teacher in another district cannot pin to this assignment", async () => {
    const { error } = await teacher2Client
      .from("assignment_exemplars")
      .insert({
        assignment_id: IDS.assignmentExpository,
        exemplar_id: pinOtherTeacher,
        pinned_by: TEST.teacher2,
      });
    expect(error).not.toBeNull();
  });

  it("student in the class can read pin rows on the assignment", async () => {
    const { data, error } = await alexClient
      .from("assignment_exemplars")
      .select("exemplar_id")
      .eq("assignment_id", IDS.assignmentExpository);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it("anon cannot read pin rows", async () => {
    const { data, error } = await anonClient
      .from("assignment_exemplars")
      .select("exemplar_id");

    if (error) {
      expect(error.code).toBeDefined();
    } else {
      expect(data).toEqual([]);
    }
  });

  it("exemplars_student_read_via_pin: student can read a pinned exemplar even when teacher relationship is bypassed", async () => {
    // The student already reads this exemplar via the original
    // exemplars_student_read policy (their teacher made it), so this
    // assertion is a defense-in-depth verification that the new
    // via-pin policy resolves to TRUE for this scenario. The negative
    // case (teacher reassigned mid-cohort) is hard to fixture without
    // a transient class-period reshuffle; the via-pin policy's EXISTS
    // is the same shape as assignment_exemplars_student_read which is
    // already covered above.
    const { data, error } = await alexClient
      .from("exemplars")
      .select("id, full_text")
      .eq("id", pinPublishedOwned)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBe(pinPublishedOwned);
  });
});

describe("Rubric scores (chunk 5.1)", () => {
  // Service-role helper: seeds a single rubric_score row for Alex's writing.
  // Tests below verify each role's view of it through the RLS policies.
  const rubricRowId = "33333333-0000-0000-0000-000000000001";
  const criterionId = "33333333-0000-0000-0000-000000000010";

  beforeAll(async () => {
    await svc
      .from("rubric_scores")
      .upsert({
        id: rubricRowId,
        student_writing_id: TEST.alexWriting,
        criterion_id: criterionId,
        criterion_name: "Thesis clarity",
        max_score: 4,
        score: 3,
        level_label: "Proficient",
      })
      .throwOnError();
  });

  afterAll(async () => {
    await svc.from("rubric_scores").delete().eq("id", rubricRowId);
  });

  it("student can read their own rubric scores", async () => {
    const { data, error } = await alexClient
      .from("rubric_scores")
      .select("id")
      .eq("id", rubricRowId);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(1);
  });

  it("student cannot read another student's rubric scores", async () => {
    const { data, error } = await baileyClient
      .from("rubric_scores")
      .select("id")
      .eq("id", rubricRowId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("teacher can read rubric scores on their assignment", async () => {
    const { data, error } = await teacherClient
      .from("rubric_scores")
      .select("id, score")
      .eq("id", rubricRowId);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(1);
  });

  it("teacher in another district cannot read these rubric scores", async () => {
    const { data, error } = await teacher2Client
      .from("rubric_scores")
      .select("id")
      .eq("id", rubricRowId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("student cannot insert their own rubric scores", async () => {
    const { error } = await alexClient.from("rubric_scores").insert({
      student_writing_id: TEST.alexWriting,
      criterion_id: "33333333-0000-0000-0000-000000000099",
      criterion_name: "Self-graded",
      max_score: 4,
      score: 4,
    });

    expect(error).not.toBeNull();
  });

  it("teacher can insert rubric scores on their assignment", async () => {
    const tmpCriterion = "33333333-0000-0000-0000-000000000020";
    const { error: insErr } = await teacherClient.from("rubric_scores").insert({
      student_writing_id: TEST.alexWriting,
      criterion_id: tmpCriterion,
      criterion_name: "Evidence",
      max_score: 4,
      score: 2,
      level_label: "Developing",
    });

    expect(insErr).toBeNull();

    // Clean up via service role so afterAll's targeted delete leaves nothing.
    await svc
      .from("rubric_scores")
      .delete()
      .eq("student_writing_id", TEST.alexWriting)
      .eq("criterion_id", tmpCriterion);
  });

  it("teacher in another district cannot insert rubric scores", async () => {
    const { error } = await teacher2Client.from("rubric_scores").insert({
      student_writing_id: TEST.alexWriting,
      criterion_id: "33333333-0000-0000-0000-000000000030",
      criterion_name: "Hijack attempt",
      max_score: 4,
      score: 4,
    });

    expect(error).not.toBeNull();
  });

  it("anon cannot read rubric scores", async () => {
    const { data, error } = await anonClient
      .from("rubric_scores")
      .select("id");

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

/* ─── teacher_feedback: student resolve ──────────────────────────────────
 *
 * This table had NO RLS coverage until 0056, which is how
 * teacher_feedback_student_resolve reached production with a WITH CHECK that
 * always raised "more than one row returned by a subquery used as an
 * expression". Its pin subquery self-referenced the inner table, so it matched
 * every row instead of the one being updated — invisible while the table held
 * a single row.
 */

describe("teacher_feedback — student resolve", () => {
  const FEEDBACK_ID = "11111111-0000-0000-0000-00000000f001";
  const OTHER_FEEDBACK_ID = "11111111-0000-0000-0000-00000000f002";

  beforeAll(async () => {
    const svc = createServiceRoleClient();
    await svc.from("teacher_feedback").upsert([
      {
        id: FEEDBACK_ID,
        student_writing_id: TEST.alexWriting,
        teacher_id: IDS.teacher,
        target_kind: "student_writing",
        target_id: TEST.alexWriting,
        body: "Tighten your commentary.",
        grade_value: "B",
        is_resolved: false,
      },
      {
        id: OTHER_FEEDBACK_ID,
        student_writing_id: TEST.baileyWriting,
        teacher_id: IDS.teacher,
        target_kind: "student_writing",
        target_id: TEST.baileyWriting,
        body: "Nice work.",
        is_resolved: false,
      },
    ]);
  });

  afterAll(async () => {
    const svc = createServiceRoleClient();
    await svc
      .from("teacher_feedback")
      .delete()
      .in("id", [FEEDBACK_ID, OTHER_FEEDBACK_ID]);
  });

  it("lets a student mark their own feedback resolved", async () => {
    // The reported failure: this raised 21000 (more than one row returned by
    // a subquery used as an expression) for every student.
    const { error } = await alexClient
      .from("teacher_feedback")
      .update({ is_resolved: true })
      .eq("id", FEEDBACK_ID);

    expect(error).toBeNull();

    const svc = createServiceRoleClient();
    const { data } = await svc
      .from("teacher_feedback")
      .select("is_resolved")
      .eq("id", FEEDBACK_ID)
      .single();
    expect(data!.is_resolved).toBe(true);
  });

  it("does not let a student rewrite the teacher's words", async () => {
    await alexClient
      .from("teacher_feedback")
      .update({ body: "Actually this was great." })
      .eq("id", FEEDBACK_ID);

    const svc = createServiceRoleClient();
    const { data } = await svc
      .from("teacher_feedback")
      .select("body")
      .eq("id", FEEDBACK_ID)
      .single();
    expect(data!.body).toBe("Tighten your commentary.");
  });

  it("does not let a student change their own grade", async () => {
    // grade_value (0031) and step_key (0030) postdate the original policy and
    // were never pinned. The broken subquery hid that by failing closed.
    await alexClient
      .from("teacher_feedback")
      .update({ grade_value: "A" })
      .eq("id", FEEDBACK_ID);

    const svc = createServiceRoleClient();
    const { data } = await svc
      .from("teacher_feedback")
      .select("grade_value")
      .eq("id", FEEDBACK_ID)
      .single();
    expect(data!.grade_value).toBe("B");
  });

  it("does not let a student resolve someone else's feedback", async () => {
    await alexClient
      .from("teacher_feedback")
      .update({ is_resolved: true })
      .eq("id", OTHER_FEEDBACK_ID);

    const svc = createServiceRoleClient();
    const { data } = await svc
      .from("teacher_feedback")
      .select("is_resolved")
      .eq("id", OTHER_FEEDBACK_ID)
      .single();
    expect(data!.is_resolved).toBe(false);
  });
});

/* ─── Student-work artifact chain ────────────────────────────────────────
 *
 * A coverage audit (2026-08-13) found 18 of 33 RLS-protected tables had no
 * test at all. Fourteen of them are these artifact tables, and they all lean
 * on the same two helpers — auth_user_can_read_writing / _can_write_writing —
 * reached from a different FK depth each time:
 *
 *   depth 0  prompt_decodings, text_annotations, gathering_cds_sheets,
 *            body_paragraphs, essay_parts, step_progress   (student_writing_id)
 *   depth 1  t_charts, chunks, shaping_sheets, paragraph_forms (body_paragraph)
 *   depth 2  concrete_details, commentary_items, shaping_chunk_outputs (chunk)
 *   depth 1  candidate_cds                                  (gathering sheet)
 *
 * The risk is a join that walks up to the WRONG writing, which would hand one
 * student another's work. These probe each depth from Bailey's session against
 * Alex's rows — read and write — since a depth-2 mistake is invisible at
 * depth 0.
 */

describe("student-work artifacts — cross-student isolation", () => {
  const BP = "11111111-0000-0000-0000-00000000a001";
  const CHUNK = "11111111-0000-0000-0000-00000000a002";
  const CD = "11111111-0000-0000-0000-00000000a003";
  const SHEET = "11111111-0000-0000-0000-00000000a004";
  const CANDIDATE = "11111111-0000-0000-0000-00000000a005";
  const DECODING = "11111111-0000-0000-0000-00000000a006";

  beforeAll(async () => {
    const svc = createServiceRoleClient();

    /**
     * Seed failures MUST be loud. The first version of this block ignored the
     * upsert results; chunks.ratio is NOT NULL and was missing, so that row and
     * everything under it silently never existed — and "another student reads
     * nothing" passed for the wrong reason entirely. A negative RLS test over
     * absent rows proves nothing.
     */
    const seed = async (
      table: string,
      row: Record<string, unknown>
    ): Promise<void> => {
      const { error } = await svc.from(table).upsert(row);
      if (error) {
        throw new Error(`seed ${table} failed: ${error.message}`);
      }
    };

    // One full chain hanging off ALEX's writing.
    await seed("body_paragraphs", {
      id: BP,
      student_writing_id: TEST.alexWriting,
      position: 1,
    });
    await seed("chunks", {
      id: CHUNK,
      body_paragraph_id: BP,
      position: 1,
      ratio: "nonlit_expository_two_plus_to_one",
    });
    await seed("concrete_details", {
      id: CD,
      chunk_id: CHUNK,
      position: 1,
      text: "Alex's concrete detail",
    });
    await seed("gathering_cds_sheets", {
      id: SHEET,
      student_writing_id: TEST.alexWriting,
      body_paragraph_position: 1,
    });
    await seed("candidate_cds", {
      id: CANDIDATE,
      gathering_sheet_id: SHEET,
      position: 1,
      text: "Alex's candidate",
    });
    await seed("prompt_decodings", {
      id: DECODING,
      student_writing_id: TEST.alexWriting,
      task: "Alex's decode",
    });
  });

  afterAll(async () => {
    const svc = createServiceRoleClient();
    // Children first — FKs cascade from body_paragraphs but be explicit.
    await svc.from("candidate_cds").delete().eq("id", CANDIDATE);
    await svc.from("gathering_cds_sheets").delete().eq("id", SHEET);
    await svc.from("prompt_decodings").delete().eq("id", DECODING);
    await svc.from("concrete_details").delete().eq("id", CD);
    await svc.from("chunks").delete().eq("id", CHUNK);
    await svc.from("body_paragraphs").delete().eq("id", BP);
  });

  it("the owner can read their own chain at every depth", async () => {
    for (const [table, id] of [
      ["prompt_decodings", DECODING],
      ["body_paragraphs", BP],
      ["chunks", CHUNK],
      ["concrete_details", CD],
      ["gathering_cds_sheets", SHEET],
      ["candidate_cds", CANDIDATE],
    ] as const) {
      const { data } = await alexClient.from(table).select("id").eq("id", id);
      expect(data, `alex should read ${table}`).toHaveLength(1);
    }
  });

  it("another student reads nothing from it, at any depth", async () => {
    // A join that resolves to the wrong writing shows up here and nowhere else.
    for (const [table, id] of [
      ["prompt_decodings", DECODING],
      ["body_paragraphs", BP],
      ["chunks", CHUNK],
      ["concrete_details", CD],
      ["gathering_cds_sheets", SHEET],
      ["candidate_cds", CANDIDATE],
    ] as const) {
      const { data } = await baileyClient.from(table).select("id").eq("id", id);
      expect(data ?? [], `bailey must not read ${table}`).toHaveLength(0);
    }
  });

  it("another student cannot edit a depth-2 concrete detail", async () => {
    await baileyClient
      .from("concrete_details")
      .update({ text: "tampered" })
      .eq("id", CD);

    const svc = createServiceRoleClient();
    const { data } = await svc
      .from("concrete_details")
      .select("text")
      .eq("id", CD)
      .single();
    expect(data!.text).toBe("Alex's concrete detail");
  });

  it("another student cannot delete from someone else's chain", async () => {
    await baileyClient.from("candidate_cds").delete().eq("id", CANDIDATE);

    const svc = createServiceRoleClient();
    const { data } = await svc
      .from("candidate_cds")
      .select("id")
      .eq("id", CANDIDATE);
    expect(data).toHaveLength(1);
  });

  it("another student cannot graft a row onto someone else's paragraph", async () => {
    // WITH CHECK is the half a read test never reaches.
    const { error } = await baileyClient.from("chunks").insert({
      body_paragraph_id: BP,
      position: 99,
    });
    expect(error).not.toBeNull();
  });

  it("the owning teacher can read the chain", async () => {
    const { data } = await teacherClient
      .from("concrete_details")
      .select("id")
      .eq("id", CD);
    expect(data).toHaveLength(1);
  });

  it("anon reads nothing", async () => {
    const anon = createAnonClient();
    const { data } = await anon.from("concrete_details").select("id").eq("id", CD);
    expect(data ?? []).toHaveLength(0);
  });
});

/* ─── student-work artifacts, part 2 ─────────────────────────────────────
 * The eight tables the RLS coverage sweep left uncovered (BACKLOG item 4).
 *
 * All eight reach auth_user_can_{read,write}_writing, the same two helpers
 * the block above exercises — which is exactly why they were deferred, and
 * exactly why they still need probing. "Same mechanism" is an assumption,
 * and the sweep exists because an untested assumption was wrong. The failure
 * this catches is a join that walks to the WRONG writing, which is invisible
 * from any depth other than its own.
 *
 * Three depth classes, since that is the axis the join can get wrong:
 *   direct            essay_parts, text_annotations, step_progress
 *   via body_paragraph t_charts, shaping_sheets, paragraph_forms
 *   via chunk          commentary_items
 *   via shaping_sheet  shaping_chunk_outputs   ← its own path, see below
 */
describe("student-work artifacts, part 2 — the remaining eight tables", () => {
  // Alex's chain. A second body paragraph, because t_charts, shaping_sheets
  // and paragraph_forms are all UNIQUE on body_paragraph_id and the block
  // above already owns paragraph 1.
  const BP2 = "11111111-0000-0000-0000-00000000b001";
  const CHUNK2 = "11111111-0000-0000-0000-00000000b002";
  const CD2 = "11111111-0000-0000-0000-00000000b003";
  const TCHART = "11111111-0000-0000-0000-00000000b004";
  const SHAPING = "11111111-0000-0000-0000-00000000b005";
  const SCO = "11111111-0000-0000-0000-00000000b006";
  const PFORM = "11111111-0000-0000-0000-00000000b007";
  const ESSAY = "11111111-0000-0000-0000-00000000b008";
  const CM = "11111111-0000-0000-0000-00000000b009";
  const ANNOT = "11111111-0000-0000-0000-00000000b00a";
  const STEP = "11111111-0000-0000-0000-00000000b00b";

  // Bailey's own chain, so the graft probes below have a legitimate row to
  // hang the forged reference off. Without it those tests would fail on the
  // parent check and tell us nothing about the child.
  const BP_B = "11111111-0000-0000-0000-00000000b101";
  const CHUNK_B = "11111111-0000-0000-0000-00000000b102";
  const SHAPING_B = "11111111-0000-0000-0000-00000000b103";

  beforeAll(async () => {
    const svc = createServiceRoleClient();

    // Loud on failure, for the reason recorded in the block above: a negative
    // RLS test over rows that silently never existed proves nothing.
    const seed = async (
      table: string,
      row: Record<string, unknown>
    ): Promise<void> => {
      const { error } = await svc.from(table).upsert(row);
      if (error) {
        throw new Error(`seed ${table} failed: ${error.message}`);
      }
    };

    await seed("body_paragraphs", {
      id: BP2,
      student_writing_id: TEST.alexWriting,
      position: 2,
    });
    await seed("chunks", {
      id: CHUNK2,
      body_paragraph_id: BP2,
      position: 1,
      ratio: "nonlit_expository_two_plus_to_one",
    });
    await seed("concrete_details", {
      id: CD2,
      chunk_id: CHUNK2,
      position: 1,
      text: "Alex's second CD",
    });
    await seed("t_charts", {
      id: TCHART,
      body_paragraph_id: BP2,
      working_topic_sentence: "Alex's working TS",
    });
    await seed("shaping_sheets", {
      id: SHAPING,
      body_paragraph_id: BP2,
      final_topic_sentence: "Alex's final TS",
    });
    await seed("shaping_chunk_outputs", {
      id: SCO,
      shaping_sheet_id: SHAPING,
      chunk_id: CHUNK2,
      cd_sentences: ["Alex's CD sentence"],
    });
    await seed("paragraph_forms", {
      id: PFORM,
      body_paragraph_id: BP2,
      final_text: "Alex's assembled paragraph.",
    });
    await seed("essay_parts", {
      id: ESSAY,
      student_writing_id: TEST.alexWriting,
      thesis_text: "Alex's thesis",
    });
    await seed("commentary_items", {
      id: CM,
      chunk_id: CHUNK2,
      position: 1,
      text: "Alex's commentary",
      kind: "sentence",
    });
    await seed("text_annotations", {
      id: ANNOT,
      student_writing_id: TEST.alexWriting,
      range_start: 0,
      range_end: 10,
      selected_text: "Alex's mark",
      kind: "cd",
    });
    await seed("step_progress", {
      id: STEP,
      student_writing_id: TEST.alexWriting,
      step_key: "expository.gather_cds",
    });

    // Bailey's side.
    await seed("body_paragraphs", {
      id: BP_B,
      student_writing_id: TEST.baileyWriting,
      position: 1,
    });
    await seed("chunks", {
      id: CHUNK_B,
      body_paragraph_id: BP_B,
      position: 1,
      ratio: "nonlit_expository_two_plus_to_one",
    });
    await seed("shaping_sheets", {
      id: SHAPING_B,
      body_paragraph_id: BP_B,
      final_topic_sentence: "Bailey's final TS",
    });
  });

  afterAll(async () => {
    const svc = createServiceRoleClient();
    // Children first. FKs cascade, but an explicit order keeps a partial
    // failure from leaving orphans that break the next run's seed.
    await svc.from("step_progress").delete().eq("id", STEP);
    await svc.from("text_annotations").delete().eq("id", ANNOT);
    await svc.from("commentary_items").delete().eq("id", CM);
    await svc.from("essay_parts").delete().eq("id", ESSAY);
    await svc.from("paragraph_forms").delete().eq("id", PFORM);
    await svc.from("shaping_chunk_outputs").delete().eq("id", SCO);
    await svc.from("shaping_sheets").delete().in("id", [SHAPING, SHAPING_B]);
    await svc.from("t_charts").delete().eq("id", TCHART);
    await svc.from("concrete_details").delete().eq("id", CD2);
    await svc.from("chunks").delete().in("id", [CHUNK2, CHUNK_B]);
    await svc.from("body_paragraphs").delete().in("id", [BP2, BP_B]);
  });

  /** Every new table, with the row that should be visible to its owner. */
  const ALL = [
    ["t_charts", TCHART],
    ["shaping_sheets", SHAPING],
    ["shaping_chunk_outputs", SCO],
    ["paragraph_forms", PFORM],
    ["essay_parts", ESSAY],
    ["commentary_items", CM],
    ["text_annotations", ANNOT],
    ["step_progress", STEP],
  ] as const;

  it("the owner can read all eight (baseline: the rows exist)", async () => {
    for (const [table, id] of ALL) {
      const { data } = await alexClient.from(table).select("id").eq("id", id);
      expect(data, `alex should read ${table}`).toHaveLength(1);
    }
  });

  it("another student reads none of them, at any depth", async () => {
    for (const [table, id] of ALL) {
      const { data } = await baileyClient.from(table).select("id").eq("id", id);
      expect(data ?? [], `bailey must not read ${table}`).toHaveLength(0);
    }
  });

  it("the supervising teacher can read all eight", async () => {
    for (const [table, id] of ALL) {
      const { data } = await teacherClient.from(table).select("id").eq("id", id);
      expect(data, `teacher should read ${table}`).toHaveLength(1);
    }
  });

  it("a teacher in another district reads none of them", async () => {
    for (const [table, id] of ALL) {
      const { data } = await teacher2Client.from(table).select("id").eq("id", id);
      expect(data ?? [], `teacher2 must not read ${table}`).toHaveLength(0);
    }
  });

  it("anon reads none of them", async () => {
    const anon = createAnonClient();
    for (const [table, id] of ALL) {
      const { data } = await anon.from(table).select("id").eq("id", id);
      expect(data ?? [], `anon must not read ${table}`).toHaveLength(0);
    }
  });

  it("another student cannot edit a via-body-paragraph artifact", async () => {
    await baileyClient
      .from("t_charts")
      .update({ working_topic_sentence: "tampered" })
      .eq("id", TCHART);

    const svc = createServiceRoleClient();
    const { data } = await svc
      .from("t_charts")
      .select("working_topic_sentence")
      .eq("id", TCHART)
      .single();
    expect(data!.working_topic_sentence).toBe("Alex's working TS");
  });

  it("another student cannot edit a via-chunk artifact", async () => {
    await baileyClient
      .from("commentary_items")
      .update({ text: "tampered" })
      .eq("id", CM);

    const svc = createServiceRoleClient();
    const { data } = await svc
      .from("commentary_items")
      .select("text")
      .eq("id", CM)
      .single();
    expect(data!.text).toBe("Alex's commentary");
  });

  it("another student cannot delete a direct artifact", async () => {
    await baileyClient.from("step_progress").delete().eq("id", STEP);

    const svc = createServiceRoleClient();
    const { data } = await svc.from("step_progress").select("id").eq("id", STEP);
    expect(data).toHaveLength(1);
  });

  it("another student cannot annotate someone else's writing", async () => {
    // WITH CHECK on a direct table — the half a read test never reaches.
    const { error } = await baileyClient.from("text_annotations").insert({
      student_writing_id: TEST.alexWriting,
      range_start: 0,
      range_end: 4,
      selected_text: "graft",
      kind: "cd",
    });
    expect(error).not.toBeNull();
  });

  it("another student cannot attach a shaping sheet to someone else's paragraph", async () => {
    const { error } = await baileyClient.from("shaping_sheets").insert({
      body_paragraph_id: BP2,
      final_topic_sentence: "graft",
    });
    expect(error).not.toBeNull();
  });

  /*
   * The two tables below carry a SECOND foreign key that their policy does
   * not check. Both policies gate on one parent only:
   *
   *   shaping_chunk_outputs → shaping_sheet_id  (chunk_id ungated)
   *   commentary_items      → chunk_id          (parent_cd_id ungated)
   *
   * So the question is whether a student can hang a row off their OWN gated
   * parent while pointing the ungated column at another student's row. That
   * is not reachable from the tables already covered — every one of those has
   * a single parent — which makes it the part of item 4 that is genuinely new
   * rather than a rerun of the same helper at a new depth.
   */
  it("DOCUMENTS: a student CAN point a shaping output at another student's chunk", async () => {
    const { data, error } = await baileyClient
      .from("shaping_chunk_outputs")
      .insert({
        shaping_sheet_id: SHAPING_B, // Bailey's own — passes the gated check
        chunk_id: CHUNK2, // Alex's — ungated by the policy
        cd_sentences: ["grafted"],
      })
      .select("id");

    // Asserted through the service role, not through `error`. A null error is
    // weaker evidence than the row itself: the teardown below cascades from
    // both parents, so an earlier version of this test cleaned up the very
    // row it was meant to be proving existed.
    const svc = createServiceRoleClient();
    const { data: landed } = await svc
      .from("shaping_chunk_outputs")
      .select("id, shaping_sheet_id")
      .eq("chunk_id", CHUNK2)
      .eq("shaping_sheet_id", SHAPING_B);

    try {
      expect(error).toBeNull();
      expect(landed, "the forged row is accepted — see BACKLOG").toHaveLength(1);
    } finally {
      if (data?.[0]?.id) {
        await svc.from("shaping_chunk_outputs").delete().eq("id", data[0].id);
      }
    }
  });

  it("DOCUMENTS: a student CAN point a commentary item at another student's CD", async () => {
    const { data, error } = await baileyClient
      .from("commentary_items")
      .insert({
        chunk_id: CHUNK_B, // Bailey's own — passes the gated check
        parent_cd_id: CD2, // Alex's — ungated by the policy
        position: 1,
        text: "grafted",
        kind: "sentence",
      })
      .select("id");

    const svc = createServiceRoleClient();
    const { data: landed } = await svc
      .from("commentary_items")
      .select("id, chunk_id")
      .eq("parent_cd_id", CD2)
      .eq("chunk_id", CHUNK_B);

    try {
      expect(error).toBeNull();
      expect(landed, "the forged row is accepted — see BACKLOG").toHaveLength(1);
    } finally {
      if (data?.[0]?.id) {
        await svc.from("commentary_items").delete().eq("id", data[0].id);
      }
    }
  });

  it("but the forged reference discloses nothing — the embed is still gated", async () => {
    // The severity question. If PostgREST would resolve an embed across the
    // forged FK, this would be a cross-student READ of Alex's work, not just
    // referential pollution. It does not: RLS applies to the embedded table
    // independently of the joining row.
    const { data: inserted } = await baileyClient
      .from("commentary_items")
      .insert({
        chunk_id: CHUNK_B,
        parent_cd_id: CD2,
        position: 2,
        text: "graft probe",
        kind: "sentence",
      })
      .select("id");

    const svc = createServiceRoleClient();
    try {
      const { data } = await baileyClient
        .from("commentary_items")
        .select("id, parent_cd_id, concrete_details(id, text)")
        .eq("id", inserted![0]!.id)
        .single();

      // Bailey holds the pointer but cannot dereference it.
      expect(data!.parent_cd_id).toBe(CD2);
      expect(data!.concrete_details).toBeNull();
    } finally {
      if (inserted?.[0]?.id) {
        await svc.from("commentary_items").delete().eq("id", inserted[0].id);
      }
    }
  });
});

/* ─── audit_log ──────────────────────────────────────────────────────────
 * Append-only privileged-action record; the service role is its only writer.
 */
describe("audit_log", () => {
  it("cannot be written by an authenticated user", async () => {
    const { error } = await teacherClient.from("audit_log").insert({
      actor_id: IDS.teacher,
      action: "forged.entry",
      target_table: "districts",
      target_id: IDS.district,
    });
    expect(error).not.toBeNull();
  });

  it("cannot be written by a student", async () => {
    const { error } = await alexClient.from("audit_log").insert({
      actor_id: IDS.alex,
      action: "forged.entry",
      target_table: "districts",
      target_id: IDS.district,
    });
    expect(error).not.toBeNull();
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * The three tables the 2026-08-13 audit flagged as highest-risk and
 * untested. See docs/BACKLOG.md, "Finish the RLS coverage sweep".
 *
 * Ordered by blast radius rather than the backlog's list order:
 * class_teacher_assignments comes first because it feeds
 * auth_user_teaches_class_period, which is auth_user_can_read_writing's
 * teacher branch — so a bug there widens access to student work everywhere.
 *
 * Every block asserts the legitimate reader CAN see the row before asserting
 * anyone else cannot. A negative RLS test over rows that do not exist passes
 * for entirely the wrong reason, which is the trap the artifact-chain tests
 * fell into first time round.
 * ──────────────────────────────────────────────────────────────────────── */

describe("class_teacher_assignments — who teaches what", () => {
  /**
   * A district_admin belonging to the OTHER district.
   *
   * class_teacher_assignments_read reads:
   *   teacher_id = auth.uid()
   *   OR auth_user_role() IN ('super_admin','district_admin','school_admin')
   *
   * The admin branch carries no scope predicate, unlike its sibling
   * class_student_enrollments_admin_manage which gates on
   * auth_user_is_admin_for_school. This fixture exists to pin what that
   * actually means in the live database rather than reasoning about it.
   */
  const ADMIN2 = "11111111-0000-0000-0000-000000000201";
  const ADMIN2_EMAIL = "district-admin2-rls-test@demo.test";
  let admin2Client: SupabaseClient;

  beforeAll(async () => {
    const { data: existing } = await svc.auth.admin.getUserById(ADMIN2);
    if (!existing?.user) {
      const { error } = await svc.auth.admin.createUser({
        id: ADMIN2,
        email: ADMIN2_EMAIL,
        password: "rls-test-password-123",
        email_confirm: true,
      });
      if (error) throw new Error(`create admin2 failed: ${error.message}`);
    }

    await svc
      .from("user_profiles")
      .upsert({
        id: ADMIN2,
        district_id: TEST.district2,
        school_id: TEST.school2,
        role: "district_admin",
        first_name: "Other",
        last_name: "DistrictAdmin",
        email: ADMIN2_EMAIL,
      })
      .throwOnError();

    admin2Client = await createUserClient(ADMIN2);
  });

  it("the demo teacher can see their own pairing (baseline: the row exists)", async () => {
    const { data, error } = await teacherClient
      .from("class_teacher_assignments")
      .select("teacher_id, class_period_id")
      .eq("teacher_id", IDS.teacher);

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it("a teacher in another district sees none of it", async () => {
    const { data, error } = await teacher2Client
      .from("class_teacher_assignments")
      .select("teacher_id")
      .eq("teacher_id", IDS.teacher);

    // RLS filters rather than errors on SELECT.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("a teacher sees only their OWN pairings, not a colleague's", async () => {
    const { data } = await teacherClient
      .from("class_teacher_assignments")
      .select("teacher_id");

    const foreign = (data ?? []).filter(
      (r) => (r as { teacher_id: string }).teacher_id !== IDS.teacher
    );
    expect(foreign).toHaveLength(0);
  });

  it("a super admin sees across districts", async () => {
    const { data, error } = await superClient
      .from("class_teacher_assignments")
      .select("teacher_id")
      .eq("teacher_id", IDS.teacher);

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it("anon sees nothing", async () => {
    const { data } = await anonClient
      .from("class_teacher_assignments")
      .select("teacher_id");
    expect(data ?? []).toHaveLength(0);
  });

  it("DOCUMENTS: a district_admin reads pairings outside their own district", async () => {
    // Not an assertion that this is desirable — it pins current behaviour so
    // the decision is explicit rather than accidental.
    //
    // The admin branch of class_teacher_assignments_read has no scope
    // predicate, so any district_admin or school_admin reads every row in the
    // table regardless of tenant. Scope is: which teacher teaches which class
    // period, across all districts. It is metadata disclosure, NOT access to
    // student work — auth_user_can_read_writing's teacher branch goes through
    // auth_user_teaches_class_period, which tests teacher_id = auth.uid() and
    // is unaffected by who can SELECT this table.
    //
    // Compare class_student_enrollments_admin_manage, which does gate on
    // auth_user_is_admin_for_school. Tightening this one is a policy change
    // and needs sign-off (CLAUDE.md section 15.4) — logged in docs/BACKLOG.md.
    const { data, error } = await admin2Client
      .from("class_teacher_assignments")
      .select("teacher_id")
      .eq("teacher_id", IDS.teacher);

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it("a cross-district admin still cannot WRITE a pairing here", async () => {
    // The read hole above must not extend to writes: admin_manage IS scoped
    // via auth_user_is_admin_for_school, and forging a row would grant a
    // teacher access to another district's student work.
    const { error } = await admin2Client
      .from("class_teacher_assignments")
      .insert({
        teacher_id: TEST.teacher2,
        class_period_id: IDS.classPeriod,
      });

    expect(error).not.toBeNull();
  });

  it("a teacher cannot pair themselves with a period they do not teach", async () => {
    // admin_manage is the only write path and requires
    // auth_user_is_admin_for_school. Forging a row here would grant the
    // teacher auth_user_teaches_class_period for that period, and with it
    // every student writing under it.
    const { error } = await teacherClient
      .from("class_teacher_assignments")
      .insert({
        teacher_id: IDS.teacher,
        class_period_id: TEST.untaughtPeriod,
      });

    expect(error).not.toBeNull();
  });

  it("a teacher cannot pair themselves with a period in another school", async () => {
    const { error } = await teacherClient
      .from("class_teacher_assignments")
      .insert({
        teacher_id: IDS.teacher,
        class_period_id: TEST.foreignPeriod,
      });

    expect(error).not.toBeNull();
  });
});

describe("class_student_enrollments — roster privacy", () => {
  it("a student can see their own enrolment (baseline: the row exists)", async () => {
    const { data, error } = await alexClient
      .from("class_student_enrollments")
      .select("student_id, class_period_id")
      .eq("student_id", IDS.alex);

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it("a student cannot see a classmate's enrolment", async () => {
    // Alex and Bailey share a class period, so this is the sharpest form of
    // the question: same room, still none of your business.
    const { data } = await alexClient
      .from("class_student_enrollments")
      .select("student_id")
      .eq("student_id", IDS.bailey);

    expect(data ?? []).toHaveLength(0);
  });

  it("a student sees only their own rows, whatever they ask for", async () => {
    const { data } = await alexClient
      .from("class_student_enrollments")
      .select("student_id");

    const foreign = (data ?? []).filter(
      (r) => (r as { student_id: string }).student_id !== IDS.alex
    );
    expect(foreign).toHaveLength(0);
  });

  it("the teacher of the period can see its roster", async () => {
    const { data, error } = await teacherClient
      .from("class_student_enrollments")
      .select("student_id")
      .eq("class_period_id", IDS.classPeriod);

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it("a teacher in another district sees no part of that roster", async () => {
    const { data } = await teacher2Client
      .from("class_student_enrollments")
      .select("student_id")
      .eq("class_period_id", IDS.classPeriod);

    expect(data ?? []).toHaveLength(0);
  });

  it("a student cannot enrol themselves in a class", async () => {
    // Self-enrolment would hand a student every released assignment in that
    // period, and through auth_user_enrolled_in_class_period, its sources.
    const { error } = await alexClient
      .from("class_student_enrollments")
      .insert({
        student_id: IDS.alex,
        class_period_id: TEST.untaughtPeriod,
      });

    expect(error).not.toBeNull();
  });

  it("a student cannot remove themselves from a class", async () => {
    await alexClient
      .from("class_student_enrollments")
      .delete()
      .eq("student_id", IDS.alex);

    // Assert the row survived rather than guessing whether Postgres refuses
    // the delete or RLS filters it to zero rows — either is acceptable, a
    // missing enrolment is not.
    const { data: still } = await svc
      .from("class_student_enrollments")
      .select("student_id")
      .eq("student_id", IDS.alex);

    expect(still?.length ?? 0).toBeGreaterThan(0);
  });

  it("anon sees nothing", async () => {
    const { data } = await anonClient
      .from("class_student_enrollments")
      .select("student_id");
    expect(data ?? []).toHaveLength(0);
  });
});

describe("assignment_sources — source text follows assignment visibility", () => {
  /**
   * Seeded here rather than assumed. The seed's expository assignment carries
   * NO assignment_sources row, so the first draft of this block had every
   * negative test passing over an empty table — "a student in another district
   * cannot read them" is trivially true when there is nothing to read.
   *
   * The baseline test below is what caught it, which is the whole reason the
   * backlog's method note insists on asserting the owner CAN read first.
   */
  const SOURCE = "11111111-0000-0000-0000-00000000b001";
  /** Same, on the UNRELEASED assignment — see the unreleased test below. */
  const UNRELEASED_SOURCE = "11111111-0000-0000-0000-00000000b002";

  beforeAll(async () => {
    const seed = async (id: string, assignmentId: string, title: string) => {
      const { error } = await svc.from("assignment_sources").upsert({
        id,
        assignment_id: assignmentId,
        // position 90 keeps clear of anything the app or a later seed adds;
        // the table is UNIQUE (assignment_id, position).
        position: 90,
        kind: "primary",
        source_text: `${title} source text`,
        source_title: title,
        source_render_mode: "plain",
      });
      if (error) {
        throw new Error(`seed assignment_sources ${title} failed: ${error.message}`);
      }
    };

    await seed(SOURCE, IDS.assignmentExpository, "RLS probe");
    await seed(UNRELEASED_SOURCE, TEST.unreleased, "RLS unreleased probe");
  });

  afterAll(async () => {
    await svc
      .from("assignment_sources")
      .delete()
      .in("id", [SOURCE, UNRELEASED_SOURCE]);
  });

  it("the owning teacher can read their assignment's sources (baseline)", async () => {
    const { data, error } = await teacherClient
      .from("assignment_sources")
      .select("id, assignment_id")
      .eq("assignment_id", IDS.assignmentExpository);

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it("an enrolled student can read the sources of a released assignment", async () => {
    // Without this the student reaches Read & Annotate and finds nothing to
    // annotate, so it is as much a functional test as a security one.
    const { data, error } = await alexClient
      .from("assignment_sources")
      .select("id")
      .eq("assignment_id", IDS.assignmentExpository);

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it("a teacher in another district cannot read them", async () => {
    const { data } = await teacher2Client
      .from("assignment_sources")
      .select("id")
      .eq("assignment_id", IDS.assignmentExpository);

    expect(data ?? []).toHaveLength(0);
  });

  it("the teacher CAN read sources of their unreleased assignment (baseline)", async () => {
    // Pins that the row genuinely exists and is reachable, so the student
    // test below is refused by the released_at clause rather than by there
    // being nothing there.
    const { data, error } = await teacherClient
      .from("assignment_sources")
      .select("id")
      .eq("id", UNRELEASED_SOURCE);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it("a student cannot read sources of an UNRELEASED assignment", async () => {
    // Draft assignments leak their source text otherwise — a teacher building
    // next week's prompt would be publishing it early.
    const { data } = await alexClient
      .from("assignment_sources")
      .select("id")
      .eq("id", UNRELEASED_SOURCE);

    expect(data ?? []).toHaveLength(0);
  });

  it("a student cannot add a source to an assignment", async () => {
    const { error } = await alexClient.from("assignment_sources").insert({
      assignment_id: IDS.assignmentExpository,
      position: 99,
      kind: "primary",
      source_text: "forged by a student",
    });

    expect(error).not.toBeNull();
  });

  it("a student cannot edit an existing source", async () => {
    await alexClient
      .from("assignment_sources")
      .update({ source_title: "tampered" })
      .eq("id", SOURCE);

    const { data: after } = await svc
      .from("assignment_sources")
      .select("source_title")
      .eq("id", SOURCE)
      .single();

    expect((after as { source_title: string | null }).source_title).toBe(
      "RLS probe"
    );
  });

  it("a teacher in another district cannot delete a source", async () => {
    // The open storage-bucket item notes any teacher can delete any FILE
    // under their school prefix; the ROW must at least hold across districts.
    await teacher2Client.from("assignment_sources").delete().eq("id", SOURCE);

    const { data: after } = await svc
      .from("assignment_sources")
      .select("id")
      .eq("id", SOURCE)
      .maybeSingle();

    expect(after).not.toBeNull();
  });

  it("anon sees nothing", async () => {
    const { data } = await anonClient.from("assignment_sources").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
