'use server'

import { createClient } from '@/lib/supabase/server'

export type FaceImageInput = {
  angle: 'front' | 'left' | 'right' | 'up'
  base64: string // data:image/jpeg;base64,...
  descriptor?: number[] // Array of 128 floats from face-api.js
}

export type FaceRecord = {
  id: string
  visit_id: string
  visitor_name: string
  image_path: string
  angle: string
  descriptor: number[] | null
}

type ActionResult<T> = { data: T; error: null } | { data: null; error: { message: string } }

// ========== SAVE FACE IMAGES ==========
export async function saveFaceImages(
  visitId: string,
  visitorName: string,
  images: FaceImageInput[]
): Promise<ActionResult<{ saved: number }>> {
  try {
    const supabase = await createClient()

    const insertRows: { visit_id: string; visitor_name: string; image_path: string; angle: string; descriptor: number[] | null }[] = []

    for (const img of images) {
      // Convert base64 to buffer
      const base64Data = img.base64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const filename = `${visitId}/${img.angle}_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('visitor-faces')
        .upload(filename, buffer, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        continue
      }

      insertRows.push({
        visit_id: visitId,
        visitor_name: visitorName,
        image_path: filename,
        angle: img.angle,
        descriptor: img.descriptor || null,
      })
    }

    if (insertRows.length > 0) {
      const { error: insertError } = await supabase.from('visitor_faces').insert(insertRows)
      if (insertError) throw insertError
    }

    return { data: { saved: insertRows.length }, error: null }
  } catch (err) {
    console.error('saveFaceImages error:', err)
    return { data: null, error: { message: 'Gagal menyimpan foto wajah' } }
  }
}

// ========== GET TODAY'S FACE RECORDS (for recognition) ==========
export async function getTodayFaceRecords(): Promise<ActionResult<FaceRecord[]>> {
  try {
    const supabase = await createClient()

    // Use WIB timezone (UTC+7) for today's date boundary
    const now = new Date()
    const wibOffset = 7 * 60 * 60 * 1000
    const wibNow = new Date(now.getTime() + wibOffset)
    const todayWib = wibNow.toISOString().split('T')[0]  // e.g. "2026-03-02"

    // Filter by created_at within today (UTC) - visitor_faces are created when user registers
    // We go from midnight WIB (= 17:00 UTC previous day) to current time
    const startOfDayWib = new Date(`${todayWib}T00:00:00+07:00`).toISOString()
    const endOfDayWib   = new Date(`${todayWib}T23:59:59+07:00`).toISOString()

    const { data, error } = await supabase
      .from('visitor_faces')
      .select('id, visit_id, visitor_name, image_path, angle, descriptor')
      .gte('created_at', startOfDayWib)
      .lte('created_at', endOfDayWib)
      .limit(500)

    if (error) {
      console.error('getTodayFaceRecords DB error:', error)
      throw error
    }
    console.log(`getTodayFaceRecords: found ${data?.length ?? 0} records for ${todayWib}`)
    return { data: (data || []) as FaceRecord[], error: null }
  } catch (err) {
    console.error('getTodayFaceRecords error:', err)
    return { data: null, error: { message: 'Gagal mengambil data wajah' } }
  }
}

// ========== GET SIGNED URL FOR FACE IMAGE ==========
export async function getFaceImageUrl(imagePath: string): Promise<ActionResult<string>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.storage
      .from('visitor-faces')
      .createSignedUrl(imagePath, 3600) // 1 hour

    if (error) throw error
    return { data: data.signedUrl, error: null }
  } catch (err) {
    console.error('getFaceImageUrl error:', err)
    return { data: null, error: { message: 'Gagal mendapatkan URL gambar' } }
  }
}

// ========== GET SIGNED URLS FOR MULTIPLE FACE IMAGES ==========
export async function getFaceImageUrls(visitId: string): Promise<ActionResult<{ path: string; url: string; angle: string }[]>> {
  try {
    const supabase = await createClient()

    // Get all face records for this visit
    const { data: records, error: dbError } = await supabase
      .from('visitor_faces')
      .select('image_path, angle')
      .eq('visit_id', visitId)

    if (dbError) throw dbError
    if (!records || records.length === 0) return { data: [], error: null }

    const results: { path: string; url: string; angle: string }[] = []
    for (const record of records) {
      const { data: urlData } = await supabase.storage
        .from('visitor-faces')
        .createSignedUrl(record.image_path, 3600)
      if (urlData) {
        results.push({ path: record.image_path, url: urlData.signedUrl, angle: record.angle })
      }
    }

    return { data: results, error: null }
  } catch (err) {
    console.error('getFaceImageUrls error:', err)
    return { data: null, error: { message: 'Gagal mendapatkan URL gambar' } }
  }
}

// ========== SAVE FACE DESCRIPTOR ==========
export async function saveFaceDescriptor(
  faceId: string,
  descriptor: number[]
): Promise<ActionResult<boolean>> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('visitor_faces')
      .update({ descriptor })
      .eq('id', faceId)

    if (error) throw error
    return { data: true, error: null }
  } catch (err) {
    console.error('saveFaceDescriptor error:', err)
    return { data: null, error: { message: 'Gagal menyimpan descriptor wajah' } }
  }
}
