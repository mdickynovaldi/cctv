'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData): Promise<{ error?: string; redirectTo?: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Email atau password salah' }
  }

  // Get user role to redirect appropriately
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Gagal mendapatkan data user' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as { role: string } | null)?.role || 'host'

  switch (role) {
    case 'admin':
      return { redirectTo: '/admin/dashboard' }
    case 'receptionist':
      return { redirectTo: '/receptionist/scanner' }
    case 'host':
      return { redirectTo: '/host/visitors' }
    default:
      return { redirectTo: '/' }
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getCurrentUser(): Promise<{
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  department: string | null
  is_active: boolean
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}
