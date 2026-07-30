/**
 * writeAuditLog — the single writer for the append-only privileged-action log.
 *
 * Why this exists: every one of the ~31 original call sites was written as
 *
 *     await createAdminClient().from("audit_log").insert({ ... });
 *
 * with the returned `error` discarded. That silently drops entries from a
 * compliance-relevant log — the one table where a missing row is the whole
 * problem — and it contradicts CLAUDE.md §6 ("log, throw, or return — never
 * silently ignore").
 *
 * Failure policy: this does NOT throw. The audit write happens after the
 * privileged action has already committed, and there is no transaction
 * spanning the two, so throwing here would report failure for an action that
 * actually succeeded — strictly worse than the status quo. Instead we fail
 * loudly to stderr, which reaches Vercel function logs today and Sentry once
 * Phase 7 lands. If audit durability ever needs to be guaranteed, the fix is
 * to move the write into the same transaction as the action (an RPC), not to
 * throw from here.
 *
 * Never log secrets: only the action name, actor, and the Postgres error are
 * emitted — never `metadata`, which can carry names and emails.
 *
 * SERVER ONLY — uses the service role key.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

export type AuditLogEntry = Database["public"]["Tables"]["audit_log"]["Insert"];

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const { error } = await createAdminClient().from("audit_log").insert(entry);

  if (error) {
    console.error("[audit_log] write failed — privileged action NOT recorded", {
      action: entry.action,
      actor_id: entry.actor_id,
      district_id: entry.district_id ?? null,
      school_id: entry.school_id ?? null,
      code: error.code,
      message: error.message,
    });
  }
}
