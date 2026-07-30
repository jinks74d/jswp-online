# GETTING_STARTED.md — How to Use This Bundle, Step by Step

Plain-English walkthrough of everything you need to do, in order, to take this rebuild bundle from "files in a zip" to "working app on a `v2` branch with Claude Code ready to take over."

If you've never done some of these steps before, that's fine — every step says exactly what to type, what to click, and what you should see when it works.

Estimated total time: **about 90 minutes** if nothing goes wrong, **2 hours** with normal hiccups.

---

## What you'll need open before you start

Open all of these in browser tabs or windows so you can flip between them:

1. **VS Code** with the `jswp-online` repo already cloned to your computer.
2. **GitHub** in a browser, signed in: `https://github.com/jinks74d/jswp-online`.
3. **Supabase** in a browser, signed in: `https://supabase.com/dashboard`.
4. **Vercel** in a browser, signed in: `https://vercel.com/dashboard`.
5. A **Terminal**:
   - Mac: open the Terminal app, or use VS Code's built-in terminal (`View → Terminal`).
   - Windows: PowerShell, or use VS Code's built-in terminal.

Have the rebuild zip file (`jswp-rebuild-bundle.zip`) downloaded to your computer. You'll know where it is — probably your Downloads folder.

---

## Part 1 — Get the files into your repo

This part: copy the rebuild files into your local repo and push them to a new GitHub branch called `v2`. About **15 minutes**.

### Step 1.1 — Open Terminal in VS Code

In VS Code, with the `jswp-online` folder open, press **`Ctrl+\``** (Windows) or **`Cmd+\``** (Mac). The backtick key. A terminal window opens at the bottom.

You should see a prompt that ends with something like `jswp-online %` or `jswp-online>`. That means you're inside your project folder.

### Step 1.2 — Make sure your local `master` is up to date

Type these two commands one at a time and press Enter after each:

```bash
git checkout master
git pull
```

What you should see: a message like `Already up to date.` or it'll list a few files that updated. If you see `error: Your local changes…` instead, you have uncommitted work — commit or stash it first, or ask Claude Code to help untangle it before you keep going.

### Step 1.3 — Create the `v2` branch

Type:

```bash
git checkout -b v2
```

What you should see: `Switched to a new branch 'v2'`.

This makes a new branch off `master`. Everything you do from here on lives in `v2`. Your `master` branch is untouched and stays as the legacy reference.

### Step 1.4 — Unzip the rebuild bundle into your repo

You have two ways to do this. Pick whichever feels easier.

**Way A — drag and drop in Finder/File Explorer:**

