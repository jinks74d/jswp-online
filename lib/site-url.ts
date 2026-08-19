/**
 * getSiteUrl — the absolute origin for links we mint into emails.
 *
 * Derived from the request Host header rather than an env var, because this
 * product is multi-tenant by subdomain: a reset link minted for a user on
 * lacoe.jswponline.com must come back to that host, not to whatever single
 * origin a NEXT_PUBLIC_SITE_URL would pin. Localhost gets http, everything
 * else https.
 *
 * Extracted from lib/actions/{auth,districts,signups}.ts, where it existed as
 * three byte-identical private copies. A fourth caller (the admin-initiated
 * password reset) was the point at which duplicating it again stopped being
 * defensible — three copies drift silently, and the failure mode here is an
 * email full of links pointing at the wrong host.
 *
 * SERVER ONLY — reads request headers.
 */

import "server-only";

import { headers } from "next/headers";

export async function getSiteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol =
    host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https";
  return `${protocol}://${host}`;
}
