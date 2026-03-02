-- Seed data for local development
-- Note: In local development, users must be created via Supabase Auth first,
-- then their profiles are auto-created via the handle_new_user trigger.
-- This seed inserts sample visits for testing purposes.

-- Sample visits (assuming profiles exist from auth signup)
-- These use placeholder host_id that should be updated after local auth users are created

-- Insert sample app_settings if not exists
INSERT INTO public.app_settings (key, value)
VALUES
  ('office_hours', '{"open": "08:00", "close": "17:00"}'::jsonb),
  ('auto_no_show_hours', '"24"'::jsonb),
  ('data_retention_days', '"365"'::jsonb)
ON CONFLICT (key) DO NOTHING;
