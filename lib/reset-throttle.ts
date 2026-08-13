/**
 * How often one address may be sent a password-reset email.
 *
 * Supabase rate-limited its own resetPasswordForEmail endpoint. Once we took
 * over delivery (minting links with the service role and sending via Resend),
 * that protection went with it: the forgot-password form became an unmetered
 * way to send mail to any registered address, which is a way to flood a
 * teacher's or a child's inbox.
 *
 * The clock is Supabase's own `recovery_sent_at`, stamped by
 * admin.generateLink — so this needs no table of our own and cannot drift out
 * of sync with the thing it is throttling.
 *
 * Tested in __tests__/lib/reset-throttle.test.ts.
 */

/**
 * Minimum gap between reset emails to the same address.
 *
 * Long enough to stop a flood, short enough that someone who genuinely lost
 * the first mail isn't stuck: recovery links last an hour, so a minute's wait
 * is a rounding error against that, and the UI's reply is identical either way
 * so a real user simply checks their inbox.
 */
export const RESET_EMAIL_MIN_INTERVAL_MS = 60_000;

/**
 * Whether a reset email may be sent now.
 *
 * `lastSentAt` is `recovery_sent_at` from the auth user, or null when none has
 * ever been sent. Unparseable input is treated as "never sent" rather than
 * blocking a legitimate reset — failing open on a throttle is the right side
 * to err on when the alternative is locking someone out of their account.
 */
export function canSendResetEmail(
  lastSentAt: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!lastSentAt) return true;
  const last = new Date(lastSentAt).getTime();
  if (Number.isNaN(last)) return true;
  // A stamp in the future means the clocks disagree (Postgres vs. the app).
  // Elapsed time would be negative and the throttle would hold the door shut
  // for as long as the skew lasted — potentially hours, with no way for the
  // user to do anything about it. Treat it as "no recent send".
  if (last > now) return true;
  return now - last >= RESET_EMAIL_MIN_INTERVAL_MS;
}
