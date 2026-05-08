/**
 * Supabase admin client — uses the service role key to bypass RLS.
 *
 * USE ONLY in:
 *   - middleware.ts (subdomain → district lookup before auth context exists)
 *   - scripts/ (seed-auth.ts, migrations, etc.)
 *   - server-side admin operations that explicitly need to bypass RLS
 *
 * NEVER use in:
 *   - Server Components or Route Handlers that serve user requests directly
 *     (use lib/supabase/server.ts instead — it respects RLS)
 *   - Client Components (the service role key must never reach the browser)
 *
 * The service role key is read from SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_
 * prefix) so it is never bundled into client code.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
