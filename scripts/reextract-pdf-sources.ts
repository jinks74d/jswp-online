/**
 * reextract:pdf-sources — recompute assignment_sources.source_text for PDF
 * sources uploaded BEFORE margin stripping landed (see `marginMask` in
 * lib/pdf-text.ts).
 *
 * Why a re-extract: `source_text` is the annotation substrate, written once at
 * upload by buildPdfText(). Now that buildPdfText drops running heads, footers
 * and folios, the live render no longer reproduces the stored string, so
 * pdf-source-viewer's offset-invariant guard trips and every legacy PDF source
 * silently degrades to the flat viewer. Re-extracting from the original file in
 * the assignment-sources bucket restores the PDF-native view.
 *
 * ANNOTATION RISK — read before --apply. Stripping furniture shortens the
 * substrate, so character offsets after the first dropped item MOVE. Existing
 * text_annotations on a re-extracted source would then highlight the wrong
 * characters. This script therefore refuses to touch any source that already
 * has annotations unless --force is passed, and always reports the count first.
 * The safe sequence is: dry run → review the at-risk list → decide per source.
 *
 * Dry-run by default. Pass --apply to write. Idempotent: a source whose
 * re-extracted text already matches is left alone.
 *
 * Run: npm run reextract:pdf-sources                  (dry run, writes nothing)
 *      npm run reextract:pdf-sources -- --apply
 *      npm run reextract:pdf-sources -- --apply --force   (also rewrites
 *                                                          annotated sources)
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import {
  buildPdfText,
  marginMask,
  pageFromPdfJsItems,
  type PdfPage,
} from "../lib/pdf-text";

config({ path: ".env.local" });

const BUCKET = "assignment-sources";

interface SourceRow {
  id: string;
  assignment_id: string;
  source_title: string | null;
  source_text: string | null;
  source_file_path: string | null;
  source_file_name: string | null;
}

/**
 * Extract page items in Node. Deliberately NOT routed through lib/pdf-worker.ts
 * (that loader configures a browser Web Worker); here we disable the worker and
 * read the text layer only — no canvas, no rendering.
 */
async function extractPages(buffer: Buffer): Promise<PdfPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js still spins up a (fake, same-thread) worker in Node and refuses to
  // start without a workerSrc. Resolve the legacy worker from node_modules —
  // note tsx transpiles this file to CJS, so `import.meta.url` is unavailable
  // and the require base must come from cwd.
  const { createRequire } = await import("node:module");
  const { pathToFileURL } = await import("node:url");
  const requireFromCwd = createRequire(`${process.cwd()}/`);
  // Must be a file:// URL — the ESM loader rejects a bare Windows path
  // ("protocol 'c:'"), which a plain require.resolve() returns.
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    requireFromCwd.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    useSystemFonts: false,
  });
  const doc = await task.promise;

  const pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(pageFromPdfJsItems(content.items));
  }
  // In pdfjs-dist v6 destroy() lives on the loading task, not the document.
  await task.destroy();
  return pages;
}

/** The exact item strings the margin mask drops, for operator review. */
function droppedFurniture(pages: readonly PdfPage[]): string[] {
  const mask = marginMask(pages);
  const out: string[] = [];
  pages.forEach((p, pageIndex) => {
    p.items.forEach((it, i) => {
      if (!mask[pageIndex][i] && it.str.trim().length > 0) {
        out.push(`p${pageIndex + 1}: ${JSON.stringify(it.str)}`);
      }
    });
  });
  return out;
}

async function countAnnotations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
  sourceId: string
): Promise<number> {
  const { count } = await svc
    .from("text_annotations")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId);
  return count ?? 0;
}

/**
 * `source_render_mode = 'pdf'` is already authoritative — it is what makes the
 * app treat the substrate as PDF-extracted. A stored file name/path need not
 * carry a .pdf extension (storage keys are often extensionless), so the only
 * hard requirement is that there IS an original file to re-extract from.
 */
