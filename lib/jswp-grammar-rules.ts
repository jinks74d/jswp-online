/**
 * Dr. Louis's 15 Rules for Improved Grammar
 * ─────────────────────────────────────────────────────────────────────────
 * Applied during the Shaping Sheet step. Rule keys are stored in
 * `shaping_sheets.rules_applied[]` (see migrations/0001_init_jswp_schema.sql).
 *
 * Source pages:
 *   - 2024 Expository Guide pp. 36-72
 *   - 2019 Argumentation Guide pp. 22-72
 *   - 2018 Personal & Fictional Narrative Guide pp. 26-110
 *   - Response to Literature Quick Start Guide v4
 *
 * Content TBD — to be filled in from the printed guides.
 */

import type { GroupOrigin } from "./jswp-modes";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface GrammarRuleExamples {
  readonly weak: string;
  readonly strong: string;
}

export interface GrammarRule {
  /** Stable key stored in the database, e.g. "rule_01". */
  readonly key: string;
  /** Short display name shown in the UI. */
  readonly shortName: string;
  /** One-sentence description of the rule. */
  readonly description: string;
  /** Before/after examples. */
  readonly examples: GrammarRuleExamples;
  /** Step group origins where this rule surfaces in the UI. */
  readonly appliesAt: readonly GroupOrigin[];
}

/* ─── Rules ───────────────────────────────────────────────────────────── */

// TODO: Fill in shortName, description, and examples from the printed guides.
// Do not invent pedagogical content — use the exact language from the guides.

export const GRAMMAR_RULES: readonly GrammarRule[] = [
  {
    key: "rule_01",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_02",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_03",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_04",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_05",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_06",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_07",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_08",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_09",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_10",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_11",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_12",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_13",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_14",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
  {
    key: "rule_15",
    shortName: "TBD",
    description: "TBD",
    examples: { weak: "TBD", strong: "TBD" },
    appliesAt: ["shaping_sheet"],
  },
] as const;

/* ─── Helpers ─────────────────────────────────────────────────────────── */

/** Look up a rule by its key (e.g. "rule_03"). */
export function getGrammarRule(key: string): GrammarRule | undefined {
  return GRAMMAR_RULES.find((r) => r.key === key);
}

/** Return all rules that apply at a given step group origin. */
export function getRulesForStep(groupOrigin: GroupOrigin): readonly GrammarRule[] {
  return GRAMMAR_RULES.filter((r) => r.appliesAt.includes(groupOrigin));
}

/** Validate that an array of rule keys are all recognized. */
export function validateRuleKeys(keys: readonly string[]): {
  valid: readonly string[];
  invalid: readonly string[];
} {
  const allKeys = new Set(GRAMMAR_RULES.map((r) => r.key));
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const k of keys) {
    if (allKeys.has(k)) {
      valid.push(k);
    } else {
      invalid.push(k);
    }
  }
  return { valid, invalid };
}
