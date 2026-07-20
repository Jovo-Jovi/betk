-- Phase 04 / T01-FIX — media bucket listing hardening.
-- Resolves advisor 0025 public_bucket_allows_listing on the `media` bucket. The
-- Phase 04 / T01 media_public_select policy (SELECT TO public USING bucket_id =
-- 'media') let the Data API list/read EVERY object in the bucket. Public-URL
-- serving does NOT depend on this RLS policy (public=true buckets serve object
-- URLs bypassing RLS) — that remains the app's read path and is unaffected.
-- Replace the broad public SELECT with an own-prefix SELECT mirroring the media
-- INSERT/UPDATE prefix rule, so authenticated clients can only enumerate their
-- own uploads via the Data API. docs-bucket policies untouched.
-- Additive/replacement: bucket stays public=true; no bucket, grant, or other
-- policy change.
DROP POLICY IF EXISTS "media_public_select" ON storage.objects;

CREATE POLICY "media_select_own_prefix" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
