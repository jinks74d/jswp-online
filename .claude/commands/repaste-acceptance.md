---
description: Re-emit the most recent chunk's acceptance checklist.
---

Look up the most recent `feat(phase-N.X)` commit via `git log --oneline -5`. Re-emit the acceptance checklist for that chunk in the same format used when it was first published — checkbox list grouped by scenario, plain markdown.

Sourcing the checklist:

1. **First preference**: re-emit verbatim from the earlier conversation turn where the checklist was originally posted. Match the phrasing — don't rewrite.
2. **If not in conversation history**: read the chunk's commit message body for the goal, then derive a checklist from the acceptance items the user typically asks for (teacher path, student path, edge cases, RLS verification, multi-tenant block).
3. **If multiple recent chunks**: ask which one. Don't guess.

Output: just the checklist. Skip the prelude — assume the user knows what they're verifying. End with "Tell me **'N.X verified'** when complete."

$ARGUMENTS
