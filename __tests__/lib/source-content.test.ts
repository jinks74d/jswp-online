/**
 * Contract coverage for the structured-source substrate (Chunk 1).
 *
 * The annotation engine indexes character offsets into source_text. For rich
 * sources, source_text is DERIVED from the sanitized HTML via
 * sourceHtmlToSubstrate — so that projection MUST be the verbatim textContent
 * (no whitespace collapse, no injected newlines), or every saved annotation's
 * offsets would drift. These tests pin that contract.
 */

import { describe, it, expect, vi } from "vitest";

// lib/source-content is `import "server-only"`; stub it for the node/jsdom
// test runner (the real guard only matters in the client bundler).
vi.mock("server-only", () => ({}));

import { sanitizeSourceHtml, sourceHtmlToSubstrate } from "@/lib/source-content";

describe("sourceHtmlToSubstrate — annotation substrate contract", () => {
  it("returns verbatim textContent across block + inline elements", () => {
    const html =
      "<h2>Two Views</h2><p>Some <strong>students</strong> believe it.</p>";
    expect(sourceHtmlToSubstrate(html)).toBe(
      "Two ViewsSome students believe it."
    );
  });

  it("does NOT collapse internal whitespace (unlike htmlToPlainText)", () => {
    expect(sourceHtmlToSubstrate("<p>a   b</p>")).toBe("a   b");
  });

  it("injects no newlines between block elements", () => {
    expect(sourceHtmlToSubstrate("<ul><li>one</li><li>two</li></ul>")).toBe(
      "onetwo"
    );
  });

  it("matches a DOM textContent walk over the same HTML", () => {
    const html = "<h3>Heading</h3><p>Body text.</p>";
    const dom = document.createElement("div");
    dom.innerHTML = html;
    expect(sourceHtmlToSubstrate(html)).toBe(dom.textContent);
  });
});

describe("sanitizeSourceHtml — prose allowlist", () => {
  it("keeps allowed formatting tags + their text", () => {
    const out = sanitizeSourceHtml(
      "<h2>T</h2><p><strong>b</strong> <em>i</em> <u>u</u></p><ul><li>x</li></ul>"
    );
    for (const tag of ["<h2>", "<strong>", "<em>", "<u>", "<ul>", "<li>"]) {
      expect(out).toContain(tag);
    }
    expect(out).toContain("x");
  });

  it("strips scripts, event handlers, and class attributes", () => {
    const out = sanitizeSourceHtml(
      '<script>alert(1)</script><p onclick="x" class="y" style="color:red">hi</p>'
    );
    expect(out).not.toMatch(/script/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/class=/i);
    expect(out).not.toMatch(/style=/i);
    expect(out).toContain("hi");
  });

  it("derives a clean substrate from sanitized html (script text gone)", () => {
    const sanitized = sanitizeSourceHtml("<script>bad()</script><p>good</p>");
    expect(sourceHtmlToSubstrate(sanitized)).toBe("good");
  });
});
