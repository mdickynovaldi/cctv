'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as faceapi from 'face-api.js'

export type DetectedFace = {
  label: string
  confidence: number
  box: { x: number; y: number; width: number; height: number }
}

interface FaceRecognitionCameraProps {
  namedDescriptors: Array<{ name: string; descriptors: Float32Array[] }>
  onFaceDetected?: (faces: DetectedFace[]) => void
  isActive: boolean
}

export default function FaceRecognitionCamera({
  namedDescriptors,
  onFaceDetected,
  isActive,
}: FaceRecognitionCameraProps) {
  const containerRef        = useRef<HTMLDivElement>(null)
  const videoRef            = useRef<HTMLVideoElement>(null)
  const canvasElRef         = useRef<HTMLCanvasElement | null>(null)
  const ctxRef              = useRef<CanvasRenderingContext2D | null>(null)
  const streamRef           = useRef<MediaStream | null>(null)
  const timerRef            = useRef<ReturnType<typeof setTimeout> | null>(null)
  const matcherRef          = useRef<faceapi.FaceMatcher | null>(null)
  const cameraStartedRef    = useRef(false)
  const loopActiveRef       = useRef(false)
  const isDetectingRef      = useRef(false) // prevents concurrent async frames

  const namedDescriptorsRef = useRef(namedDescriptors)
  const onFaceDetectedRef   = useRef(onFaceDetected)

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  const fpsRef        = useRef({ frames: 0, last: Date.now() })
  const fpsDisplayRef = useRef(0)

  useEffect(() => { namedDescriptorsRef.current = namedDescriptors }, [namedDescriptors])
  useEffect(() => { onFaceDetectedRef.current   = onFaceDetected   }, [onFaceDetected])

  // Rebuild matcher
  useEffect(() => {
    if (namedDescriptors.length === 0) { matcherRef.current = null; return }
    try {
      matcherRef.current = new faceapi.FaceMatcher(
        namedDescriptors.map((d) => new faceapi.LabeledFaceDescriptors(d.name, d.descriptors)),
        0.45  // relaxed threshold to allow detecting faces from different angles
      )
      console.log('[FaceCamera] Matcher built:', namedDescriptors.length, 'profiles')
    } catch (e) {
      console.error('[FaceCamera] Matcher error:', e)
      matcherRef.current = null
    }
  }, [namedDescriptors])

  // Create canvas imperatively on mount
  useEffect(() => {
    const container = containerRef.current
    if (!container || canvasElRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width  = 640
    canvas.height = 480
    Object.assign(canvas.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '10',
    })
    container.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    canvasElRef.current = canvas
    ctxRef.current      = ctx

    if (ctx) {
      // Confirmation draw — green bar shows canvas works
      ctx.fillStyle = 'rgba(16,185,129,0.9)'
      ctx.fillRect(4, 4, 80, 22)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'
      ctx.fillText('● CANVAS OK', 8, 19)
      console.log('[FaceCamera] Canvas mounted, ctx:', !!ctx)
    }

    return () => {
      if (canvasElRef.current && container.contains(canvasElRef.current)) {
        container.removeChild(canvasElRef.current)
      }
      canvasElRef.current = null
      ctxRef.current      = null
    }
  }, [])

  // ── Core detection (runs once per completion, never concurrent) ────────────
  const runOnce = useCallback(async () => {
    if (isDetectingRef.current) return
    isDetectingRef.current = true

    const video  = videoRef.current
    const canvas = canvasElRef.current
    let ctx      = ctxRef.current

    if (!video || !canvas || !ctx) { isDetectingRef.current = false; return }

    // Sync canvas size to video
    const vw = video.videoWidth  || 640
    const vh = video.videoHeight || 480
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width  = vw
      canvas.height = vh
      ctx = canvas.getContext('2d')
      ctxRef.current = ctx
      isDetectingRef.current = false; return
    }

    // FPS
    fpsRef.current.frames++
    const now = Date.now()
    if (now - fpsRef.current.last >= 1000) {
      fpsDisplayRef.current = fpsRef.current.frames
      fpsRef.current.frames = 0
      fpsRef.current.last   = now
    }

    const hasMatcher  = matcherRef.current !== null
    const descriptors = namedDescriptorsRef.current
    const c           = ctx!

    // Helper: draw HUD overlay
    const drawHud = (faceCount: number, identified: string[]) => {
      const lines = [
        `Wajah: ${faceCount}   FPS: ${fpsDisplayRef.current}`,
        hasMatcher ? `Matcher: ${descriptors.length} profil` : 'Matcher: tidak ada data',
        identified.length > 0 ? `>> ${identified.join(', ')}` : '',
      ].filter(Boolean)

      const lH = 17, pad = 8, w = 240, h = lines.length * lH + pad * 2
      c.fillStyle = 'rgba(0,0,0,0.80)'
      c.fillRect(8, 8, w, h)
      lines.forEach((line, i) => {
        const isMatch = line.startsWith('>>')
        c.font      = `${isMatch ? 'bold ' : ''}11px monospace`
        c.fillStyle = isMatch ? '#34d399' : i === 0 ? '#f1f5f9' : '#94a3b8'
        c.fillText(line, 16, 8 + pad + (i + 1) * lH - 2)
      })
    }

    // Skip if video not ready
    if (video.readyState < 2 || video.paused || vw === 0) {
      drawHud(0, [])
      isDetectingRef.current = false; return
    }


    // Run detection (async — but guarded by isDetectingRef so only one runs at a time)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detections: any[] = []
    try {
      const raw = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors()
      detections = faceapi.resizeResults(raw, { width: vw, height: vh })
    } catch (err) {
      console.error('[FaceCamera] detect error:', err)
      c.clearRect(0, 0, vw, vh)
      drawHud(0, [])
      isDetectingRef.current = false; return
    }

    // Draw results — after await, canvas was NOT touched (loop is paused while detecting)
    c.clearRect(0, 0, vw, vh)

    const identified: string[] = []
    const detected: DetectedFace[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detections.forEach((d: any) => {
      const box = d.detection.box
      let label = 'Unknown', confidence = 0

      if (matcherRef.current) {
        const m = matcherRef.current.findBestMatch(d.descriptor)
        if (m.label !== 'unknown') {
          label = m.label
          confidence = Math.round((1 - m.distance) * 100)
          identified.push(label)
        }
      }

      const isKnown = label !== 'Unknown'
      const color   = isKnown ? '#10b981' : '#f59e0b'

      c.fillStyle = isKnown ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'
      c.fillRect(box.x, box.y, box.width, box.height)
      c.strokeStyle = color; c.lineWidth = 2.5
      c.strokeRect(box.x, box.y, box.width, box.height)

      // Corner brackets
      const cl = Math.min(18, box.width * 0.18)
      c.lineWidth = 4; c.lineCap = 'round'; c.strokeStyle = color
      ;[
        [box.x, box.y, box.x+cl, box.y, box.x, box.y+cl],
        [box.x+box.width-cl, box.y, box.x+box.width, box.y, box.x+box.width, box.y+cl],
        [box.x, box.y+box.height-cl, box.x, box.y+box.height, box.x+cl, box.y+box.height],
        [box.x+box.width-cl, box.y+box.height, box.x+box.width, box.y+box.height, box.x+box.width, box.y+box.height-cl],
      ].forEach(([x1,y1,x2,y2,x3,y3]) => {
        c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.lineTo(x3,y3); c.stroke()
      })

      // Landmarks
      if (d.landmarks) {
        c.fillStyle = 'rgba(255,255,255,0.4)'
        d.landmarks.positions.forEach((pt: { x: number; y: number }) => {
          c.beginPath(); c.arc(pt.x, pt.y, 1.5, 0, Math.PI*2); c.fill()
        })
      }

      // Label pill
      const nameText = isKnown ? label : 'Tidak Dikenal'
      const confText = isKnown ? `  ${confidence}%` : ''
      c.font = 'bold 14px system-ui, sans-serif'
      const nW = c.measureText(nameText).width
      c.font = '12px system-ui, sans-serif'
      const cW = c.measureText(confText).width
      const pW = nW + cW + 20, pH = 26
      const pY = box.y > pH + 6 ? box.y - pH - 6 : box.y + box.height + 6
      c.fillStyle = isKnown ? 'rgba(6,78,59,0.92)' : 'rgba(120,53,15,0.92)'
      c.fillRect(box.x, pY, pW, pH)
      c.strokeStyle = color; c.lineWidth = 1.5
      c.strokeRect(box.x, pY, pW, pH)
      c.fillStyle = '#fff'; c.font = 'bold 14px system-ui, sans-serif'
      c.fillText(nameText, box.x + 10, pY + 18)
      if (isKnown) {
        c.fillStyle = color; c.font = '12px system-ui, sans-serif'
        c.fillText(confText, box.x + 10 + nW, pY + 17)
      }

      // Confidence bar
      if (isKnown) {
        const bY = pY < box.y ? box.y + box.height + 4 : pY + pH + 4
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(box.x, bY, box.width, 4)
        c.fillStyle = color; c.fillRect(box.x, bY, box.width * (confidence / 100), 4)
      }

      detected.push({ label, confidence, box: { x: box.x, y: box.y, width: box.width, height: box.height } })
    })

    drawHud(detections.length, identified)

    if (detected.length > 0 && onFaceDetectedRef.current) {
      onFaceDetectedRef.current(detected)
    }

    isDetectingRef.current = false
  }, [])

  // ── Loop driver — schedules runOnce with setTimeout AFTER completion ────────
  const scheduleNext = useCallback(() => {
    if (!loopActiveRef.current) return
    timerRef.current = setTimeout(async () => {
      await runOnce()
      scheduleNext() // next frame only queued after this one finishes
    }, 50) // ~20fps cap
  }, [runOnce])

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (cameraStartedRef.current) return
    cameraStartedRef.current = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) { cameraStartedRef.current = false; return }
      video.srcObject = stream
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          const canvas = canvasElRef.current
          if (canvas && video.videoWidth > 0) {
            canvas.width  = video.videoWidth
            canvas.height = video.videoHeight
            ctxRef.current = canvas.getContext('2d')
            console.log('[FaceCamera] Canvas sized to video:', canvas.width, 'x', canvas.height)
          }
          resolve()
        }
        setTimeout(resolve, 5000)
      })
      try { await video.play() } catch (e: unknown) {
        if ((e as Error).name !== 'AbortError') throw e
      }
      console.log('[FaceCamera] Camera ready')
      setCameraReady(true)
      setCameraError(null)
    } catch (e) {
      console.error('[FaceCamera] Camera error:', e)
      cameraStartedRef.current = false
      setCameraError('Kamera tidak tersedia.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    loopActiveRef.current = false
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    cameraStartedRef.current = false
    isDetectingRef.current   = false
    setCameraReady(false)
  }, [])

  useEffect(() => {
    if (isActive) startCamera()
    return () => stopCamera()
  }, [isActive, startCamera, stopCamera])

  useEffect(() => {
    if (!cameraReady || loopActiveRef.current) return
    loopActiveRef.current = true
    console.log('[FaceCamera] Starting detection loop (setTimeout mode)')
    scheduleNext()
    return () => {
      loopActiveRef.current = false
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    }
  }, [cameraReady, scheduleNext])

  if (cameraError) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-red-500/30 bg-red-950/20 p-8 text-center min-h-52 flex flex-col items-center justify-center gap-3">
        <p className="text-red-400 text-sm font-medium">⚠️ Kamera Tidak Tersedia</p>
        <p className="text-slate-500 text-xs">{cameraError}</p>
        <button
          onClick={() => { setCameraError(null); cameraStartedRef.current = false; startCamera() }}
          className="text-xs text-blue-400 hover:text-blue-300 underline mt-1"
        >Coba Lagi</button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', overflow: 'hidden', borderRadius: '1rem', minHeight: 240, background: '#000', border: '1px solid #334155' }}
    >
      <video ref={videoRef} style={{ width: '100%', display: 'block' }} muted playsInline autoPlay />
      {/* Canvas injected imperatively — React cannot reset it on re-render */}
      {!cameraReady && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 28, height: 28, border: '2px solid #a855f7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Memuat kamera...</p>
          </div>
        </div>
      )}
    </div>
  )
}
