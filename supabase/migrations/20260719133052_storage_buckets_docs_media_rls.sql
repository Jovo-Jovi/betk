-- Phase 04 / T01 — Storage foundation for seller onboarding + store media.
-- Bucket NAMES settled with the human (docs / media); mirrored in .env.local +
-- .env.example and read via configs/env.ts (never hardcoded in code).
--
-- docs  = PRIVATE (public=false): national-ID photos (PII) + future private
--   uploads. Admin review = short-lived signed URLs (SECURITY_GUIDELINES RISK 5,
--   <=15 min), service-role side. No public read.
-- media = PUBLIC-read: store avatar/cover now, listing images (Phase 05) later.
--
-- MIME allow-list + size limits are CHOSEN DEFAULTS (SECURITY_GUIDELINES pins
-- only docs-private+signed-URLs / media-public; no numeric limits are specced).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('docs',  'docs',  false, 10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('media', 'media', true,   5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ── docs bucket RLS (own-prefix = first path folder equals the owner uid) ──
CREATE POLICY "docs_insert_own_prefix" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "docs_select_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'docs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR betk.is_admin())
  );
-- No UPDATE / DELETE policy on docs: resubmission (R-S08 / MW2) writes a NEW
-- object under the owner prefix instead of overwriting; retaining prior
-- documents is intentional, so default-deny on UPDATE/DELETE backs R-S08.

-- ── media bucket RLS ──
CREATE POLICY "media_public_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'media');
CREATE POLICY "media_insert_own_prefix" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "media_update_own_prefix" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
