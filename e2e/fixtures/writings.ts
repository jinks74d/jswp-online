/**
 * Discovers the student's real writings and derives each one's visible step
 * list from lib/jswp-modes.ts — the same config the router uses.
 *
 * Deriving rather than hardcoding is the point. If someone adds, removes or
 * reorders a step, this suite walks the NEW list automatically, so the routes
 * it covers can never silently drift out of step with the step engine. A
 * hardcoded list would keep passing while quietly testing a stale app.
 *
 * Uses the service role because it needs to see across students to pick
 * fixtures. Nothing here asserts anything about permissions; role-access.spec
 * does that through the browser, where RLS actually applies.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getSteps, type JswpMode, type ChunkRatio } from "../../lib/jswp-modes";
import { CREDENTIALS } from "./accounts";

loadEnv({ path: ".env.local" });

/**
 * Where the setup project banks the discovered fixtures.
 *
 * Discovery needs the database, which is async, but Playwright collects specs
 * synchronously — a top-level await in a spec file cannot work under this
 * project's CommonJS resolution. So the setup project queries once and writes
 * here, and specs read it synchronously at collection time.
 */
export const WRITINGS_FIXTURE_PATH = "e2e/.auth/writings.json";

export interface WritingFixture {
  mode: JswpMode;
  writingId: string;
  assignmentTitle: string;
  /** Visible step slugs, in order, for this writing's assignment context. */
  slugs: string[];
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "e2e fixtures need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * One writing per mode belonging to the E2E student, newest first.
 *
 * Returns only the modes that actually have a writing. A mode with no seeded
 * writing is reported by the spec as skipped rather than silently dropped —
 * "we covered every mode" must never be a claim the fixtures quietly weaken.
 */
export async function loadWritingFixtures(): Promise<WritingFixture[]> {
  const db = admin();

  const { data: student, error: se } = await db
    .from("user_profiles")
    .select("id")
    .eq("email", CREDENTIALS.student.email)
    .maybeSingle();
  if (se) throw new Error(`Could not look up the E2E student: ${se.message}`);
  if (!student) {
    throw new Error(
      `No user_profiles row for ${CREDENTIALS.student.email}. Run "npm run seed:auth".`
    );
  }

  const { data: writings, error: we } = await db
    .from("student_writings")
    .select("id, assignment_id, created_at")
    .eq("student_id", (student as { id: string }).id)
    .order("created_at", { ascending: false });
  if (we) throw new Error(`Could not load student writings: ${we.message}`);

  const out: WritingFixture[] = [];
  const seen = new Set<JswpMode>();

  for (const w of (writings ?? []) as { id: string; assignment_id: string }[]) {
    const { data: a } = await db
      .from("assignments")
      .select(
        "title, mode, is_essay, has_counterargument, default_chunk_ratio"
      )
      .eq("id", w.assignment_id)
      .maybeSingle();
    if (!a) continue;

    const asg = a as {
      title: string;
      mode: JswpMode;
      is_essay: boolean | null;
      has_counterargument: boolean | null;
      default_chunk_ratio: ChunkRatio;
    };
    if (seen.has(asg.mode)) continue;

    // The annotate step only appears when the assignment actually has a
    // source, so ask the sources table rather than guessing.
    const { count } = await db
      .from("assignment_sources")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", w.assignment_id);

    const steps = getSteps(asg.mode, {
      isEssay: asg.is_essay ?? false,
      hasCounterargument: asg.has_counterargument ?? false,
      hasSourceText: (count ?? 0) > 0,
      chunkRatio: asg.default_chunk_ratio,
    });

    seen.add(asg.mode);
    out.push({
      mode: asg.mode,
      writingId: w.id,
      assignmentTitle: asg.title,
      slugs: steps.map((s) => s.slug),
    });
  }

  return out;
}

/** Persist discovered fixtures for the specs to read synchronously. */
export function writeWritingFixtures(fixtures: WritingFixture[]): void {
  mkdirSync(dirname(WRITINGS_FIXTURE_PATH), { recursive: true });
  writeFileSync(WRITINGS_FIXTURE_PATH, JSON.stringify(fixtures, null, 2));
}

/**
 * Read the banked fixtures at spec-collection time.
 *
 * Returns [] when the file is absent rather than throwing, so that a spec file
 * still loads and reports "no fixtures" as a normal failing test instead of
 * exploding during collection, where the error is far harder to read.
 */
export function readWritingFixtures(): WritingFixture[] {
  try {
    return JSON.parse(readFileSync(WRITINGS_FIXTURE_PATH, "utf8")) as WritingFixture[];
  } catch {
    return [];
  }
}

export const ALL_MODES: readonly JswpMode[] = [
  "expository",
  "argumentation",
  "literary",
  "narrative",
];
