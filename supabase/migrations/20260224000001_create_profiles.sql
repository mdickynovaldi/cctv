-- Migration: Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'host' CHECK (role IN ('admin','receptionist','host')),
  department  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_active ON public.profiles(is_active);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin can see all profiles
CREATE POLICY "admin_select_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Receptionist can see hosts only
CREATE POLICY "receptionist_select_hosts" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'receptionist'))
    AND role = 'host'
  );

-- Users can see their own profile
CREATE POLICY "users_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admin can insert profiles
CREATE POLICY "admin_insert_profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Admin can update all, users can update own
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Public can read hosts (for visitor form dropdown) - using anon role
CREATE POLICY "public_select_active_hosts" ON public.profiles
  FOR SELECT TO anon
  USING (role = 'host' AND is_active = TRUE);
