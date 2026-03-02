'use server'

import { createClient } from '@/lib/supabase/server'
import type { Visit, VisitWithHost, ScanLog } from '@/lib/database.types'
import { visitFormSchema, type VisitFormData } from '@/lib/validators/visit'

// Error codes
export type VmsError = {
  code: string
  message: string
}

const ERRORS: Record<string, VmsError> = {
  VISIT_NOT_FOUND: { code: 'VISIT_NOT_FOUND', message: 'Kunjungan tidak ditemukan' },
  VISIT_EXPIRED: { code: 'VISIT_EXPIRED', message: 'Kunjungan sudah melewati jadwal' },
  VISIT_ALREADY_DEPARTED: { code: 'VISIT_ALREADY_DEPARTED', message: 'Visitor sudah checkout' },
  VISIT_CANCELED: { code: 'VISIT_CANCELED', message: 'Kunjungan telah dibatalkan' },
  VISIT_NO_SHOW: { code: 'VISIT_NO_SHOW', message: 'Kunjungan expired (no-show)' },
  INVALID_TRANSITION: { code: 'INVALID_TRANSITION', message: 'Perubahan status tidak valid' },
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', message: 'Data tidak valid' },
  SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan server' },
}

type ActionResult<T> = { data: T; error: null } | { data: null; error: VmsError }

// ========== CREATE VISIT ==========
export async function createVisit(formData: VisitFormData): Promise<ActionResult<{ visit_id: string; qr_token: string }>> {
  try {
    const parsed = visitFormSchema.safeParse(formData)
    if (!parsed.success) {
      return { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('visits')
      .insert({
        visitor_name: parsed.data.visitor_name,
        visitor_email: parsed.data.visitor_email || null,
        visitor_phone: parsed.data.visitor_phone,
        purpose: parsed.data.purpose,
        host_id: parsed.data.host_id,
        planned_date: parsed.data.planned_date,
        planned_time: parsed.data.planned_time || null,
        notes: parsed.data.notes || null,
        status: 'registered',
      })
      .select('id, qr_token')
      .single()

    if (error) throw error
    return { data: { visit_id: data.id, qr_token: data.qr_token }, error: null }
  } catch (err) {
    console.error('createVisit error:', err)
    return { data: null, error: ERRORS.SERVER_ERROR }
  }
}

// ========== GET VISIT BY QR ==========
export async function getVisitByQR(qrToken: string): Promise<ActionResult<VisitWithHost>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('visits')
      .select('*, host:profiles!visits_host_id_fkey(id, full_name, department, email)')
      .eq('qr_token', qrToken)
      .single()

    if (error || !data) return { data: null, error: ERRORS.VISIT_NOT_FOUND }
    return { data: data as unknown as VisitWithHost, error: null }
  } catch (err) {
    console.error('getVisitByQR error:', err)
    return { data: null, error: ERRORS.SERVER_ERROR }
  }
}

// ========== PROCESS SCAN (markArrived or markDeparted depending on state) ==========
export async function processScan(
  qrToken: string
): Promise<ActionResult<{ visit: VisitWithHost; action: string }>> {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: { code: 'UNAUTHORIZED', message: 'Akses tidak diizinkan' } }

    // Get visit
    const { data: visit, error: fetchError } = await supabase
      .from('visits')
      .select('*, host:profiles!visits_host_id_fkey(id, full_name, department, email)')
      .eq('qr_token', qrToken)
      .single()

    if (fetchError || !visit) return { data: null, error: ERRORS.VISIT_NOT_FOUND }

    const startTime = Date.now()
    let newStatus: string
    let action: string

    // Determine action based on current status
    switch (visit.status) {
      case 'registered':
        newStatus = 'arrived'
        action = 'scan_arrive'
        break
      case 'arrived':
        newStatus = 'departed'
        action = 'scan_depart'
        break
      case 'departed':
        return { data: null, error: ERRORS.VISIT_ALREADY_DEPARTED }
      case 'canceled':
        return { data: null, error: ERRORS.VISIT_CANCELED }
      case 'no_show':
        return { data: null, error: ERRORS.VISIT_NO_SHOW }
      default:
        return { data: null, error: ERRORS.INVALID_TRANSITION }
    }

    // Update visit status
    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'arrived') updateData.arrived_at = new Date().toISOString()
    if (newStatus === 'departed') updateData.departed_at = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('visits')
      .update(updateData)
      .eq('id', visit.id)

    if (updateError) throw updateError

    // Log scan
    const scanDuration = Date.now() - startTime
    await supabase.from('scan_logs').insert({
      visit_id: visit.id,
      action: action as ScanLog['action'],
      result: 'success',
      scanned_by: user.id,
      scan_duration_ms: scanDuration,
      metadata: {},
    })

    // Return updated visit
    const { data: updatedVisit } = await supabase
      .from('visits')
      .select('*, host:profiles!visits_host_id_fkey(id, full_name, department, email)')
      .eq('id', visit.id)
      .single()

    return {
      data: {
        visit: updatedVisit as unknown as VisitWithHost,
        action: newStatus === 'arrived' ? 'Check-in berhasil' : 'Checkout berhasil',
      },
      error: null,
    }
  } catch (err) {
    console.error('processScan error:', err)
    return { data: null, error: ERRORS.SERVER_ERROR }
  }
}

