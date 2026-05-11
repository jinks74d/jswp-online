---
description: Audit a chunk spec before building (6-section template).
---

The user has just pasted a chunk spec. Do the audit pass before writing any code. Produce these 6 sections, in order:

1. **Schema confirmation** — proposed DDL (table, indexes, RLS) or "no schema changes." Flag migration-number conflicts against `migrations/` (use the next free number; explicitly note if the spec listed a different number).

2. **RLS policy proposals** — full SQL for any new/changed policies. Use the `auth_user_*()` helper convention per `CLAUDE.md §7` + `§14.4`. Flag any helper cycles (lesson from 6.2's 0014 recursion fix: a policy on table A that subselects table B, paired with a policy on B that subselects A, will trip Postgres's static cycle check even if AND short-circuits at runtime).

3. **Refined file list** — table with LOC estimates, calibrated to the most recent chunk's actuals. Look up the actuals via `git log --oneline -10` + `git show --stat <commit>` on the latest `feat(phase-N.X)` commit. State which files are new vs modified. Default to a single chunk unless the spec is over ~1500 LOC.

4. **Product question resolutions** — answer each numbered question in the spec with rationale. Push back on the user's lean if a different option is clearly stronger (don't rubber-stamp). State your recommendation, then call out the trade-off.

5. **Edge cases the schema reveals** — concrete scenarios not covered by the spec. Likely sources: ON DELETE behavior, NULL columns, role mismatches, cross-tenant data leak paths, orphan rows, helper cycles.

6. **Should the chunk split** — yes/no with reasoning. Lean no for single-feature chunks under ~1500 LOC; lean yes if the schema change is large AND the UI surface is large AND they don't interlock.

End with: **"Approve and I'll build."** Wait for explicit approval before writing any code. Specifically wait for either "build it", "approved", or a re-paste of the chunk spec — silence or related-but-different messages don't count as approval.

$ARGUMENTS
