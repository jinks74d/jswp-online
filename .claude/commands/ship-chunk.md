---
description: Run the chunk-ship ritual: type-check, build, stage, commit, update memory, show chain.
---

The chunk is built and ready to commit. Ship it:

1. Run `npm run type-check`. Fail loud if any errors — don't proceed to commit.
2. Run `npm run build`. Fail loud if any errors.
3. `git status --short` to see what's staged/unstaged.
4. Stage ONLY the files belonging to this chunk. **Never `git add -A`** — there may be uncommitted side-quest work that shouldn't ride along (this conversation hit it three times). If unsure which files are in scope, ask the user before staging.
5. Draft a conventional commit:
   - Format: `feat(phase-N.X): <one-line goal>` (or `fix(scope): …` for fixes)
   - Body: short bullet list of substantive changes — schema/RLS notes, UI surfaces touched, RLS test count, any design trade-offs worth surfacing in future archaeology.
   - **For chunks that ship a migration**, include a "Migration inventory for chunk N.X" block listing every migration file shipped in this chunk. This is the lesson from 6.2 surfacing 0014 separately — make the inventory explicit at commit time so it's discoverable in `git log` later.
   - Co-author trailer per the global commit template: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
6. `git commit` with the message via HEREDOC (preserves multi-line formatting).
7. Update `~/.claude/projects/C--Users-Raymond-Jenkins-Desktop-CODE-jswp-online/memory/project_phase_status.md`:
   - Bump the "latest commit" hash at the top
   - Add this chunk's one-liner to the appropriate phase
   - Note migration apply state (NEEDS Supabase apply, or applied to live)
8. Show:
   - The new commit SHA
   - The unpushed chain (`git log origin/v2..HEAD --oneline`)
   - What the user needs to do next: apply migration N if applicable, run `npm run test:rls` and expected test count delta, walk the acceptance checklist.

Do NOT push automatically — wait for the user to say "push it".

$ARGUMENTS
