/*
  # Create `uploads` Storage bucket

  1. Bucket
    - Public bucket `uploads` for product images, receipts, and payment proofs.
    - Accepts jpg, png, webp, gif (browsers may upload any image type).

  2. Policies
    - Authenticated users can upload and update their own files.
    - Public read so uploaded images can be rendered anywhere in the app.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public read uploads" ON storage.objects;
DROP POLICY IF EXISTS "auth upload uploads" ON storage.objects;
DROP POLICY IF EXISTS "auth update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "auth delete own uploads" ON storage.objects;

CREATE POLICY "public read uploads" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'uploads');

CREATE POLICY "auth upload uploads" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "auth update own uploads" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'uploads' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'uploads' AND owner = auth.uid());

CREATE POLICY "auth delete own uploads" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND owner = auth.uid());
