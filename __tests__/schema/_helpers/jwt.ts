/**
 * Minimal JWT signing with Node's built-in crypto.
 * Used to impersonate Supabase users in RLS tests.
 */

import { createHmac } from "crypto";

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

/**
 * Sign a JWT payload with HS256. Returns a compact `header.payload.signature` string.
 */
export function signJwt(
  payload: Record<string, unknown>,
  secret: string
): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = base64url(
    createHmac("sha256", secret).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${signature}`;
}
