/**
 * Supabase browser client — for Client Components only.
 *
 * @supabase/ssr's createBrowserClient already handles singleton behavior
 * and cookie-based session persistence. No manual localStorage wiring needed.
 */

import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

export function createBrowserClient() {
  return _createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
