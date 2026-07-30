-- ---------------------------------------------------------------------------
-- 0047_district_logos_no_listing.sql
--
-- Drop `district_logos_public_read`, the broad SELECT policy on
-- storage.objects created in 0003. Supabase's database linter flags it: it
-- lets any client LIST every object in the public `district-logos` bucket, not
-- merely fetch one by URL.
--
-- APPLY THIS ONLY WITH (OR AFTER) THE ROUTE CHANGE THAT ACCOMPANIES IT.
-- Until then it breaks logos for every non-admin user. app/api/districts/
-- [districtId]/logo/route.ts used to `.download()` through the RLS-respecting
-- server client, which needs exactly this policy; it now redirects to
-- districts.logo_url and touches storage not at all. Super and district admins
-- would have kept working either way — they hold SELECT via the FOR ALL write
-- policies below — which is what would have made this a confusing bug report
-- rather than an obvious outage.
--
-- Why the policy cannot simply be narrowed: list() and download() are both
-- SELECT on storage.objects. No RLS predicate distinguishes "read this one
-- object" from "enumerate the bucket", so removing the listing capability
-- means removing the anonymous SELECT path entirely.
--
-- Public object URLs are unaffected. `district-logos` is public = TRUE, and
-- /storage/v1/object/public/... is served without consulting RLS. Anything
-- rendering that URL (see DISTRICT_LOGO_NAMING.urlPattern in
-- lib/district-branding.types.ts) keeps working.
--
-- Writes are unaffected: district_logos_super_admin_write and
-- district_logos_district_admin_write (both FOR ALL, both TO authenticated)
-- are left in place, so admins retain full manage rights including SELECT.
-- ---------------------------------------------------------------------------

BEGIN;

DROP POLICY IF EXISTS district_logos_public_read ON storage.objects;

COMMIT;
