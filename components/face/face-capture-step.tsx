'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { saveFaceImages, type FaceImageInput } from '@/lib/actions/face-recognition'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Camera, CheckCircle, Loader2, RotateCcw,
  ArrowRight, ArrowLeft, User
} from 'lucide-react'
import { toast } from 'sonner'
import * as faceapi from 'face-api.js'

interface FaceCaptureStepProps {
  visitId: string
  visitorName: string
  onComplete: () => void
  onSkip: () => void
}

type AngleConfig = {
  id: 'front' | 'left' | 'right'
  label: string
  icon: string
  instruction: string
}

const ANGLES: AngleConfig[] = [
  { id: 'front', label: 'Depan', icon: '😐', instruction: 'Lihat lurus ke kamera, posisikan wajah di tengah' },
  { id: 'left',  label: 'Kiri',  icon: '👈', instruction: 'Putar kepala sedikit ke kiri' },
  { id: 'right', label: 'Kanan', icon: '👉', instruction: 'Putar kepala sedikit ke kanan' },
]

const CAPTURES_PER_ANGLE = 10
const CAPTURE_INTERVAL_MS = 350

export default function FaceCaptureStep({ visitId, visitorName, onComplete, onSkip }: FaceCaptureStepProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [currentAngleIdx, setCurrentAngleIdx] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const [captureCount, setCaptureCount] = useState(0)
  const [capturedImages, setCapturedImages] = useState<Map<string, FaceImageInput[]>>(new Map())
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)

  const currentAngle = ANGLES[currentAngleIdx]

  // Load models on mount
  useEffect(() => {
    async function loadModels() {
      try {
        const MODEL_URL = '/models'
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ])
        setModelsLoaded(true)
      } catch (err) {
        console.error('Failed to load models', err)
      }
    }
    loadModels()
  }, [])

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        // Wait for metadata before playing to avoid AbortError
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve()
          setTimeout(resolve, 5000)
        })
        try {
          await video.play()
        } catch (err: unknown) {
          if ((err as Error).name !== 'AbortError') throw err
        }
        setCameraReady(true)
      } catch {
        setCameraError('Tidak bisa mengakses kamera. Pastikan izin kamera sudah diberikan.')
      }
    }
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.85)
  }, [])

  const startCapturing = useCallback(() => {
    if (!cameraReady || !modelsLoaded || capturing) return
    setCapturing(true)
    setCaptureCount(0)
    setCountdown(3)

    // 3-second countdown then start
    let count = 3
    const countTimer = setInterval(() => {
      count--
      setCountdown(count)
      if (count <= 0) {
        clearInterval(countTimer)
        setCountdown(null)

        let captured = 0
        const images: FaceImageInput[] = []

        intervalRef.current = setInterval(async () => {
          const video = videoRef.current
          const canvas = canvasRef.current
          if (!video || !canvas) return
          
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          ctx.drawImage(video, 0, 0)
          
          let descriptor: number[] | undefined = undefined
          let detectionData = null

          try {
            const detection = await faceapi
              .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
              .withFaceLandmarks(true)
              .withFaceDescriptor()
              
            if (detection) {
              descriptor = Array.from(detection.descriptor)
              detectionData = detection
              console.log(`[FaceCapture] extracted descriptor for angle ${currentAngle.id}`)
            }
          } catch (e) {
            console.error('Face extraction error:', e)
          }

          if (!detectionData) return // Skip if no face detected

          // Crop face + 20% margin
          const box = detectionData.detection.box
          const padX = box.width * 0.2
          const padY = box.height * 0.2
          
          const cropX = Math.max(0, box.x - padX)
          const cropY = Math.max(0, box.y - padY)
          const cropW = Math.min(canvas.width - cropX, box.width + padX * 2)
          const cropH = Math.min(canvas.height - cropY, box.height + padY * 2)

          const faceCanvas = document.createElement('canvas')
          faceCanvas.width = cropW
          faceCanvas.height = cropH
          const faceCtx = faceCanvas.getContext('2d')
          if (!faceCtx) return
          faceCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

          const base64 = faceCanvas.toDataURL('image/jpeg', 0.85)

          images.push({ angle: currentAngle.id, base64, descriptor })
          captured++
          setCaptureCount(captured)

          if (captured >= CAPTURES_PER_ANGLE) {
            clearInterval(intervalRef.current!)
            setCapturing(false)
            setCapturedImages((prev) => {
              const next = new Map(prev)
              next.set(currentAngle.id, images)
              return next
            })
          }
        }, CAPTURE_INTERVAL_MS)
      }
    }, 1000)
  }, [cameraReady, modelsLoaded, capturing, currentAngle.id])

  const nextAngle = () => {
    setCaptureCount(0)
    if (currentAngleIdx < ANGLES.length - 1) {
      setCurrentAngleIdx((i) => i + 1)
    } else {
      handleSave()
    }
  }

  const prevAngle = () => {
    if (currentAngleIdx > 0) {
      setCurrentAngleIdx((i) => i - 1)
      setCaptureCount(0)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const allImages: FaceImageInput[] = []
    capturedImages.forEach((imgs) => allImages.push(...imgs))

    const result = await saveFaceImages(visitId, visitorName, allImages)
    setSaving(false)

    if (result.error) {
      toast.error(result.error.message)
    } else {
      setDone(true)
      toast.success(`${result.data.saved} foto wajah berhasil disimpan!`)
      setTimeout(() => onComplete(), 1500)
    }
  }

  const currentAngleDone = capturedImages.has(currentAngle.id)
  const allAnglesDone = ANGLES.every((a) => capturedImages.has(a.id))
  const isLastAngle = currentAngleIdx === ANGLES.length - 1

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <h3 className="text-xl font-semibold text-white">Foto Wajah Berhasil Disimpan!</h3>
        <p className="text-slate-400 text-sm">Mengarahkan ke halaman QR...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 text-emerald-400 mb-2">
          <Camera className="w-5 h-5" />
          <span className="text-sm font-medium uppercase tracking-wider">Registrasi Wajah</span>
        </div>
        <p className="text-slate-300 text-sm">
          Hai <strong className="text-white">{visitorName}</strong>! Ambil foto wajah dari 3 sudut
          agar sistem dapat mengenali Anda secara otomatis.
        </p>
      </div>

      {/* Angle Progress */}
      <div className="flex items-center justify-center gap-3">
        {ANGLES.map((angle, i) => (
          <div key={angle.id} className="flex items-center gap-2">
            <div className={`
              flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all
              ${i === currentAngleIdx ? 'border-emerald-500 bg-emerald-500/10' : ''}
              ${capturedImages.has(angle.id) ? 'border-emerald-700 bg-emerald-950/30' : ''}
              ${!capturedImages.has(angle.id) && i !== currentAngleIdx ? 'border-slate-700 bg-slate-800/30' : ''}
            `}>
              <span className="text-xl">{angle.icon}</span>
              <span className={`text-xs font-medium ${i === currentAngleIdx ? 'text-emerald-300' : 'text-slate-400'}`}>
                {angle.label}
              </span>
              {capturedImages.has(angle.id) && (
                <CheckCircle className="w-3 h-3 text-emerald-400" />
              )}
            </div>
            {i < ANGLES.length - 1 && <div className="w-4 h-px bg-slate-700" />}
          </div>
        ))}
      </div>

      {/* Camera Feed */}
      {cameraError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-8 text-center">
          <p className="text-red-400 text-sm">{cameraError}</p>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black aspect-video max-h-72">
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-[-1]"
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Countdown overlay */}
          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-8xl font-black text-white/90 animate-pulse">{countdown}</span>
            </div>
          )}

          {/* Face guide oval */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-36 h-44 rounded-full border-2 border-dashed border-emerald-400/60" />
          </div>

          {/* Capture progress bar */}
          {capturing && (
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-300">Mengambil foto...</span>
                <span className="text-xs text-emerald-400">{captureCount}/{CAPTURES_PER_ANGLE}</span>
              </div>
              <Progress value={(captureCount / CAPTURES_PER_ANGLE) * 100} className="h-1.5" />
            </div>
          )}

          {/* Status badge */}
          {!capturing && (
            <div className="absolute top-3 right-3">
              <span className={`text-xs px-2 py-1 rounded-full border font-medium
                ${cameraReady && modelsLoaded ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}
              `}>
                {cameraReady && modelsLoaded ? '● KAMERA AKTIF' : '○ Memuat...'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Instruction */}
      <div className="text-center bg-slate-800/50 rounded-xl p-3 border border-slate-700">
        <p className="text-slate-300 text-sm">
          <span className="text-2xl mr-2">{currentAngle.icon}</span>
          {currentAngle.instruction}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        {!currentAngleDone ? (
          <Button
            onClick={startCapturing}
            disabled={!cameraReady || !modelsLoaded || capturing || !!cameraError}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-600/25 h-12"
          >
            {capturing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mengambil Foto...</>
            ) : countdown !== null ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Bersiap...</>
            ) : (
              <><Camera className="w-4 h-4 mr-2" />Ambil Foto — {currentAngle.label}</>
            )}
          </Button>
        ) : (
          <Button
            onClick={startCapturing}
            variant="outline"
            className="w-full border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            disabled={capturing}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Ulangi Pengambilan
          </Button>
        )}

        <div className="flex gap-3">
          {currentAngleIdx > 0 && (
            <Button
              onClick={prevAngle}
              variant="ghost"
              className="flex-1 text-slate-400 hover:text-white"
              disabled={capturing || saving}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali
            </Button>
          )}

          {currentAngleDone && (
            <Button
              onClick={nextAngle}
              disabled={saving}
              className={`flex-1 ${isLastAngle && allAnglesDone
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</>
              ) : isLastAngle ? (
                <><CheckCircle className="w-4 h-4 mr-2" />Selesai & Simpan</>
              ) : (
                <>Angle Berikutnya<ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          )}
        </div>

        <button
          onClick={onSkip}
          className="text-xs text-slate-600 hover:text-slate-400 text-center transition-colors py-1"
        >
          <User className="w-3 h-3 inline mr-1" />
          Lewati langkah ini (tidak disarankan)
        </button>
      </div>

      {/* Captured thumbnails */}
      {capturedImages.size > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 text-center">Foto berhasil diambil per sudut:</p>
          <div className="flex gap-2 justify-center">
            {ANGLES.filter((a) => capturedImages.has(a.id)).map((a) => (
              <div key={a.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/30 border border-emerald-700/50">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-300">{a.label}</span>
                <span className="text-xs text-slate-500">({capturedImages.get(a.id)!.length})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
