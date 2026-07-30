/**
 * Host → subdomain extraction for the multi-tenant `{district}.jswponline.com`
 * routing model.
 *
 * Lives in lib/ (not inline in middleware.ts) so the host-parsing rules are
 * unit-testable — this function decides which district a request belongs to,
 * and getting it wrong shows one district another's branding.
 *
 * Returns:
 *   string — the subdomain label to resolve against districts.subdomain
 *   null   — apex / www / unknown host: render default branding, no district
 */

/** Dev + preview hosts that auto-resolve to the seeded demo district. */
const DEMO_SUBDOMAIN = "demo";

/**
 * Normalize a raw Host header: lowercase, strip the port, strip a trailing
 * dot (a fully-qualified "jswponline.com." is legal and equivalent).
 *
 * IPv6 literal hosts ("[::1]:3000") are returned bracket-intact; they never
 * match a base domain and fall through to the apex path.
 */
export function normalizeHost(rawHost: string): string {
  const host = rawHost.trim().toLowerCase();
  // Strip port, but only past a closing bracket so IPv6 literals survive.
  const closingBracket = host.lastIndexOf("]");
  const colon = host.indexOf(":", closingBracket + 1);
  const withoutPort = colon === -1 ? host : host.slice(0, colon);
  return withoutPort.replace(/\.$/, "");
}

/**
 * Extract the district subdomain from a Host header.
 *
 * @param rawHost   the request's Host header
 * @param baseDomain  NEXT_PUBLIC_JSWP_BASE_DOMAIN, e.g. "jswponline.com".
 *                    When unset, only the dev/preview shortcuts apply.
 */
export function extractSubdomainFromHost(
  rawHost: string,
  baseDomain: string | undefined
): string | null {
  const host = normalizeHost(rawHost);

  // localhost is the dev convenience that auto-resolves to the demo district.
  // 127.0.0.1 deliberately does NOT — use it locally to exercise the
  // apex/no-district fallback path (default branding, no x-jswp-* headers).
  if (host === "localhost" || host.endsWith(".localhost")) {
    return DEMO_SUBDOMAIN;
  }
  if (host.endsWith(".vercel.app")) {
    return DEMO_SUBDOMAIN;
  }

  if (!baseDomain) return null;
  const base = normalizeHost(baseDomain);

  // Exact apex.
  if (host === base) return null;

  // Suffix match must be on a label boundary. A bare endsWith() would treat
  // "notjswponline.com" as subdomain "not" — a lookalike domain pointed at us
  // could then impersonate a district. Require the separating dot.
  if (!host.endsWith(`.${base}`)) return null;

  const prefix = host.slice(0, -(base.length + 1));

  if (prefix === "" || prefix === "www") return null;

  // Multi-level hosts ("a.b.jswponline.com") are not a tenant address. Reject
  // rather than resolving the compound string, which could never match a
  // districts.subdomain row anyway.
  if (prefix.includes(".")) return null;

  // Must be a legal DNS label — mirrors the SUBDOMAIN_RE used when a super
  // admin creates a district, so anything storable is resolvable and nothing
  // else gets as far as a database lookup.
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(prefix)) return null;

  return prefix;
}
