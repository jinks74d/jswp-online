/**
 * backfill:source-html — rebuild assignments.source_html for previously-added
 * rich (.docx) sources so the formatted Reading & Annotation render
 * (docs/superpowers/specs/2026-06-16-formatted-annotate-source-design.md)
 * applies to assignments created before the formatting allowlist was widened.
 *
 * Why a re-convert (not just a re-sanitize): the original sanitizer used
 * KEEP_CONTENT, so the *stored* source_html already lost its <table>/<img>/<a>
 * structure (only the text survived). The structure can only be recovered from
 * the original .docx in the assignment-sources bucket, re-run through the same
 * mammoth → sanitize → substrate pipeline a fresh save uses.
 *
 * Safety: because KEEP_CONTENT preserved the text, the re-derived substrate
 * normally equals the stored source_text, so annotation offsets do not move.
 * Policy (operator-chosen 2026-06-16): force-update every re-convertible .docx
 * source; if the substrate DID change and annotations already exist, the run
 * reports it loudly so shifted highlights can be reviewed.
 *
 * Dry-run by default. Pass --apply to write. Idempotent.
 *
 * Run: npm run backfill:source-html         (dry run)
 *      npm run backfill:source-html -- --apply
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import mammoth from "mammoth";

import {
  sanitizeSourceHtml,
  sourceHtmlToSubstrate,
} from "../lib/source-content-core";
import { planBackfill } from "./backfill-plan";

config({ path: ".env.local" });

const BUCKET = "assignment-sources";

interface AssignmentRow {
  id: string;
  title: string | null;
  source_text: string | null;
  source_file_path: string | null;
  source_file_name: string | null;
}

function isDocxName(path: string | null, name: string | null): boolean {
  const candidate = (name ?? path ?? "").toLowerCase();
  return candidate.endsWith(".docx");
}

async function countAnnotations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
  assignmentId: string
): Promise<number> {
  const { data: writings } = await svc
    .from("student_writings")
    .select("id")
    .eq("assignment_id", assignmentId);
  const ids = (writings ?? []).map((w: { id: string }) => w.id);
  if (ids.length === 0) return 0;
  const { count } = await svc
    .from("text_annotations")
    .select("id", { count: "exact", head: true })
    .in("student_writing_id", ids);
  return count ?? 0;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  const apply = process.argv.includes("--apply");
  const svc = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await svc
    .from("assignments")
    .select("id, title, source_text, source_file_path, source_file_name")
    .eq("source_render_mode", "rich");

  if (error) {
    console.error(`✗ Could not read assignments: ${error.message}`);
    process.exit(1);
  }

  const rows = (data ?? []) as AssignmentRow[];
  console.log(
    `${apply ? "APPLY" : "DRY RUN"} — ${rows.length} rich assignment(s) to consider\n`
  );

  let updated = 0;
  let skippedNoFile = 0;
  let skippedNotDocx = 0;
  let conversionFailed = 0;
  const atRisk: { id: string; title: string | null }[] = [];

  for (const a of rows) {
    const hasFile = !!a.source_file_path;
    const isDocx = isDocxName(a.source_file_path, a.source_file_name);

    if (!hasFile || !isDocx) {
      const plan = planBackfill({
        hasFile,
        isDocx,
        oldText: a.source_text ?? "",
        newSubstrate: a.source_text ?? "",
        annotationCount: 0,
      });
      if (plan.action === "skip" && plan.reason === "no-file") skippedNoFile++;
      else skippedNotDocx++;
      continue;
    }

    // Re-convert the original .docx through the exact app pipeline.
    let newHtml: string;
    let newSubstrate: string;
    try {
      const { data: blob, error: dlErr } = await svc.storage
        .from(BUCKET)
        .download(a.source_file_path as string);
      if (dlErr || !blob) throw new Error(dlErr?.message ?? "download returned no data");
      const buffer = Buffer.from(await blob.arrayBuffer());
      const { value } = await mammoth.convertToHtml({ buffer });
      newHtml = sanitizeSourceHtml(value);
      newSubstrate = sourceHtmlToSubstrate(newHtml);
    } catch (e) {
      conversionFailed++;
      console.error(
        `  ✗ convert failed [${a.id}] ${a.title ?? ""}: ${e instanceof Error ? e.message : e}`
      );
      continue;
    }

    if (newSubstrate.trim() === "") {
      conversionFailed++;
      console.error(
        `  ✗ empty substrate [${a.id}] ${a.title ?? ""} — leaving untouched`
      );
      continue;
    }

    const oldText = a.source_text ?? "";
    const textChanged = newSubstrate !== oldText;
    const annotationCount = textChanged ? await countAnnotations(svc, a.id) : 0;
    const plan = planBackfill({
      hasFile,
      isDocx,
      oldText,
      newSubstrate,
      annotationCount,
    });
    if (plan.action !== "update") continue; // unreachable for docx, satisfies TS

    if (plan.annotationsAtRisk) atRisk.push({ id: a.id, title: a.title });

    const flag = plan.textChanged
      ? plan.annotationsAtRisk
        ? "⚠ text CHANGED, annotations exist"
        : "text changed (no annotations)"
      : "structure only (text identical)";
    console.log(`  ${apply ? "✓ updated" : "would update"} [${a.id}] ${a.title ?? ""} — ${flag}`);

    if (apply) {
      const { error: upErr } = await svc
        .from("assignments")
        .update({ source_html: newHtml, source_text: newSubstrate })
        .eq("id", a.id);
      if (upErr) {
        console.error(`  ✗ update failed [${a.id}]: ${upErr.message}`);
        continue;
      }
    }
    updated++;
  }

  console.log("\n— Summary —");
  console.log(`  ${apply ? "updated" : "would update"}: ${updated}`);
  console.log(`  skipped (no original file): ${skippedNoFile}`);
  console.log(`  skipped (not a .docx): ${skippedNotDocx}`);
  console.log(`  conversion failed: ${conversionFailed}`);

  if (atRisk.length > 0) {
    console.log(
      `\n⚠ ${atRisk.length} assignment(s) had their text change WITH existing annotations`
    );
    console.log("  (saved highlight offsets may have shifted — review these):");
    for (const r of atRisk) console.log(`  • [${r.id}] ${r.title ?? ""}`);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with `-- --apply` to write changes.");
  }
}

main().catch((e) => {
  console.error("✗ backfill failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
