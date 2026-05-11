/**
 * Shared exemplar content renderer (chunk 6.6a).
 *
 * Branches on content_format:
 *   - 'plain': preserves whitespace via a <pre>-like wrapper.
 *   - 'html':  trusts the DB-stored sanitized HTML and renders via
 *              dangerouslySetInnerHTML. Re-sanitization at render
 *              time isn't required — the action layer guarantees
 *              what's in the DB is safe — but the read path stays
 *              defensive by only accepting documented columns.
 *
 * Uses the .jswp-* class definitions in app/globals.css. Shape
 * symbols (::before content) provide a non-color signal per
 * CLAUDE.md §9.
 */

interface Props {
  content: string;
  format: "plain" | "html";
  /** Tailwind class string applied to the wrapper. Callers control
   * font / spacing / size; this component only chooses the
   * structural element + the JSWP class hookup. */
  className?: string;
}

export function ExemplarRender({ content, format, className }: Props) {
  if (format === "html") {
    return (
      <div
        className={`exemplar-content ${className ?? ""}`}
        // Content has been sanitized at save time by
        // sanitizeExemplarHtml. The DB column is the choke point.
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <pre
      className={`whitespace-pre-wrap font-sans leading-relaxed ${className ?? ""}`}
    >
      {content}
    </pre>
  );
}
