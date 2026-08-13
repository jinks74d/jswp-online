/**
 * Building auth action links for emails WE send.
 *
 * The trap this exists to avoid: `admin.generateLink` returns a ready-made
 * `action_link`, and using it looks obviously correct. It isn't, for a
 * server-rendered app. That link points at Supabase's /auth/v1/verify, which
 * completes the implicit flow and redirects back with the tokens in a URL
 * HASH FRAGMENT:
 *
 *   /auth/callback?next=...#access_token=...&refresh_token=...&type=recovery
 *
 * Fragments are never transmitted to the server. A route handler sees a bare
 * URL, establishes no session, and the user lands on a page that can only
 * conclude the link was invalid or expired — which is exactly what it looked
 * like from the outside.
 *
 * The same response also carries `hashed_token`, which `verifyOtp` accepts
 * server-side. So we route our own link through /auth/confirm, verify there,
 * and set real cookies. This is Supabase's documented pattern for
 * custom-delivered auth email.
 *
 * Tested in __tests__/lib/auth-links.test.ts.
 */

/** OTP types we mint links for. Mirrors Supabase's EmailOtpType subset. */
export type AuthLinkType = "recovery" | "invite" | "signup" | "email_change";

export function isAuthLinkType(v: string | null): v is AuthLinkType {
  return (
    v === "recovery" || v === "invite" || v === "signup" || v === "email_change"
  );
}

/**
 * A link to our own /auth/confirm handler, which verifies the token and then
 * forwards to `next`.
 */
export function buildConfirmUrl(params: {
  siteUrl: string;
  hashedToken: string;
  type: AuthLinkType;
  /** Same-origin path to land on once the session exists. */
  next: string;
}): string {
  const q = new URLSearchParams({
    token_hash: params.hashedToken,
    type: params.type,
    next: params.next,
  });
  return `${params.siteUrl}/auth/confirm?${q.toString()}`;
}

/**
 * Only same-origin paths may be redirected to. `//evil.com` would otherwise be
 * read by the browser as protocol-relative and leave the site — and `next` is
 * attacker-supplied, since anyone can craft one of these URLs.
 */
export function safeNext(raw: string | null, fallback = "/login?confirmed=1"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}
