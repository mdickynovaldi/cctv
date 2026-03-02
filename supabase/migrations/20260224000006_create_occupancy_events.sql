-- Migration: Create occupancy_events table (Phase 2 placeholder for YOLO integration)
CREATE TABLE public.occupancy_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL CHECK (event_type IN ('enter','exit','count')),
  count       INTEGER NOT NULL DEFAULT 0,
  source      TEXT NOT NULL DEFAULT 'yolo',
  camera_id   TEXT,
  confidence  FLOAT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_occupancy_events_created ON public.occupancy_events(created_at);
CREATE INDEX idx_occupancy_events_type ON public.occupancy_events(event_type);

-- Enable RLS
ALTER TABLE public.occupancy_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin read, service role insert
CREATE POLICY "admin_select_occupancy" ON public.occupancy_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Service role (API key) will bypass RLS for inserts from YOLO system
