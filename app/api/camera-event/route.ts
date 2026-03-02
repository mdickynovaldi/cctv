import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/camera-event — Placeholder for YOLO integration (Phase 2)
export async function POST(request: NextRequest) {
  try {
    // Verify API key (simple bearer token check)
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.CAMERA_API_KEY

    if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate required fields
    const { event_type, count, camera_id, confidence, metadata } = body

    if (!event_type || !['enter', 'exit', 'count'].includes(event_type)) {
      return NextResponse.json(
        { error: 'Invalid event_type. Must be enter, exit, or count' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    const { data, error } = await supabase.from('occupancy_events').insert({
      event_type,
      count: count || 0,
      source: 'yolo',
      camera_id: camera_id || null,
      confidence: confidence || null,
      metadata: metadata || {},
    } as never).select('id').single()

    if (error) throw error

    return NextResponse.json({ event_id: (data as { id: string })?.id }, { status: 201 })
  } catch (err) {
    console.error('Camera event error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
