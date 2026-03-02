'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/database.types'
import { createUserSchema, updateUserSchema, type CreateUserData, type UpdateUserData } from '@/lib/validators/user'

// ========== TYPES ==========
type ActionResult<T> = {
  data: T
  error: null
} | {
  data: null
  error: { code: string; message: string }
}

// ========== LIST USERS ==========
export async function listUsers(): Promise<ActionResult<Profile[]>> {
  try {
    const supabase = await createClient()

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('listUsers error:', error)
      return { data: null, error: { code: 'SERVER_ERROR', message: 'Gagal mengambil data user' } }
    }

    return { data: profiles as Profile[], error: null }
  } catch (err) {
    console.error('listUsers exception:', err)
    return { data: null, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan server' } }
  }
}

// ========== CREATE USER ==========
export async function createUser(formData: CreateUserData): Promise<ActionResult<Profile>> {
  try {
    // Validate input
    const parsed = createUserSchema.safeParse(formData)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return { data: null, error: { code: 'VALIDATION_ERROR', message: firstError?.message || 'Data tidak valid' } }
    }

    const { full_name, email, password, role, phone, department } = parsed.data

    // Use service client to create auth user (requires admin privileges)
    const serviceClient = await createServiceClient()

    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
      },
    })

    if (authError) {
      console.error('createUser auth error:', authError)
      if (authError.message?.includes('already been registered')) {
        return { data: null, error: { code: 'DUPLICATE_EMAIL', message: 'Email sudah terdaftar' } }
      }
      return { data: null, error: { code: 'AUTH_ERROR', message: authError.message || 'Gagal membuat akun' } }
    }

    if (!authData.user) {
      return { data: null, error: { code: 'AUTH_ERROR', message: 'Gagal membuat akun user' } }
    }

    // Update profile with additional fields (phone, department) if provided
    // The trigger has already created the profile, so we update it
    if (phone || department) {
      const supabase = await createClient()
      await supabase
        .from('profiles')
        .update({
          phone: phone || null,
          department: department || null,
        })
        .eq('id', authData.user.id)
    }

    // Fetch the created profile
    const supabase = await createClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (profileError) {
      console.error('createUser profile fetch error:', profileError)
      return { data: null, error: { code: 'SERVER_ERROR', message: 'User dibuat tapi gagal mengambil profil' } }
    }

    return { data: profile as Profile, error: null }
  } catch (err) {
    console.error('createUser exception:', err)
    return { data: null, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan server' } }
  }
}

// ========== UPDATE USER ==========
export async function updateUser(userId: string, formData: UpdateUserData): Promise<ActionResult<Profile>> {
  try {
    // Validate input
    const parsed = updateUserSchema.safeParse(formData)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return { data: null, error: { code: 'VALIDATION_ERROR', message: firstError?.message || 'Data tidak valid' } }
    }

    const { full_name, role, phone, department, is_active } = parsed.data

    const supabase = await createClient()

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        full_name,
        role,
        phone: phone || null,
        department: department || null,
        is_active,
      })
      .eq('id', userId)
      .select('*')
      .single()

    if (error) {
      console.error('updateUser error:', error)
      return { data: null, error: { code: 'SERVER_ERROR', message: 'Gagal mengupdate user' } }
    }

    return { data: profile as Profile, error: null }
  } catch (err) {
    console.error('updateUser exception:', err)
    return { data: null, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan server' } }
  }
}

// ========== TOGGLE USER ACTIVE ==========
export async function toggleUserActive(userId: string, isActive: boolean): Promise<ActionResult<Profile>> {
  try {
    const supabase = await createClient()

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId)
      .select('*')
      .single()

    if (error) {
      console.error('toggleUserActive error:', error)
      return { data: null, error: { code: 'SERVER_ERROR', message: 'Gagal mengubah status user' } }
    }

    return { data: profile as Profile, error: null }
  } catch (err) {
    console.error('toggleUserActive exception:', err)
    return { data: null, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan server' } }
  }
}

// ========== DELETE USER ==========
export async function deleteUser(userId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    // Use service client to delete auth user (cascades to profile via FK)
    const serviceClient = await createServiceClient()

    const { error } = await serviceClient.auth.admin.deleteUser(userId)

    if (error) {
      console.error('deleteUser error:', error)
      return { data: null, error: { code: 'AUTH_ERROR', message: error.message || 'Gagal menghapus user' } }
    }

    return { data: { success: true }, error: null }
  } catch (err) {
    console.error('deleteUser exception:', err)
    return { data: null, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan server' } }
  }
}