1. Open the `jswp-rebuild-bundle.zip` from your Downloads folder. Double-clicking should extract it on Mac. On Windows, right-click → "Extract All".
2. You now have a folder called `jswp-online` next to the zip. Open it.
3. You'll see four things inside: `CLAUDE.md`, `docs/`, `lib/`, `migrations/`. (Plus `GETTING_STARTED.md` — that's this file.)
4. Open another window showing your local `jswp-online` repo (where you've been running the `git` commands).
5. Drag `CLAUDE.md`, `GETTING_STARTED.md`, the `docs` folder, the `lib` folder, and the `migrations` folder from the unzipped bundle **into** your local repo folder.
6. If your repo already has a `lib/` or `migrations/` folder, the OS will ask you to merge or replace. **Choose merge** (or "Keep both" / "Apply to all") — we want the new files added alongside whatever's there.

**Way B — using the terminal:**

If you prefer to do it from the command line, replace `~/Downloads/jswp-online` with the actual path to the unzipped bundle on your computer:

```bash
# Mac/Linux:
cp -r ~/Downloads/jswp-online/* .
cp ~/Downloads/jswp-online/CLAUDE.md .
cp ~/Downloads/jswp-online/GETTING_STARTED.md .

# Windows PowerShell:
Copy-Item -Recurse "$env:USERPROFILE\Downloads\jswp-online\*" .
```

### Step 1.5 — Check that the files landed

In the VS Code terminal, type:

```bash
ls
```

(On Windows, `dir` does the same thing.)

You should see `CLAUDE.md` and `GETTING_STARTED.md` in the list, along with whatever was already there (`README.md`, `package.json`, etc.).

Then type:

```bash
ls migrations
```

You should see your new SQL files: `0001_init_jswp_schema.sql`, `0002_rls_policies.sql`, `0003_storage_buckets.sql`, `0004_seed.sql`. Plus all the legacy migration files that were already there. **That's expected** — we're keeping the legacy files for reference until we're ready to delete them later.

### Step 1.6 — Commit and push

Type these one at a time:

```bash
git add CLAUDE.md GETTING_STARTED.md docs/ lib/ migrations/0001_init_jswp_schema.sql migrations/0002_rls_policies.sql migrations/0003_storage_buckets.sql migrations/0004_seed.sql
```

```bash
git commit -m "chore(phase-1): rebuild scaffolding - schema, RLS, storage, seed, modes config"
```

```bash
git push -u origin v2
```

What you should see: a message ending with something like `* [new branch] v2 -> v2`. Now your branch is on GitHub.

### ✓ Section 1 done when

- [ ] Your VS Code terminal shows you're on branch `v2` (run `git status` — first line says `On branch v2`).
- [ ] `CLAUDE.md` and `GETTING_STARTED.md` are in your repo root.
- [ ] The four new SQL files are in `migrations/`.
- [ ] You can see the `v2` branch when you open `https://github.com/jinks74d/jswp-online/branches` in your browser.

---

## Part 2 — Make a new Supabase project

This part: create a fresh Supabase project that the rebuild will use, separate from your legacy one. About **10 minutes**.

### Step 2.1 — Open Supabase and click "New project"

1. Go to `https://supabase.com/dashboard`.
2. In the top-left, you'll see your organization name. The button to make a new project is on the right — it says "**New project**".
3. Click it.

### Step 2.2 — Fill in the project details

You'll see a form. Fill it in like this:

- **Name:** `jswp-online-v2` (anything works, but this is clear)
- **Database Password:** click the **Generate** button. **Important:** copy the password it shows you and paste it somewhere safe (a password manager, a sticky note in 1Password, whatever). You won't be able to see it again.
- **Region:** pick **East US (North Virginia)** or whichever is closest to most of your users. If your legacy project is somewhere specific, match it.
- **Pricing Plan:** Free is fine for now. You can upgrade later.

Click **Create new project**.

### Step 2.3 — Wait

Supabase will show a "Setting up project…" screen with a progress indicator. This takes 1-3 minutes. Don't close the tab.

When it's done, you'll land on the project's home page. You'll see a sidebar on the left with icons for Table Editor, SQL Editor, Authentication, Storage, etc.

### Step 2.4 — Copy your three keys

You need three things from this project. Get them now and paste each somewhere safe.

1. In the left sidebar, click the **Settings** icon (looks like a gear, near the bottom).
2. Click **API** in the settings menu.
3. You'll see a page with three boxes:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`. Copy it.
   - **`anon` `public`** key — a long string starting with `eyJ…`. Copy it.
   - **`service_role` `secret`** key — also starts with `eyJ…`. Click "Reveal" first, then copy.

Save them in a temporary text file — you'll paste them into Vercel and your local `.env.local` in a minute. Label them clearly:

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

⚠️ **The `service_role` key bypasses all security**. Never paste it into client code. Never commit it to git. Only use it server-side.

### ✓ Section 2 done when

- [ ] You have a new Supabase project named `jswp-online-v2`.
- [ ] You have the URL, anon key, and service_role key saved somewhere temporarily.
- [ ] The project's home page is open in your browser.

---

## Part 3 — Run the SQL migrations

This part: apply the four SQL files to your new Supabase project, in order. About **10 minutes**.

### Step 3.1 — Open the SQL Editor

In your new Supabase project, in the left sidebar, click the **SQL Editor** icon (looks like a stack of horizontal lines, or "SQL").

You'll see a code editor area with a `New query` button.

### Step 3.2 — Run `0001_init_jswp_schema.sql`

1. In VS Code, open the file `migrations/0001_init_jswp_schema.sql`.
2. Click anywhere in the file, then press **`Cmd+A`** (Mac) or **`Ctrl+A`** (Windows) to select all.
3. Press **`Cmd+C`** / **`Ctrl+C`** to copy.
4. Switch to your Supabase tab.
5. In the SQL Editor, click **`+ New query`** if you don't already have an empty one.
6. Click in the big code area and press **`Cmd+V`** / **`Ctrl+V`** to paste.
7. In the bottom-right, click the green **`Run`** button (or press `Cmd+Enter` / `Ctrl+Enter`).

What you should see: a green "Success. No rows returned" message at the bottom. If you see a red error message, copy it and ask Claude Code or me — don't try to fix it by hand without checking.

### Step 3.3 — Verify the tables exist

In the left sidebar, click the **Table Editor** icon (the one that looks like a grid).

You should see a long list of tables on the left:
- `assignments`
- `body_paragraphs`
- `candidate_cds`
- `chunks`
- `class_periods`
- ... and so on, about 25 in total.

If you see all those tables, the schema is in. If you only see a few or none, the SQL didn't fully run — click back to the SQL Editor and look at the output for an error message.

### Step 3.4 — Run `0002_rls_policies.sql`

Same process as Step 3.2, but with the second file:

1. In VS Code, open `migrations/0002_rls_policies.sql`.
2. Select all, copy.
3. In Supabase SQL Editor, click `+ New query`.
4. Paste, click Run.

What you should see: another "Success. No rows returned." message.

### Step 3.5 — Run `0003_storage_buckets.sql`

Same process with `migrations/0003_storage_buckets.sql`.

What you should see: "Success. No rows returned."

To verify: in the left sidebar, click the **Storage** icon. You should see two buckets listed:
- `district-logos`
- `assignment-sources`

### Step 3.6 — DO NOT run `0004_seed.sql` yet

The seed file inserts user profiles that reference auth users (`auth.users`) we haven't created yet. If you run it now, it'll fail with a foreign key error.

We'll come back to this in Part 4.

### ✓ Section 3 done when

- [ ] The Table Editor shows ~25 tables including `districts`, `schools`, `student_writings`, `body_paragraphs`, etc.
- [ ] The Storage page shows two buckets.
- [ ] You did NOT run `0004_seed.sql` yet.

---

## Part 4 — Create test user accounts

This part: make four test users (super admin, teacher, two students) so the seed data has something to attach to. About **15 minutes**.

### Step 4.1 — Open the Authentication area

In Supabase, click the **Authentication** icon in the left sidebar (looks like a person silhouette).

You'll see tabs: Users, Policies, Providers, etc. You're on Users by default.

### Step 4.2 — Add the super admin user

1. Click **Add user → Create new user** (top right).
2. Fill in:
   - **Email:** `super@demo.test`
   - **Password:** `SuperPassword123!` (or anything you'll remember)
   - **Auto Confirm User:** check this box. (Otherwise the user can't log in until they verify an email, which they can't because the address is fake.)
3. Click **Create user**.

You should see the user appear in the Users list. **Click on the user's row** — Supabase shows a panel with the user's details. Find the field labeled **User UID**. It looks like a long string with dashes, e.g. `7f3a8b2e-1c4d-4567-8901-234567890abc`.

**Copy this UID.** Paste it into a temp file labeled "super UID":

```
SUPER_UID=7f3a8b2e-1c4d-4567-8901-234567890abc
```

### Step 4.3 — Add the teacher user

Same process:

- **Email:** `teacher@demo.test`
- **Password:** `TeacherPassword123!`
- **Auto Confirm:** ✓

After creating, copy the User UID. Save as `TEACHER_UID`.

### Step 4.4 — Add the two student users

Same process for each:

**Student 1:**
- Email: `alex@demo.test`
- Password: `StudentPassword123!`
- Auto Confirm: ✓

**Student 2:**
- Email: `bailey@demo.test`
- Password: `StudentPassword123!`
- Auto Confirm: ✓

Save each UID as `ALEX_UID` and `BAILEY_UID`.

### Step 4.5 — Update the seed file with the real UIDs

Open `migrations/0004_seed.sql` in VS Code.

Find these placeholder UUIDs and replace them with the real ones you just collected:

| Placeholder in file | Replace with your |
|---|---|
| `00000000-0000-0000-0000-000000000100` | `SUPER_UID` |
| `00000000-0000-0000-0000-000000000200` | `TEACHER_UID` |
| `00000000-0000-0000-0000-000000000300` | `ALEX_UID` |
| `00000000-0000-0000-0000-000000000301` | `BAILEY_UID` |

VS Code makes this easy: press **`Cmd+H`** / **`Ctrl+H`** to open Find & Replace. Paste the placeholder in the top box and your real UID in the bottom box. Click "Replace All". Repeat for each.

Save the file (`Cmd+S` / `Ctrl+S`).

### Step 4.6 — Run the updated seed

1. In Supabase SQL Editor, click `+ New query`.
2. In VS Code, open the now-updated `migrations/0004_seed.sql`. Select all, copy.
3. Paste into Supabase SQL Editor.
4. Click Run.

What you should see: "Success. No rows returned."

### Step 4.7 — Verify the seed worked

Click **Table Editor** in the sidebar. Click the `districts` table. You should see one row: "Demo District."

Click `user_profiles`. You should see four rows: super, teacher, Alex, Bailey.

Click `assignments`. You should see four rows, one per writing mode.

### Step 4.8 — Commit the updated seed

Back in VS Code terminal:

```bash
git add migrations/0004_seed.sql
git commit -m "chore(phase-1): seed with real auth user UIDs"
git push
```

### ✓ Section 4 done when

- [ ] Supabase Authentication shows four users.
- [ ] `0004_seed.sql` has been updated with real UIDs and run successfully.
- [ ] Table Editor shows demo district, school, classes, four assignments.
- [ ] Updated seed is committed and pushed.

---

## Part 5 — Hook Vercel up to the new database

This part: tell Vercel about your new Supabase project so the `v2` branch can talk to it. About **10 minutes**.

### Step 5.1 — Open the Vercel project settings

1. Go to `https://vercel.com/dashboard`.
2. Click on your `jswp-online` project.
3. Click **Settings** in the top nav.
4. In the settings sidebar, click **Environment Variables**.

### Step 5.2 — Add the three Supabase keys

For each of the three keys, do this:

1. Click **Add New** (or the form at the top).
2. Fill in:
   - **Key:** the variable name (see below).
   - **Value:** paste the value from your temp file.
   - **Environment:** check **`Preview`** only. Uncheck Production. Uncheck Development.
3. Click **Save**.

Add these three:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |

⚠️ **Do not** check the Production box. Production env vars still point at the legacy Supabase project until cutover. We're isolating `v2` to Preview only.

### Step 5.3 — Add the same three keys to your local `.env.local`

In VS Code, look in your repo for a file called `.env.local`. If it doesn't exist, create it:

1. In VS Code, right-click the file tree on the left.
2. Click **New File**.
3. Name it `.env.local` (the leading dot is important — it tells git to ignore it, which is what we want).

Paste these into it:

```
NEXT_PUBLIC_SUPABASE_URL=your-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Replace `your-url-here` etc. with the real values.

Save the file.

### Step 5.4 — Trigger a Vercel preview deploy

Vercel deploys automatically when you push to a branch it knows about. You already pushed `v2` in Part 1, so Vercel may already be building it. Check:

1. In Vercel, click **Deployments** in the top nav.
2. Look for a deployment with the branch label `v2`.
3. If it's still building, wait. If it failed, click on it to see the error.
4. If it succeeded, click on the deployment to get the preview URL — something like `jswp-online-git-v2-jinks74d.vercel.app`.

Open that URL in a new tab. You should see your app running. It probably looks identical to the legacy app for now (we haven't changed any UI yet). The important thing is **it builds and loads without errors**.

If the build failed because of a missing env var or a bad key, double-check Step 5.2 and re-deploy by clicking **Redeploy** on the failed deployment.

### ✓ Section 5 done when

- [ ] Vercel Environment Variables shows three keys, all checked for `Preview` only.
- [ ] Your local `.env.local` has the same three keys.
- [ ] The Vercel preview deployment for the `v2` branch succeeded.
- [ ] You can open the preview URL in a browser and see your app.

---

## Part 6 — Open Claude Code and hand off

This part: open Claude Code inside VS Code, point it at `CLAUDE.md`, and give it the first task. About **10 minutes**.

### Step 6.1 — Make sure Claude Code is installed

If you haven't installed Claude Code yet:

1. Open a terminal.
2. Type:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
3. Wait for it to finish (about a minute).
4. Type:
   ```bash
   claude --version
   ```
   You should see a version number. If you see "command not found," your global npm path isn't set up — search "claude code install" on Anthropic's docs for the platform-specific fix.

### Step 6.2 — Start Claude Code in your project

1. In VS Code, make sure your terminal is open at the bottom and you're in the `jswp-online` folder.
2. Type:
   ```bash
   claude
   ```
3. The first time you run it, it'll ask you to log in. Follow the browser flow.

You should see Claude Code start up, with a prompt at the bottom of your terminal like `>`.

### Step 6.3 — Verify Claude Code can read CLAUDE.md

Type this exact prompt and press Enter:

```
Read CLAUDE.md from start to finish. Then tell me: what phase are we in, and what is the next concrete deliverable?
```

What you should see: Claude Code reads the file (you'll see it call its `view` tool on `CLAUDE.md`), then responds with something like:

> We're in Phase 1 — Schema & Type Layer. The schema, RLS policies, storage buckets, seed file, mode config, and database types are already drafted. The next concrete deliverables are:
>
> 1. `lib/jswp-grammar-rules.ts` — Dr. Louis's 15 Grammar Rules.
> 2. `lib/jswp-rubrics.ts` — TypeScript types for assignment rubrics, default rubric per mode.
> 3. `__tests__/schema/rls.test.ts` — RLS policy tests.
> 4. `scripts/seed-auth.ts` — Companion seed script for auth.users.
> 5. `docs/PROGRAM.md` — JSWP method synthesis (currently inline in CLAUDE.md Section 4).
> 6. `docs/ARCHITECTURE.md` — High-level system diagram.

If Claude Code says something different — like it doesn't know what phase we're in, or it suggests something that contradicts CLAUDE.md — stop and ask it to re-read the file. The brief is supposed to be the source of truth.

### Step 6.4 — Give Claude Code the first task

Once you've confirmed it understands the brief, type:

```
Let's start with lib/jswp-grammar-rules.ts. Before you write anything, look at where the 15 Grammar Rules are referenced in CLAUDE.md and the dev plan. Then ask me what content to use for each rule — do not invent content. I'll either give you the rule text from the printed guides or tell you to leave a TODO marker for that rule.
```

What you should see: Claude Code asks you for the content of each rule, one at a time or in batches. **Do not let it guess.** The grammar rules are pedagogical content from Dr. Louis — making up rules would be worse than leaving placeholders.

If you don't have the printed guides handy, you can tell Claude Code:

```
For now, leave each rule as { key, shortName: 'TBD', description: 'TBD', examples: { weak: 'TBD', strong: 'TBD' } }. We'll fill them in later when I get the printed guides.
```

That gets you a structurally correct file with content placeholders.

### Step 6.5 — Commit Claude Code's work

After Claude Code creates a file, you commit it. From the VS Code terminal:

```bash
git add lib/jswp-grammar-rules.ts
git commit -m "feat(phase-1): add jswp grammar rules scaffolding"
git push
```

### ✓ Section 6 done when

- [ ] Claude Code is installed and you can start it from the project folder.
- [ ] Claude Code correctly identifies which phase we're in after reading `CLAUDE.md`.
- [ ] You've given it the first task and confirmed it asks before inventing pedagogical content.

---

## Part 7 — Day-to-day workflow

How you'll work from here on. Memorize this rhythm.

### Starting a work session

1. Open VS Code in the `jswp-online` folder.
2. Open the terminal (`Ctrl/Cmd+\``).
3. Make sure you're on `v2`:
   ```bash
   git status
   ```
   First line should say `On branch v2`. If not, run `git checkout v2`.
4. Pull any changes:
   ```bash
   git pull
   ```
5. Start Claude Code:
   ```bash
   claude
   ```

### Asking Claude Code to do something

Be specific. Reference files. Reference sections of `CLAUDE.md` when relevant. For example:

❌ Vague: "Build the login page."

✅ Specific: "Following Phase 2 in `docs/DEV_PLAN.md`, build `app/(auth)/login/page.tsx`. Use the patterns in CLAUDE.md Section 6 for Supabase access. The page should have email + password fields, a 'Sign in with Google' button, and a 'Sign in with Microsoft' button. Use `lib/supabase/client.ts` (which you'll need to create — see CLAUDE.md Section 6 for the factory pattern)."

The more context you give, the better the output. Claude Code reads files you reference, so naming files in your prompt is faster than describing them.

### Before you commit

Always run these in order:

```bash
npm run lint:fix
npm run type-check
npm run test:run
npm run build
```

If any fails, fix it (or ask Claude Code to fix it) before committing.

### Committing

Use Conventional Commits style:

```bash
git add <specific files>
git commit -m "feat(phase-N): short description of what this does"
git push
```

Don't use `git add .` blindly — review each file. Vercel deploys to a preview URL automatically when you push.

### Checking the preview deploy

After every push, Vercel rebuilds. To check:

1. Go to `https://vercel.com/dashboard` → your project → **Deployments**.
2. Look for the most recent deployment for `v2`.
3. Click it. If it succeeded, click the preview URL.
4. If it failed, click "View Build Logs" to see the error.

### Ending a work session

```bash
git status              # check nothing's uncommitted
git push                # push any final commits
```

Close VS Code. You're done.

---

## If something breaks

### "I ran the SQL and got an error"

Copy the exact error message and paste it to Claude Code with:

> I ran `migrations/000X_xxx.sql` in the Supabase SQL Editor and got this error:
>
> ```
> [paste error here]
> ```
>
> What's wrong and how do I fix it?

### "Vercel build failed"

In Vercel, click the failed deployment → "View Build Logs". Look for red text. Copy it. Tell Claude Code:

> The Vercel build for `v2` failed with this error:
>
> ```
> [paste log section here]
> ```
>
> Look at the file it mentions and tell me what's wrong.

### "I see weird permission errors when I try to query the database"

That's almost always RLS. Either:
- You're not logged in (the Supabase client doesn't have a session).
- Your user doesn't have the right role for the table.
- The policy has a bug.

