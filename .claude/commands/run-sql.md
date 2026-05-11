---
description: Run a one-off SQL or service-role admin API call.
---

Execute the SQL or admin-API operation described in `$ARGUMENTS` via a short-lived script that uses the service role from `.env.local`. This is the same pattern we used for Raymond's password reset and Bill's class enrollment.

Steps:
1. **Confirm sensitivity first.** If the operation is a write (password reset, role change, data mutation, anything destructive), state what it will do and wait for explicit "go ahead" before running. SELECTs and read-only operations can run immediately.
2. Write a temp file at `scripts/_oneoff_<short-descriptor>.ts`:
   ```ts
   import { createClient } from "@supabase/supabase-js";
   import { config } from "dotenv";
   import { resolve } from "path";

   const env = config({ path: resolve(process.cwd(), ".env.local") }).parsed!;

   async function main() {
     const svc = createClient(
       env.NEXT_PUBLIC_SUPABASE_URL,
       env.SUPABASE_SERVICE_ROLE_KEY,
       { auth: { autoRefreshToken: false, persistSession: false } }
     );

     // … operation here …

     console.log("OK — <what happened>");
   }

   main().catch((e) => {
     console.error("FAIL:", e instanceof Error ? e.message : e);
     process.exit(1);
   });
   ```
3. `npx tsx scripts/_oneoff_<descriptor>.ts`
4. Report the result (OK / FAIL with error message).
5. Delete the temp file regardless of outcome (`rm scripts/_oneoff_<descriptor>.ts`).
6. Do NOT commit the temp file — these are throwaways.

For complex multi-step operations, the script can hold the full sequence; keep it self-contained so it's deletable after one run.

$ARGUMENTS
