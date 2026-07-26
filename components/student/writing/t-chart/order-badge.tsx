/**
 * OrderBadge — the small numbered chip the printed T-Chart stamps on each
 * region (2024 Expository Guide p.79/103) to teach completion sequence.
 *
 * The number matters pedagogically because the student does *not* fill the
 * sheet top-to-bottom: the Revised Topic Sentence sits second from the top
 * but is written fourth, after the CDs and CM clouds it Pick-n-Stitches
 * from. Numbers come from getExpositoryTChartSpec().badges — never
 * hard-coded at the call site.
 *
 * Accessibility: the digit is decorative on its own, so it is aria-hidden
 * and a visually-hidden phrase carries the meaning ("Work order: 4 of 6").
 * Colour is inherited from the region's role ink, matched by the region's
 * shape glyph as the non-colour signal.
 *
 * Presentational only (no hooks) — safe in client and server components.
 */

export function OrderBadge({
  n,
  total,
  color,
}: {
  n: number;
  total: number;
  color: string;
}) {
  return (
    <span className="inline-flex items-baseline">
      <span
        aria-hidden="true"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[11px] font-bold leading-none"
        style={{ borderColor: color, color }}
      >
        {n}
      </span>
      <span className="sr-only">Work order: {n} of {total}</span>
    </span>
  );
}
