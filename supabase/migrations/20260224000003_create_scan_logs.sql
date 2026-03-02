-- Migration: Create scan_logs table
CREATE TABLE public.scan_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id        UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('scan_arrive','scan_depart','manual_arrive','manual_depart')),
  result          TEXT NOT NULL CHECK (result IN ('success','error','warning')),
  error_message   TEXT,
  scanned_by      UUID REFERENCES public.profiles(id),
  scan_duration_ms INTEGER,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scan_logs_visit ON public.scan_logs(visit_id);
CREATE INDEX idx_scan_logs_created ON public.scan_logs(created_at);
CREATE INDEX idx_scan_logs_scanned_by ON public.scan_logs(scanned_by);

-- Enable RLS
ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin & Receptionist can see all scan logs
CREATE POLICY "staff_select_scan_logs" ON public.scan_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','receptionist'))
  );

-- Host can see scan logs for their visits
CREATE POLICY "host_select_own_scan_logs" ON public.scan_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.visits v
      WHERE v.id = scan_logs.visit_id AND v.host_id = auth.uid()
    )
  );

-- Admin & Receptionist can insert scan logs
CREATE POLICY "staff_insert_scan_logs" ON public.scan_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','receptionist'))
  );
