-- Migration: Create visitor-faces Storage Bucket
-- Creates the storage bucket and storage policies for face images

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'visitor-faces',
  'visitor-faces',
  false,
  5242880,   -- 5MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anonymous uploads (during visitor registration)
CREATE POLICY "Anon can upload face images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'visitor-faces');

-- Authenticated users (receptionist/admin) can read face images
CREATE POLICY "Auth users can read face images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'visitor-faces' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete face images
CREATE POLICY "Auth users can delete face images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'visitor-faces' AND auth.role() = 'authenticated');
