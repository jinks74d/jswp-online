---
description: Show the next free migration number plus the last few shipped.
---

Run `ls migrations/ | sort` (or equivalent via Glob) and report:

- **Next free**: the lowest unused `00NN` after the highest currently-shipped numbered migration. Numbered migrations follow the `00NN_<descriptor>.sql` pattern; ignore the unnumbered legacy files left from `master`.
- **Last 4 shipped**: filename + one-line purpose from the file header comment.

Use this during chunk audits to flag migration-number conflicts vs the user's spec (e.g., spec says "0014" but 0014 was already used by a fix migration — happened on 6.2 → 6.3).

Concise output. Three or four lines total. No prelude.

$ARGUMENTS
