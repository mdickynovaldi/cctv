-- Migration: Create visits table

-- Enable pgcrypto extension for gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name    TEXT NOT NULL,
  visitor_email   TEXT,
  visitor_phone   TEXT NOT NULL,
  purpose         TEXT NOT NULL,
  host_id         UUID REFERENCES public.profiles(id),
  qr_token        TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  status          TEXT NOT NULL DEFAULT 'registered'
                    CHECK (status IN ('registered','arrived','departed','canceled','no_show')),
  planned_date    DATE NOT NULL,
  planned_time    TIME,
  valid_from      TIMESTAMPTZ,
  valid_until     TIMESTAMPTZ,
  arrived_at      TIMESTAMPTZ,
  departed_at     TIMESTAMPTZ,
  notes           TEXT,
  registered_by   UUID REFERENCES public.profiles(id), -- NULL = self-register, set = walk-in by receptionist
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_visits_qr_token ON public.visits(qr_token);
CREATE INDEX idx_visits_status ON public.visits(status);
CREATE INDEX idx_visits_planned_date ON public.visits(planned_date);
CREATE INDEX idx_visits_host ON public.visits(host_id);
CREATE INDEX idx_visits_date_status ON public.visits(planned_date, status);
CREATE INDEX idx_visits_visitor_phone ON public.visits(visitor_phone);
CREATE INDEX idx_visits_visitor_name ON public.visits(visitor_name);

-- Enable RLS
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public (anon) can insert visits (self-registration)
CREATE POLICY "public_insert_visits" ON public.visits
  FOR INSERT TO anon
  WITH CHECK (TRUE);

-- Authenticated staff can insert (walk-in registration)
CREATE POLICY "staff_insert_visits" ON public.visits
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','receptionist'))
  );

-- Public can view own visit by qr_token (single row)
CREATE POLICY "public_select_own_visit" ON public.visits
  FOR SELECT TO anon
  USING (TRUE); -- Filtered in application by qr_token

-- Admin & Receptionist can see all visits
CREATE POLICY "staff_select_visits" ON public.visits
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','receptionist'))
  );

-- Host can see visits directed to them
CREATE POLICY "host_select_own_visits" ON public.visits
  FOR SELECT TO authenticated
  USING (
    host_id = auth.uid()
  );

-- Admin & Receptionist can update visits (status changes)
CREATE POLICY "staff_update_visits" ON public.visits
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','receptionist'))
  );

-- Admin can update all visits
CREATE POLICY "admin_update_all_visits" ON public.visits
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