// ========== MANUAL MARK (arrived/departed) ==========
export async function manualMark(
  visitId: string,
  action: 'arrive' | 'depart'
): Promise<ActionResult<VisitWithHost>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: { code: 'UNAUTHORIZED', message: 'Akses tidak diizinkan' } }

    const newStatus = action === 'arrive' ? 'arrived' : 'departed'
    const scanAction = action === 'arrive' ? 'manual_arrive' : 'manual_depart'
    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'arrived') updateData.arrived_at = new Date().toISOString()
    if (newStatus === 'departed') updateData.departed_at = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('visits')
      .update(updateData)
      .eq('id', visitId)

    if (updateError) throw updateError

    // Log
    await supabase.from('scan_logs').insert({
      visit_id: visitId,
      action: scanAction as ScanLog['action'],
      result: 'success',
      scanned_by: user.id,
      metadata: { method: 'manual' },
    })

    const { data: updatedVisit } = await supabase
      .from('visits')
      .select('*, host:profiles!visits_host_id_fkey(id, full_name, department, email)')
      .eq('id', visitId)
      .single()

    return { data: updatedVisit as unknown as VisitWithHost, error: null }
  } catch (err) {
    console.error('manualMark error:', err)
    return { data: null, error: ERRORS.SERVER_ERROR }
  }
}

// ========== LIST VISITS ==========
export async function listVisits(params: {
  date?: string
  status?: string
  host_id?: string
  search?: string
  page?: number
  limit?: number
}): Promise<ActionResult<{ visits: VisitWithHost[]; total: number }>> {
  try {
    const supabase = await createClient()
    const { date, status, host_id, search, page = 1, limit = 20 } = params
    const offset = (page - 1) * limit

    let query = supabase
      .from('visits')
      .select('*, host:profiles!visits_host_id_fkey(id, full_name, department, email)', { count: 'exact' })

    if (date) query = query.eq('planned_date', date)
    if (status) query = query.eq('status', status)
    if (host_id) query = query.eq('host_id', host_id)
    if (search) {
      query = query.or(`visitor_name.ilike.%${search}%,visitor_phone.ilike.%${search}%`)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return { data: { visits: (data || []) as unknown as VisitWithHost[], total: count || 0 }, error: null }
  } catch (err) {
    console.error('listVisits error:', err)
    return { data: null, error: ERRORS.SERVER_ERROR }
  }
}

// ========== SEARCH VISITORS (for manual fallback) ==========
export async function searchVisitors(query: string): Promise<ActionResult<VisitWithHost[]>> {
  try {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('visits')
      .select('*, host:profiles!visits_host_id_fkey(id, full_name, department, email)')
      .eq('planned_date', today)
      .or(`visitor_name.ilike.%${query}%,visitor_phone.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error
    return { data: (data || []) as unknown as VisitWithHost[], error: null }
  } catch (err) {
    console.error('searchVisitors error:', err)
    return { data: null, error: ERRORS.SERVER_ERROR }
  }
}

// ========== GET VISIT DETAIL ==========
export async function getVisitDetail(visitId: string): Promise<ActionResult<{ visit: VisitWithHost; scanLogs: ScanLog[] }>> {
  try {
    const supabase = await createClient()
    
    const [visitResult, logsResult] = await Promise.all([
      supabase
        .from('visits')
        .select('*, host:profiles!visits_host_id_fkey(id, full_name, department, email)')
        .eq('id', visitId)
        .single(),
      supabase
        .from('scan_logs')
        .select('*')
        .eq('visit_id', visitId)
        .order('created_at', { ascending: false }),
    ])

    if (visitResult.error || !visitResult.data) return { data: null, error: ERRORS.VISIT_NOT_FOUND }

    return {
      data: {
        visit: visitResult.data as unknown as VisitWithHost,
        scanLogs: (logsResult.data || []) as ScanLog[],
      },
      error: null,
    }
  } catch (err) {
    console.error('getVisitDetail error:', err)
    return { data: null, error: ERRORS.SERVER_ERROR }
  }
}

// ========== CANCEL VISIT ==========
export async function cancelVisit(visitId: string): Promise<ActionResult<Visit>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('visits')
      .update({ status: 'canceled' })
      .eq('id', visitId)
      .select()
      .single()

    if (error) throw error
    return { data: data as Visit, error: null }
  } catch (err) {
    console.error('cancelVisit error:', err)
    return { data: null, error: ERRORS.SERVER_ERROR }
  }
}

// ========== LIST HOSTS (public for form dropdown) ==========
export async function listHosts(): Promise<ActionResult<{ id: string; full_name: string; department: string | null }[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, department')
      .eq('role', 'host')
      .eq('is_active', true)
      .order('full_name')

    if (error) throw error
    return { data: data || [], error: null }
  } catch (err) {
    console.error('listHosts error:', err)
    return { data: null, error: ERRORS.SERVER_ERROR }
  }
}

// ========== DASHBOARD KPI ==========
export async function getDashboardKPI(date?: string): Promise<ActionResult<{
  registered: number
  arrived: number
  departed: number
  no_show: number
  canceled: number
  total: number
}>> {
  try {
    const supabase = await createClient()
    const targetDate = date || new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('visits')
      .select('status')
      .eq('planned_date', targetDate)

    if (error) throw error

    const kpi = {
      registered: 0,
      arrived: 0,
      departed: 0,
      no_show: 0,
      canceled: 0,
      total: data?.length || 0,
    }

    data?.forEach((v) => {
      if (v.status in kpi) {
        kpi[v.status as keyof typeof kpi]++
      }
    })

    return { data: kpi, error: null }
  } catch (err) {
    console.error('getDashboardKPI error:', err)
    return { data: null, error: ERRORS.SERVER_ERROR }
  }
}
