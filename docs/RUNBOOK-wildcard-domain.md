# Runbook — wildcard domain for `{district}.jswponline.com`

Status as of 2026-07-30: **code ready, infrastructure not provisioned.**

The app has resolved `subdomain → district` since Phase 2 (`middleware.ts`), but
the resolution never fires in production because no custom domain is attached to
the Vercel project and `NEXT_PUBLIC_JSWP_BASE_DOMAIN` was unset. This runbook is
the remaining infrastructure work, which needs registrar and Vercel account
access.

---

## Current state

| Thing | State |
|---|---|
| Vercel project | `jswp-online` (`prj_esgP9UauyRRTivSQyM0lmjpwYCHz`), team `jinks74ds-projects` |
| Domains on project | `jswp-online-jinks74ds-projects.vercel.app` and the `git-master` alias — **no custom domain** |
| `jswponline.com` | Registered (not available for purchase). Registrar/owner not yet confirmed in this repo. |
| `NEXT_PUBLIC_JSWP_BASE_DOMAIN` | Set in `.env.local`. **Not yet set in Vercel.** |
| Host parsing | `lib/subdomain.ts`, unit-tested in `__tests__/lib/subdomain.test.ts` |

---

## Steps

### 1. Confirm ownership of `jswponline.com`

It resolves as registered, but this repo has no record of which account holds
it. Confirm before anything else — if it sits with Louis Educational Concepts
rather than Farside, adding it to Vercel needs their DNS cooperation.

### 2. Check the Vercel plan

**Wildcard domains require Pro or Enterprise.** On Hobby, `*.jswponline.com`
will be rejected at the add-domain step. Verify the team plan first; this is the
most common place this task stalls.

### 3. Add both domains to the project

In Vercel → project `jswp-online` → Settings → Domains, add:

- `jswponline.com` — the apex, serves the no-district fallback
- `*.jswponline.com` — the wildcard, serves every district

Add both. The wildcard does **not** cover the apex.

### 4. Point DNS at Vercel

At the registrar, either delegate the whole zone to Vercel's nameservers
(simplest, and required if the apex is also served here), or add records:

```
A      @   76.76.21.21
CNAME  *   cname.vercel-dns.com
```

Verify with:

```bash
nslookup lacoe.jswponline.com
nslookup nonexistent-district.jswponline.com   # must also resolve — wildcard
```

Both must resolve. The second one resolving is the point: the app, not DNS,
decides that an unknown subdomain redirects to the apex
(`middleware.ts`, unknown-subdomain branch).

### 4b. Add the Resend sending records (same zone, same sitting)

Transactional email (district POC invites, signup approve/deny) sends through
Resend, and the sender must be on a **verified** Resend domain. The fallback
`onboarding@resend.dev` only delivers to the Resend account owner — every other
recipient gets a 403, which is how this was found on 2026-07-30.

`mail.jswponline.com` is registered in Resend
(`d94693c0-08f5-4cb8-a224-063e2217d34f`). Add these to the `jswponline.com`
zone; names are relative to it.

| Type | Name | Value | Priority |
|---|---|---|---|
| TXT | `resend._domainkey.mail` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCtRfmyYgDpZlITZEaVBSbjnNtPwYaejmokoJFOwS75zbbvsBPz7HB+gYBAnjvUAT42Pa8u7rLO2AHpVubeo0qAiInEZ9DfOrLy6FMH375f6G/nXLRVPVG917LZ6VJCJEzxVY4vdBEAO0cGl88jVUAWmHvnKw4UvqgHwP7aWwB4FwIDAQAB` | — |
| MX | `send.mail` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | — |

These coexist with the wildcard from step 4: a wildcard is only synthesized for
names that don't otherwise exist in the zone, and `send.mail` will have explicit
records. `mail.jswponline.com` itself needs no A record.

Then hit Verify in Resend, and set the sender:

```
EMAIL_FROM="JSWP Online <no-reply@mail.jswponline.com>"
```

`.env.local` already has it. **It must also be set in Vercel** — without it
production silently falls back to the sandbox sender and only mail to the
account owner is delivered.

### 5. Set the env var in Vercel

```
NEXT_PUBLIC_JSWP_BASE_DOMAIN=jswponline.com
```

Set it for **Production and Preview**. It is `NEXT_PUBLIC_`, so it is inlined at
build time — a redeploy is required after adding it, not just a restart.

Note the preview interaction: `*.vercel.app` hosts short-circuit to the `demo`
district regardless of this variable (`lib/subdomain.ts`), so preview deploys
keep working unchanged.

### 6. Add the wildcard to Supabase's redirect allowlist

**This one silently breaks auth if skipped.** Supabase Auth rejects any
`redirectTo` not on its allowlist, and every auth flow here derives its redirect
from the request host (`getSiteUrl()` in `lib/actions/auth.ts`) — so on
`lacoe.jswponline.com`, password reset and email confirmation will both fail
until the wildcard is allowed.

Supabase dashboard → Authentication → URL Configuration → Redirect URLs:

```
https://jswponline.com/**
https://*.jswponline.com/**
```

Leave the existing localhost and `*.vercel.app` entries in place.

### 7. Seed a real district to test with

The `demo` district exists from `migrations/0004_seed.sql`. Either point a test
subdomain at it or create a district through `/admin/districts` with a known
subdomain, then visit `https://<that>.jswponline.com`.

---

## Verification

| Check | Expected |
|---|---|
| `https://jswponline.com` | Loads, default branding, no `x-jswp-*` headers |
| `https://www.jswponline.com` | Same as apex (treated as no-district) |
| `https://<real>.jswponline.com` | District name, logo, and colors applied |
| `https://<garbage>.jswponline.com` | 307 redirect to the apex |
| Password reset from a district subdomain | Email link returns to that same subdomain |
| Log in on district A's subdomain, open district B's | See notes below |

---

## Known follow-ups this does not fix

Deliberately out of scope here; tracked separately.

1. **Sessions are host-scoped, and nothing pins a user to their own tenant.**
   `lib/supabase/middleware.ts` sets no cookie `domain`, so a session on
   `lacoe.jswponline.com` does not carry to `dallas.jswponline.com` — good for
   isolation, and it means a cross-district visit lands on the login page rather
   than a mismatched dashboard. But `requireRole()` (`lib/auth.ts`) still checks
   role only. If cookies are ever widened to `.jswponline.com`, a logged-in
   teacher could load another district's subdomain and see its branding over
   their own data. `canAccessDistrict()` exists at `lib/auth.ts:126` and is
   currently called nowhere — it was written for this.

2. **POC invite links ignore the district's subdomain.** `getSiteUrl()` in
   `lib/actions/districts.ts` derives the URL from the *super admin's* current
   host, so invites point at wherever the admin happened to be rather than at
   the new district's branded subdomain.

3. **No apex marketing page decision.** `jswponline.com` currently serves the
   app shell with default branding. Whether the apex should instead redirect to
   `janeschaffer.com`, or serve a district picker, is an open product question.