Ask Claude Code:

> I'm getting an RLS permission error trying to [whatever you're trying]. Read `migrations/0002_rls_policies.sql` and check the policies for the [table name] table. Compare with what I'm doing in [file]. What's blocking the access?

### "Claude Code did something I didn't want and committed it"

Don't panic. Branches and commits are reversible.

```bash
git log --oneline -5    # see the last 5 commits
git revert HEAD          # undo the most recent commit (creates a new "undo" commit)
git push
```

If you need to fully wipe out a commit (rare, only if it had secrets in it):

```bash
git reset --hard HEAD~1  # delete the last commit locally
git push --force         # overwrite the remote
```

⚠️ `--force` is dangerous if anyone else is working on the branch. Since you're solo right now, it's fine.

### "I lost my Supabase keys"

Go to Supabase → your project → **Settings → API**. The anon key is always shown. The service role key is shown when you click "Reveal." If you accidentally exposed the service role key publicly (e.g. committed it to git), regenerate it: same page, "Reset" button. Then update `.env.local` and Vercel env vars with the new key.

### "I committed `.env.local` by accident"

Run:

```bash
git rm --cached .env.local
git commit -m "chore: remove .env.local from tracking"
git push
```

Then immediately rotate your Supabase service role key (see above). Anyone who can see your repo's history can read the old key.

