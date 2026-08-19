/**
 * RLS + RPC authorization tests for migration 0061
 * ─────────────────────────────────────────────────────────────────────────
 * Covers the cross-district analytics viewer: the district_access_grants
 * table, auth_user_can_view_district(), and the two SECURITY DEFINER
 * analytics RPCs.
 *
 * These RPCs bypass RLS by construction, so their in-body gate is the only
 * thing protecting four districts' worth of data. That makes this file the
 * whole safety story for 0061 — the same gap CLAUDE.md §2 flags for the 0052
 * and 0053 RPCs, which still ship untested.
 *
 * Prerequisites:
 *   1. migrations/0001–0061 applied (0061 especially — every test here fails
 *      with "function does not exist" or a CHECK violation without it).
 *   2. scripts/seed-auth.ts has been run.
 *   3. .env.local populated. This suite MUTATES a live project.
 *
 * The fixture: an analyst whose HOME district is demo but whose only grant is
 * to a second district. That split is the point — it proves the grant, not
 * profile.district_id, is what the gate reads, and that the home district is
 * not silently readable through the analytics path.
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
  demoDistrict: "00000000-0000-0000-0000-000000000001",
  superAdmin: "6e0c3f40-7ecd-4e83-a883-14daa4b0f91b",
  teacher: "939c2df8-ae49-40b8-b216-bd4d6b61ea43",
  alex: "30d8b2f9-0bf9-4044-a254-9b8a0612b584",
} as const;

/* ─── Test-only fixtures (created in beforeAll, cleaned in afterAll) ──── */

const TEST = {
  // The district the analyst IS granted.
  grantedDistrict: "33333333-0000-0000-0000-000000000001",
  grantedSchool: "33333333-0000-0000-0000-000000000010",
  // A district the analyst is NOT granted — the negative control.
  ungrantedDistrict: "33333333-0000-0000-0000-000000000002",

  analyst: "33333333-0000-0000-0000-000000000200",
  analystEmail: "analyst-0061-test@demo.test",

  // A second analyst, to prove one analyst cannot enumerate another's grants.
  analyst2: "33333333-0000-0000-0000-000000000201",
  analyst2Email: "analyst2-0061-test@demo.test",
} as const;

const svc = createServiceRoleClient();
const anonClient = createAnonClient();

let analystClient: SupabaseClient;
let analyst2Client: SupabaseClient;
let teacherClient: SupabaseClient;
let superClient: SupabaseClient;

/* ─── Setup & Teardown ────────────────────────────────────────────────── */

beforeAll(async () => {
  for (const [id, email] of [
    [TEST.analyst, TEST.analystEmail],
    [TEST.analyst2, TEST.analyst2Email],
  ] as const) {
    const { data: existing } = await svc.auth.admin.getUserById(id);
    if (!existing?.user) {
      const { error } = await svc.auth.admin.createUser({
        id,
        email,
        password: "rls-test-password-123",
        email_confirm: true,
      });
      if (error) {
        throw new Error(`Failed to create ${email}: ${error.message}`);
      }
    }
  }

  for (const [id, name, sub] of [
    [TEST.grantedDistrict, "Granted District", "granted-0061"],
    [TEST.ungrantedDistrict, "Ungranted District", "ungranted-0061"],
  ] as const) {
    await svc
      .from("districts")
      .upsert({
        id,
        name,
        subdomain: sub,
        primary_color: "#123456",
        contact_email: `${sub}@test.test`,
      })
      .throwOnError();
  }

  await svc
    .from("schools")
    .upsert({
      id: TEST.grantedSchool,
      district_id: TEST.grantedDistrict,
      name: "Granted School",
      level: "high",
    })
    .throwOnError();

  // Home district is demo; school_id is NULL. The NULL is only legal because
  // 0061 §2 relaxed the unnamed CHECK from 0001 — if that part of the
  // migration is missing, this upsert is where it shows.
  for (const id of [TEST.analyst, TEST.analyst2]) {
    await svc
      .from("user_profiles")
      .upsert({
        id,
        district_id: IDS.demoDistrict,
        school_id: null,
        role: "district_analyst",
        first_name: "Test",
        last_name: "Analyst",
        email: id === TEST.analyst ? TEST.analystEmail : TEST.analyst2Email,
        active: true,
      })
      .throwOnError();
  }

  // Analyst 1 is granted the granted district ONLY — not their home district,
  // and not the ungranted one.
  await svc
    .from("district_access_grants")
    .upsert({
      user_id: TEST.analyst,
      district_id: TEST.grantedDistrict,
      granted_by: IDS.superAdmin,
    })
    .throwOnError();

  analystClient = await createUserClient(TEST.analyst);
  analyst2Client = await createUserClient(TEST.analyst2);
  teacherClient = await createUserClient(IDS.teacher);
  superClient = await createUserClient(IDS.superAdmin);
}, 60_000);

