/**
 * RoleShapeLabel — the JSWP color/shape "role tag" that introduces a
 * sentence slot on the Shaping Sheet (chunk 4.5d-3, per
 * docs/reference/expository-organizer-specs.md → "Shaping Sheet 2+:1").
 *
 * In the printed guide each role is introduced by its colored shape —
 * the shape *is* the label: blue trapezoid TS, red rectangle CD, green
 * oval CM, blue (inverted) trapezoid CS. We render a compact shaped chip
 * holding the abbreviation, colored from the --jswp-color-* tokens
 * (never hard-coded hex — CLAUDE.md §14.10).
 *
 * Accessibility (CLAUDE.md §9): the shape is the non-color signal, and a
 * visually-hidden <span> carries the full role name for screen readers.
 * The decorative SVG/box is aria-hidden.
 *
 * Presentational only (no hooks) so it is safe to import into both
 * client and server components.
 */

export type ShapeRole = "ts" | "cd" | "cm" | "cs";

interface RoleSpec {
  readonly abbr: string;
  readonly full: string;
  readonly colorVar: string;
  readonly shape: "trapezoid" | "trapezoid_inverted" | "rectangle" | "ellipse";
}

const ROLE_SPECS: Record<ShapeRole, RoleSpec> = {
  ts: {
    abbr: "TS",
    full: "Topic Sentence",
    colorVar: "var(--jswp-color-ts)",
    shape: "trapezoid",
  },
  cd: {
    abbr: "CD",
    full: "Concrete Detail",
    colorVar: "var(--jswp-color-cd)",
    shape: "rectangle",
  },
  cm: {
    abbr: "CM",
    full: "Commentary",
    colorVar: "var(--jswp-color-cm)",
    shape: "ellipse",
  },
  cs: {
    abbr: "CS",
    full: "Concluding Sentence",
    colorVar: "var(--jswp-color-cs)",
    shape: "trapezoid_inverted",
  },
};

// Chip geometry. viewBox is shared; the abbreviation is centered.
const W = 72;
const H = 30;

function ShapeOutline({
  shape,
  color,
}: {
  shape: RoleSpec["shape"];
  color: string;
}) {
  const common = { fill: "white", stroke: color, strokeWidth: 2 } as const;
  switch (shape) {
    case "trapezoid":
      return (
        <polygon points={`2,${H - 2} 14,2 ${W - 14},2 ${W - 2},${H - 2}`} {...common} />
      );
    case "trapezoid_inverted":
      return (
        <polygon points={`14,${H - 2} 2,2 ${W - 2},2 ${W - 14},${H - 2}`} {...common} />
      );
    case "ellipse":
      return <ellipse cx={W / 2} cy={H / 2} rx={W / 2 - 2} ry={H / 2 - 2} {...common} />;
    case "rectangle":
    default:
      return <rect x={2} y={2} width={W - 4} height={H - 4} rx={2} {...common} />;
  }
}

export function RoleShapeLabel({ role }: { role: ShapeRole }) {
  const spec = ROLE_SPECS[role];
  return (
    <span className="inline-flex items-center" title={spec.full}>
      <span className="relative inline-block" style={{ width: W, height: H }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block"
          aria-hidden="true"
        >
          <ShapeOutline shape={spec.shape} color={spec.colorVar} />
          <text
            x={W / 2}
            y={H / 2}
            dominantBaseline="central"
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill={spec.colorVar}
          >
            {spec.abbr}
          </text>
        </svg>
      </span>
      <span className="sr-only">{spec.full}</span>
    </span>
  );
}