To prevent it next time, check that `.env.local` is in your `.gitignore`:

```bash
grep ".env.local" .gitignore
```

If it's not there, add it:

```bash
echo ".env.local" >> .gitignore
git add .gitignore
git commit -m "chore: ignore .env.local"
```

---

## Quick reference card

Print this part out or pin it to a sticky note.

**My new Supabase project:** `jswp-online-v2`
**My branch:** `v2`
**My preview URL:** check Vercel for the latest `v2` deployment

**Test user logins:**
- super@demo.test / SuperPassword123!
- teacher@demo.test / TeacherPassword123!
- alex@demo.test / StudentPassword123!
- bailey@demo.test / StudentPassword123!

**Daily commands:**
```
git checkout v2 && git pull        # start the day
claude                              # open Claude Code
npm run lint:fix && npm run type-check && npm run test:run && npm run build
git add … && git commit -m "…" && git push
```

**When stuck:** copy the error, paste to Claude Code, ask "what's wrong and how do I fix it?"

---

## You're done with setup

After Parts 1–6, your environment is ready. From here, you and Claude Code work through the phases in `docs/DEV_PLAN.md`. Phase 1 has a few small files left, then Phase 2 (auth and tenancy) is next.

Pace yourself. The plan estimates 8–13 weeks of focused work. That's normal for a rebuild of this size. The big rewards come in Phases 4 and 5 when the student writing flow and grading start working — that's when the app stops looking like the legacy and starts feeling like the printed guide.

Good luck.
