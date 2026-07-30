/**
 * Helpers for RLS-filtered writes.
 *
 * The trap: with the RLS-scoped client, an UPDATE or DELETE whose rows are
 * filtered out by a policy is NOT an error. Postgres reports success and zero
 * rows affected, so
 *
 *     const { error } = await supabase.from("schools").update({...}).eq("id", id);
 *     if (error) return { error: error.message };
 *     return { success: "Saved." };
 *
 * tells an out-of-scope admin "Saved." while nothing changed — and, in this
 * codebase, then writes an audit_log entry asserting a change that never
 * happened. That last part is the real damage: false entries in the
 * compliance log.
 *
 * The fix is to ask PostgREST for the affected rows (.select(...)) and treat
 * an empty result as a scope failure. These helpers keep that check uniform.
 *
 * Note this deliberately does NOT distinguish "blocked by RLS" from "row does
 * not exist" — the client must not be able to tell those apart, or the error
 * message becomes a cross-tenant existence oracle.
 */

const DEFAULT_MESSAGE =
  "Not found, or outside your scope. It may have been moved or deleted.";

/** Thrown by assertWrote() for actions whose convention is to throw. */
export class ScopeError extends Error {
  constructor(message: string = DEFAULT_MESSAGE) {
    super(message);
    this.name = "ScopeError";
  }
}

type WriteResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * For actions that return a form-state object. Returns an error string when
 * the write failed OR matched nothing; returns null when a row really changed.
 *
 *   const { data, error } = await supabase
 *     .from("schools").update({...}).eq("id", id).select("id");
 *   const failure = writeFailure({ data, error });
 *   if (failure) return { error: failure };
 */
export function writeFailure<T>(
  result: WriteResult<T>,
  message: string = DEFAULT_MESSAGE
): string | null {
  if (result.error) return result.error.message;
  if (!result.data || result.data.length === 0) return message;
  return null;
}

/**
 * For actions whose convention is to throw (void server actions, RSC paths).
 * Returns the affected rows so the caller can keep using them.
 */
export function assertWrote<T>(
  result: WriteResult<T>,
  message: string = DEFAULT_MESSAGE
): T[] {
  if (result.error) throw new Error(result.error.message);
  if (!result.data || result.data.length === 0) throw new ScopeError(message);
  return result.data;
}
