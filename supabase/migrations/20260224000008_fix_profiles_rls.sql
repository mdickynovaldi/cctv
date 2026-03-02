-- Fix RLS infinite recursion on profiles table
-- The issue: policies like admin_select_all_profiles query profiles table 
-- to check user role, which triggers the same RLS check, causing infinite recursion.

-- Drop existing problematic policies
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "receptionist_select_hosts" ON public.profiles;
DROP POLICY IF EXISTS "users_select_own" ON public.profiles;
DROP POLICY IF EXISTS "admin_insert_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "public_select_active_hosts" ON public.profiles;

-- Recreate policies using auth.jwt() to avoid infinite recursion
-- Users can always see their own profile (no recursion)
CREATE POLICY "users_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admin can see all profiles (check role from JWT, not from profiles table)
CREATE POLICY "admin_select_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Receptionist can see hosts only (check role from JWT)
CREATE POLICY "receptionist_select_hosts" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    ((auth.jwt() -> 'user_metadata' ->> 'role') = 'receptionist')
    AND role = 'host'
  );

-- Admin can insert profiles (check role from JWT)
CREATE POLICY "admin_insert_profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admin can update all, users can update own (check role from JWT)
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid() OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Public can read hosts (for visitor form dropdown) - using anon role
CREATE POLICY "public_select_active_hosts" ON public.profiles
  FOR SELECT TO anon
  USING (role = 'host' AND is_active = TRUE);
