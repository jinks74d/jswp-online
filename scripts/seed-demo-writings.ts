/**
 * Ensure the demo student has one writing per JSWP mode.
 *
 * The E2E step sweep walks a real writing per mode (e2e/fixtures/writings.ts).
 * Modes without one are silently uncovered — the suite warns, but a warning on
 * line 200 of a passing run is not a safety net. Argumentation was in exactly
 * that state: a published assignment existed, but no student had ever started
 * it, so the mode with the most conditional steps (concession /
 * counterargument / refutation, thesis frames) was the one nobody tested.
 *
 * Idempotent: creates only what is missing and never edits an existing
 * writing, so it is safe to re-run and cannot clobber work in the demo
 * environment.
 *
 * Usage: npm run seed:writings
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL ?? "alex@demo.test";

type Mode = "expository" | "argumentation" | "literary" | "narrative";
const MODES: Mode[] = ["expository", "argumentation", "literary", "narrative"];

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: student, error: se } = await db
    .from("user_profiles")
    .select("id")
    .eq("email", STUDENT_EMAIL)
    .maybeSingle();
  if (se) throw new Error(`Could not look up ${STUDENT_EMAIL}: ${se.message}`);
  if (!student) {
    throw new Error(
      `No user_profiles row for ${STUDENT_EMAIL}. Run "npm run seed:auth" first.`
    );
  }
  const studentId = (student as { id: string }).id;

  // Which modes does this student already have a writing for?
  const { data: existing, error: ee } = await db
    .from("student_writings")
    .select("assignment_id")
    .eq("student_id", studentId);
  if (ee) throw new Error(`Could not read student writings: ${ee.message}`);

  const existingAssignmentIds = new Set(
    ((existing ?? []) as { assignment_id: string }[]).map((r) => r.assignment_id)
  );

  const covered = new Set<Mode>();
  if (existingAssignmentIds.size > 0) {
    const { data: theirs } = await db
      .from("assignments")
      .select("id, mode")
      .in("id", [...existingAssignmentIds]);
    for (const a of (theirs ?? []) as { mode: Mode }[]) covered.add(a.mode);
  }

  for (const mode of MODES) {
    if (covered.has(mode)) {
      console.log(`  ${mode.padEnd(14)} already has a writing — skipped`);
      continue;
    }

    // Any published assignment in this mode will do; the sweep only needs a
    // reachable step list, not particular content.
    const { data: asg } = await db
      .from("assignments")
      .select("id, title, default_chunk_ratio")
      .eq("mode", mode)
      .not("released_at", "is", null)
      .limit(1)
      .maybeSingle();

    if (!asg) {
      console.log(
        `  ${mode.padEnd(14)} NO published assignment — cannot seed; create one first`
      );
      continue;
    }

    const a = asg as {
      id: string;
      title: string;
      default_chunk_ratio: string;
    };

    const { error: ie } = await db.from("student_writings").insert({
      assignment_id: a.id,
      student_id: studentId,
      chunk_ratio: a.default_chunk_ratio,
      // Left at the first step deliberately. The sweep visits every step URL
      // directly; starting further in would only mask a broken early step.
      current_step: `${mode}.decode_prompt`,
      status: "draft",
    } as never);

    if (ie) {
      console.log(`  ${mode.padEnd(14)} FAILED: ${ie.message}`);
      continue;
    }
    console.log(`  ${mode.padEnd(14)} created on "${a.title}"`);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
