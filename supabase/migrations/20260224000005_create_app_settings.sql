-- Migration: Create app_settings table
CREATE TABLE public.app_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin & Receptionist can read settings
CREATE POLICY "staff_select_settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','receptionist'))
  );

-- Admin only can update settings
CREATE POLICY "admin_update_settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "admin_insert_settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Seed default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('office_hours', '{"open": "08:00", "close": "17:00"}'::jsonb),
  ('auto_no_show_hours', '"24"'::jsonb),
  ('data_retention_days', '"365"'::jsonb);
