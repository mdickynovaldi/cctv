-- Migration: Face Recognition Support
-- Creates visitor_faces table to store captured face images and descriptors

CREATE TABLE IF NOT EXISTS visitor_faces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL,
  image_path TEXT NOT NULL,
  angle TEXT NOT NULL CHECK (angle IN ('front', 'left', 'right', 'up')),
  descriptor FLOAT8[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by visit_id
CREATE INDEX IF NOT EXISTS idx_visitor_faces_visit_id ON visitor_faces(visit_id);

-- Index for lookup by name (for recognition)
CREATE INDEX IF NOT EXISTS idx_visitor_faces_visitor_name ON visitor_faces(visitor_name);

-- Enable RLS
ALTER TABLE visitor_faces ENABLE ROW LEVEL SECURITY;

-- Public can insert during visitor registration (anonymous)
CREATE POLICY "Anyone can insert face images" ON visitor_faces
  FOR INSERT WITH CHECK (true);

-- Only authenticated users (receptionist/admin) can read face images
CREATE POLICY "Authenticated users can read face images" ON visitor_faces
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only authenticated users can update (for storing descriptors)
CREATE POLICY "Authenticated users can update face descriptors" ON visitor_faces
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Storage bucket configuration (run manually in Supabase dashboard if CLI not configured)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('visitor-faces', 'visitor-faces', false) ON CONFLICT DO NOTHING;
