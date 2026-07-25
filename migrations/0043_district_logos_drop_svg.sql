-- ============================================================================
-- JSWP Online — Drop SVG uploads from the public district-logos bucket (0043)
-- ============================================================================
-- district-logos is a PUBLIC bucket (0003) and district admins can write to
-- their own path prefix. Allowing image/svg+xml there means a district admin
-- can upload a document containing <script>, which Supabase then serves
-- verbatim from the storage origin. DistrictLogo renders logos through a
-- plain <img>, not next/image, so the sandboxing CSP configured for the Next
-- image optimizer never applies to them.
--
-- Blast radius was limited — storage is a separate origin from the app, so
-- such a script could not touch app session cookies — but a public,
-- tenant-writable bucket serving active content is not worth keeping for a
-- logo upload. PNG/JPEG/WebP cover the use case.
--
-- Verified before writing this migration: district-logos held 0 objects, so
-- no existing logo is invalidated. allowed_mime_types is enforced on upload
-- only; it does not retroactively block reads of already-stored objects.
-- ============================================================================

BEGIN;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]
WHERE id = 'district-logos';

COMMIT;