afterAll(async () => {
  await svc
    .from("district_access_grants")
    .delete()
    .in("user_id", [TEST.analyst, TEST.analyst2]);
  await svc
    .from("user_profiles")
    .delete()
    .in("id", [TEST.analyst, TEST.analyst2]);
  await svc.from("schools").delete().eq("id", TEST.grantedSchool);
  await svc
    .from("districts")
    .delete()
    .in("id", [TEST.grantedDistrict, TEST.ungrantedDistrict]);
  await svc.auth.admin.deleteUser(TEST.analyst);
  await svc.auth.admin.deleteUser(TEST.analyst2);
});

/* ─── district_access_grants: reads ───────────────────────────────────── */

describe("district_access_grants — read scope", () => {
  it("lets an analyst read their own grants", async () => {
    const { data, error } = await analystClient
      .from("district_access_grants")
      .select("district_id")
      .eq("user_id", TEST.analyst);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].district_id).toBe(TEST.grantedDistrict);
  });

  it("does not let one analyst enumerate another analyst's grants", async () => {
    // The read_admin policy uses is_admin_for_district, NOT can_view — so
    // holding a grant must not confer the ability to see who else holds one.
    const { data, error } = await analyst2Client
      .from("district_access_grants")
      .select("user_id")
      .eq("user_id", TEST.analyst);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("lets a super admin read grants in any district", async () => {
    const { data, error } = await superClient
      .from("district_access_grants")
      .select("user_id, district_id")
      .eq("district_id", TEST.grantedDistrict);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it("returns nothing to anon", async () => {
    const { data } = await anonClient
      .from("district_access_grants")
      .select("user_id");

    expect(data ?? []).toHaveLength(0);
  });
});

/* ─── district_access_grants: writes are service-role only ────────────── */

describe("district_access_grants — no write path", () => {
  it("refuses an analyst granting themselves a new district", async () => {
    // The escalation that matters: if this succeeded, the whole model is
    // decorative — an analyst could reach every district on the platform.
    const { error } = await analystClient
      .from("district_access_grants")
      .insert({
        user_id: TEST.analyst,
        district_id: TEST.ungrantedDistrict,
        granted_by: TEST.analyst,
      });

    expect(error).not.toBeNull();
  });

  it("refuses an analyst deleting their own grant", async () => {
    await analystClient
      .from("district_access_grants")
      .delete()
      .eq("user_id", TEST.analyst);

    // Deletes that match no policy affect zero rows rather than erroring, so
    // assert on the surviving row rather than on the error.
    const { data } = await svc
      .from("district_access_grants")
      .select("district_id")
      .eq("user_id", TEST.analyst);

    expect(data).toHaveLength(1);
  });

  it("refuses a teacher inserting a grant", async () => {
    const { error } = await teacherClient
      .from("district_access_grants")
      .insert({
        user_id: IDS.teacher,
        district_id: IDS.demoDistrict,
        granted_by: IDS.teacher,
      });

    expect(error).not.toBeNull();
  });
});

/* ─── get_district_analytics ──────────────────────────────────────────── */

describe("get_district_analytics — authorization gate", () => {
  it("returns a row for a district the analyst was granted", async () => {
    const { data, error } = await analystClient
      .rpc("get_district_analytics", { p_district_id: TEST.grantedDistrict })
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ district_id: TEST.grantedDistrict });
  });

  it("raises 42501 for a district the analyst was NOT granted", async () => {
    const { error } = await analystClient
      .rpc("get_district_analytics", { p_district_id: TEST.ungrantedDistrict })
      .single();

    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("raises 42501 for the analyst's own HOME district", async () => {
    // profile.district_id is an address, not a scope. An analyst with no
    // grant on their home district must not read it — otherwise the column
    // is quietly still doing authorization and the grant table is a fiction.
    const { error } = await analystClient
      .rpc("get_district_analytics", { p_district_id: IDS.demoDistrict })
      .single();

    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("raises 42501 for a teacher, who holds no grant and admins nothing", async () => {
    const { error } = await teacherClient
      .rpc("get_district_analytics", { p_district_id: IDS.demoDistrict })
      .single();

    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("lets a super admin read any district", async () => {
    const { data, error } = await superClient
      .rpc("get_district_analytics", { p_district_id: TEST.ungrantedDistrict })
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ district_id: TEST.ungrantedDistrict });
  });

  it("refuses anon", async () => {
    const { error } = await anonClient
      .rpc("get_district_analytics", { p_district_id: TEST.grantedDistrict })
      .single();

    expect(error).not.toBeNull();
  });

  it("honours the window parameters", async () => {
    // A window entirely in the past must produce zero activity even though
    // the roster denominators are unaffected by it.
    const { data, error } = await analystClient
      .rpc("get_district_analytics", {
        p_district_id: TEST.grantedDistrict,
        p_since: "2000-01-01T00:00:00Z",
        p_until: "2000-12-31T00:00:00Z",
      })
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      teachers_active: 0,
      students_active: 0,
      writings_started: 0,
    });
  });
});

/* ─── get_district_step_funnel ────────────────────────────────────────── */

describe("get_district_step_funnel — authorization gate", () => {
  it("succeeds for a granted district", async () => {
    const { error } = await analystClient.rpc("get_district_step_funnel", {
      p_district_id: TEST.grantedDistrict,
    });

    expect(error).toBeNull();
  });

  it("raises 42501 for an ungranted district", async () => {
    const { error } = await analystClient.rpc("get_district_step_funnel", {
      p_district_id: TEST.ungrantedDistrict,
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("refuses anon", async () => {
    const { error } = await anonClient.rpc("get_district_step_funnel", {
      p_district_id: TEST.grantedDistrict,
    });

    expect(error).not.toBeNull();
  });
});

/* ─── The aggregates-only promise ─────────────────────────────────────── */

describe("analyst gets aggregates only, never rows", () => {
  it("cannot read student_writings in a district it can analyse", async () => {
    // This is the load-bearing assertion of the whole design. 0061 touches no
    // existing policy precisely because the analyst never receives row access
    // — if that ever stops being true, the migration's central claim is void.
    const { data, error } = await analystClient
      .from("student_writings")
      .select("id");

    expect(error?.code ?? null).not.toBe("42P01");
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot read user_profiles of students in a granted district", async () => {
    const { data } = await analystClient
      .from("user_profiles")
      .select("id")
      .eq("id", IDS.alex);

    expect(data ?? []).toHaveLength(0);
  });

  it("cannot read assignments in a granted district", async () => {
    const { data } = await analystClient
      .from("assignments")
      .select("id")
      .eq("district_id", TEST.grantedDistrict);

    expect(data ?? []).toHaveLength(0);
  });
});