function reextractBlocker(s: SourceRow): string | null {
  if (!s.source_file_path) {
    return "no source_file_path — nothing to re-extract from (text was pasted, not uploaded)";
  }
  return null;
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
  const force = process.argv.includes("--force");
  const verbose = process.argv.includes("--verbose");
  const svc = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await svc
    .from("assignment_sources")
    .select(
      "id, assignment_id, source_title, source_text, source_file_path, source_file_name"
    )
    .eq("source_render_mode", "pdf");

  if (error) {
    console.error(`✗ Could not read assignment_sources: ${error.message}`);
    process.exit(1);
  }

  const rows = (data ?? []) as SourceRow[];
  console.log(
    `${apply ? "APPLY" : "DRY RUN"} — ${rows.length} PDF source(s) to consider` +
      `${force ? " (--force: annotated sources WILL be rewritten)" : ""}\n`
  );

  let updated = 0;
  let unchanged = 0;
  let skippedNoFile = 0;
  let extractionFailed = 0;
  const blocked: { id: string; title: string | null; annotations: number }[] = [];

  for (const s of rows) {
    const label = `[${s.id}] ${s.source_title ?? "(untitled)"}`;

    const blocker = reextractBlocker(s);
    if (blocker) {
      skippedNoFile++;
      console.log(`  – skipped ${label} — ${blocker}`);
      continue;
    }

    let newText: string;
    let furniture: string[] = [];
    let pageCount = 0;
    try {
      const { data: blob, error: dlErr } = await svc.storage
        .from(BUCKET)
        .download(s.source_file_path as string);
      if (dlErr || !blob) {
        throw new Error(dlErr?.message ?? "download returned no data");
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      const pages = await extractPages(buffer);
      pageCount = pages.length;
      newText = buildPdfText(pages).text;
      if (verbose) furniture = droppedFurniture(pages);
    } catch (e) {
      extractionFailed++;
      console.error(
        `  ✗ extract failed ${label}: ${e instanceof Error ? e.message : e}`
      );
      continue;
    }

    const oldText = s.source_text ?? "";
    if (newText === oldText) {
      unchanged++;
      continue;
    }

    if (newText.trim() === "") {
      extractionFailed++;
      console.error(`  ✗ empty substrate ${label} — leaving untouched`);
      continue;
    }

    const annotations = await countAnnotations(svc, s.id);
    const removed = oldText.length - newText.length;

    if (verbose) {
      console.log(
        `  ${label} — ${pageCount} page(s), ${furniture.length} item(s) identified as margin furniture` +
          `${furniture.length === 0 ? " (mask dropped nothing — any text change below comes from extraction drift, NOT margins)" : ":"}`
      );
      for (const f of furniture) console.log(`      ${f}`);
      // First point of divergence, so drift is diagnosable rather than guessed.
      let d = 0;
      while (d < oldText.length && d < newText.length && oldText[d] === newText[d]) d++;
      if (d < oldText.length || d < newText.length) {
        console.log(`      first divergence at char ${d}:`);
        console.log(`        stored: ${JSON.stringify(oldText.slice(d, d + 60))}`);
        console.log(`        fresh : ${JSON.stringify(newText.slice(d, d + 60))}`);
      }
    }

    if (annotations > 0 && !force) {
      blocked.push({ id: s.id, title: s.source_title, annotations });
      console.log(
        `  ⚠ SKIPPED ${label} — ${annotations} annotation(s) would be ` +
          `misaligned (${removed} chars of furniture). Re-run with --force to rewrite anyway.`
      );
      continue;
    }

    if (annotations > 0) {
      console.log(
        `  ⚠ rewriting ${label} — ${annotations} annotation(s) WILL need review`
      );
    }

    if (apply) {
      const { error: upErr } = await svc
        .from("assignment_sources")
        .update({ source_text: newText, updated_at: new Date().toISOString() })
        .eq("id", s.id);
      if (upErr) {
        extractionFailed++;
        console.error(`  ✗ update failed ${label}: ${upErr.message}`);
        continue;
      }
    }
    updated++;
    console.log(
      `  ${apply ? "✓ updated" : "would update"} ${label} — stripped ${removed} chars of margin furniture`
    );
  }

  console.log(
    `\n${apply ? "Updated" : "Would update"}: ${updated}` +
      `\nAlready correct: ${unchanged}` +
      `\nSkipped (no PDF file): ${skippedNoFile}` +
      `\nFailed: ${extractionFailed}` +
      `\nBlocked by existing annotations: ${blocked.length}`
  );

  if (blocked.length > 0) {
    console.log(
      `\nThese sources have student annotations and were left untouched.` +
        `\nThey stay on the flat viewer until re-extracted. Re-running with` +
        `\n--force rewrites the substrate and WILL shift their highlights:`
    );
    for (const b of blocked) {
      console.log(`  ${b.id}  ${b.title ?? "(untitled)"}  — ${b.annotations} annotation(s)`);
    }
  }

  if (!apply) console.log("\nDry run — nothing written. Re-run with --apply.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
