'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import * as faceapi from 'face-api.js'
import dynamic from 'next/dynamic'
import type { DetectedFace } from '@/components/face/face-recognition-camera'
import { getTodayFaceRecords, getFaceImageUrl } from '@/lib/actions/face-recognition'
import { manualMark, searchVisitors } from '@/lib/actions/visits'
import type { VisitWithHost } from '@/lib/database.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Eye, Cpu, Users, Loader2, CheckCircle,
  XCircle, AlertTriangle, User, Clock, RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

const FaceRecognitionCamera = dynamic(
  () => import('@/components/face/face-recognition-camera'),
  { ssr: false, loading: () => null }
)

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

type NamedDescriptorEntry = {
  name: string
  descriptors: Float32Array[]
}

type DetectedVisitor = {
  label: string
  confidence: number
  lastSeen: Date
  visit?: VisitWithHost
}

export default function VisionPage() {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [loadingStep, setLoadingStep] = useState('')
  const [namedDescriptors, setNamedDescriptors] = useState<NamedDescriptorEntry[]>([])
  const [registeredCount, setRegisteredCount] = useState(0)
  const [detectedVisitors, setDetectedVisitors] = useState<Map<string, DetectedVisitor>>(new Map())
  const [isActive, setIsActive] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const detectionCooldown = useRef<Map<string, number>>(new Map())

  // Load face-api.js models from /public/models/
  const loadModels = useCallback(async () => {
    setModelStatus('loading')
    try {
      const MODEL_URL = '/models'
      setLoadingStep('Memuat tiny face detector...')
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)

      setLoadingStep('Memuat face landmark model...')
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)

      setLoadingStep('Memuat face recognition model...')
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)

      setLoadingStep('Memuat data wajah tamu hari ini...')
      await loadVisitorDescriptors()

      setModelStatus('ready')
      setLoadingStep('')
      setIsActive(true)
      toast.success('Sistem Face Recognition siap!')
    } catch (err) {
      console.error('Model load error:', err)
      setModelStatus('error')
      setLoadingStep('Gagal memuat model. Cek file models di /public/models/')
      toast.error('Gagal memuat model face recognition')
    }
  }, [])

  // Load today's visitor face images and compute descriptors
  const loadVisitorDescriptors = async () => {
    const result = await getTodayFaceRecords()
    if (!result.data || result.data.length === 0) {
      setRegisteredCount(0)
      return
    }

    // Group by visitor name
    const grouped = new Map<string, Float32Array[]>()
    for (const record of result.data) {
      if (!record.descriptor) continue
      const existing = grouped.get(record.visitor_name) || []
      existing.push(new Float32Array(record.descriptor))
      grouped.set(record.visitor_name, existing)
    }

    setRegisteredCount(grouped.size)

    const entries: NamedDescriptorEntry[] = []

    for (const [name, descriptors] of grouped.entries()) {
      if (descriptors.length > 0) {
        entries.push({ name, descriptors })
      }
    }

    setNamedDescriptors(entries)
    console.log(`[Vision] Loaded ${entries.length} descriptors from DB for ${grouped.size} visitors`)
  }

  const handleFaceDetected = useCallback((faces: DetectedFace[]) => {
    const now = Date.now()
    setDetectedVisitors((prev) => {
      const next = new Map(prev)
      faces.forEach((face) => {
        if (face.label === 'Unknown') return

        // Cooldown: don't update the same person more than once per 2s
        const lastUpdate = detectionCooldown.current.get(face.label) || 0
        if (now - lastUpdate < 2000) return
        detectionCooldown.current.set(face.label, now)

        const existing = prev.get(face.label)
        next.set(face.label, {
          label: face.label,
          confidence: face.confidence,
          lastSeen: new Date(),
          visit: existing?.visit,
        })
      })
      return next
    })
  }, [])

  // Fetch visit info for detected visitors
  useEffect(() => {
    const names = Array.from(detectedVisitors.keys())
    names.forEach(async (name) => {
      const visitor = detectedVisitors.get(name)
      if (visitor?.visit) return // Already have visit data

      const result = await searchVisitors(name)
      if (result.data && result.data.length > 0) {
        setDetectedVisitors((prev) => {
          const next = new Map(prev)
          const existing = next.get(name)
          if (existing) {
            next.set(name, { ...existing, visit: result.data![0] })
          }
          return next
        })
      }
    })
  }, [detectedVisitors])

  const handleCheckIn = async (visitId: string, visitorName: string) => {
    setLoadingAction(visitorName)
    const result = await manualMark(visitId, 'arrive')
    setLoadingAction(null)
    if (result.error) {
      toast.error(result.error.message)
    } else {
      toast.success(`Check-in ${visitorName} berhasil!`)
      // Refresh visit data
      setDetectedVisitors((prev) => {
        const next = new Map(prev)
        const entry = next.get(visitorName)
        if (entry?.visit) {
          next.set(visitorName, {
            ...entry,
            visit: { ...entry.visit, status: 'arrived' }
          })
        }
        return next
      })
    }
  }

  const handleCheckOut = async (visitId: string, visitorName: string) => {
    setLoadingAction(visitorName)
    const result = await manualMark(visitId, 'depart')
    setLoadingAction(null)
    if (result.error) {
      toast.error(result.error.message)
    } else {
      toast.success(`Checkout ${visitorName} berhasil!`)
      setDetectedVisitors((prev) => {
        const next = new Map(prev)
        const entry = next.get(visitorName)
        if (entry?.visit) {
          next.set(visitorName, {
            ...entry,
            visit: { ...entry.visit, status: 'departed' }
          })
        }
        return next
      })
    }
  }

  const detectedList = Array.from(detectedVisitors.values())
    .filter((v) => Date.now() - v.lastSeen.getTime() < 10000) // Show if seen in last 10s
    .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Eye className="w-7 h-7 text-purple-400" />
            Camera Vision
          </h1>
          <p className="text-slate-400 text-sm mt-1">Deteksi wajah tamu secara real-time</p>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={`
            ${modelStatus === 'ready' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : ''}
            ${modelStatus === 'loading' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : ''}
            ${modelStatus === 'error' ? 'bg-red-500/20 text-red-300 border-red-500/30' : ''}
            ${modelStatus === 'idle' ? 'bg-slate-500/20 text-slate-300 border-slate-500/30' : ''}
          `}>
            <Cpu className="w-3 h-3 mr-1.5" />
            {modelStatus === 'ready' ? 'Model Siap'
              : modelStatus === 'loading' ? 'Memuat Model...'
              : modelStatus === 'error' ? 'Error'
              : 'Belum Dimuat'}
          </Badge>

          {modelStatus === 'ready' && (
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              <Users className="w-3 h-3 mr-1.5" />
              {namedDescriptors.length} wajah terdaftar
            </Badge>
          )}

          {modelStatus === 'ready' && isActive && (
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              <div className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
              LIVE
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Camera Feed */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-400">Live Feed</CardTitle>
                <div className="flex items-center gap-2">
                  {modelStatus === 'ready' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsActive((a) => !a)}
                      className={isActive ? 'text-red-400 hover:text-red-300 hover:bg-red-950/30' : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30'}
                    >
                      {isActive ? <><XCircle className="w-4 h-4 mr-1" />Hentikan</> : <><Eye className="w-4 h-4 mr-1" />Aktifkan</>}
                    </Button>
                  )}
                  {modelStatus === 'ready' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={loadVisitorDescriptors}
                      className="text-slate-400 hover:text-white"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh Data
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {modelStatus === 'idle' && (
                <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/50 flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Eye className="w-10 h-10 text-purple-400/60" />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-300 font-medium">Camera Vision Belum Aktif</p>
                    <p className="text-slate-500 text-sm mt-1">Klik tombol di bawah untuk memuat model AI dan mengaktifkan kamera</p>
                  </div>
                  <Button
                    onClick={loadModels}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/25"
                  >
                    <Cpu className="w-4 h-4 mr-2" />
                    Muat Model & Aktifkan Kamera
                  </Button>
                </div>
              )}

              {modelStatus === 'loading' && (
                <div className="rounded-2xl border border-amber-700/30 bg-amber-950/10 flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                  <div className="text-center">
                    <p className="text-amber-300 font-medium">Memuat Model AI...</p>
                    <p className="text-slate-500 text-sm mt-1">{loadingStep}</p>
                  </div>
                  <div className="text-xs text-slate-600">Ini mungkin memakan waktu beberapa saat pada pertama kali</div>
                </div>
              )}

              {modelStatus === 'error' && (
                <div className="rounded-2xl border border-red-700/30 bg-red-950/10 flex flex-col items-center justify-center py-16 gap-4">
                  <AlertTriangle className="w-10 h-10 text-red-400" />
                  <div className="text-center">
                    <p className="text-red-300 font-medium">Gagal Memuat Model</p>
                    <p className="text-slate-500 text-sm mt-1">{loadingStep}</p>
                  </div>
                  <Button onClick={loadModels} variant="outline" className="border-red-700 text-red-300 hover:bg-red-950/30">
                    Coba Lagi
                  </Button>
                </div>
              )}

              {modelStatus === 'ready' && (
                <FaceRecognitionCamera
                  namedDescriptors={namedDescriptors}
                  onFaceDetected={handleFaceDetected}
                  isActive={isActive}
                />
              )}
            </CardContent>
          </Card>

          {/* Info Box */}
          {modelStatus === 'ready' && namedDescriptors.length === 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-950/20 border border-blue-700/30">
              <AlertTriangle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-300 font-medium">Belum Ada Wajah Terdaftar Hari Ini</p>
                <p className="text-xs text-slate-500 mt-1">
                  Tamu perlu mendaftar terlebih dahulu melalui halaman registrasi dan menyelesaikan langkah foto wajah.
                  Setelah ada tamu terdaftar, klik <strong className="text-slate-400">Refresh Data</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Detection Panel */}
        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                Wajah Terdeteksi
                {detectedList.length > 0 && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                    {detectedList.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detectedList.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <Eye className="w-6 h-6 text-slate-600" />
                  </div>
                  <p className="text-slate-500 text-sm">Belum ada wajah terdeteksi</p>
                  <p className="text-slate-600 text-xs mt-1">
                    {modelStatus === 'ready' ? 'Posisikan wajah di depan kamera' : 'Aktifkan kamera terlebih dahulu'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {detectedList.map((visitor) => {
                    const visit = visitor.visit
                    const isProcessing = loadingAction === visitor.label
                    const timeSince = Math.round((Date.now() - visitor.lastSeen.getTime()) / 1000)

                    return (
                      <div key={visitor.label} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">{visitor.label}</p>
                            <p className="text-xs text-emerald-400">Keyakinan: {visitor.confidence}%</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className={`w-2 h-2 rounded-full ${timeSince < 3 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                            <span className="text-xs text-slate-600 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />{timeSince}d
                            </span>
                          </div>
                        </div>

                        {visit && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Badge className={`text-xs ${
                                visit.status === 'arrived' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : visit.status === 'registered' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                : visit.status === 'departed' ? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                                : 'bg-red-500/20 text-red-300 border-red-500/30'
                              }`}>
                                {visit.status === 'arrived' ? 'Sudah Check-in'
                                  : visit.status === 'registered' ? 'Belum Check-in'
                                  : visit.status === 'departed' ? 'Sudah Checkout'
                                  : visit.status}
                              </Badge>
                            </div>

                            <div className="flex gap-2 mt-2">
                              {visit.status === 'registered' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleCheckIn(visit.id, visitor.label)}
                                  disabled={isProcessing}
                                  className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-500"
                                >
                                  {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle className="w-3 h-3 mr-1" />Check-in</>}
                                </Button>
                              )}
                              {visit.status === 'arrived' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleCheckOut(visit.id, visitor.label)}
                                  disabled={isProcessing}
                                  className="flex-1 h-7 text-xs bg-slate-600 hover:bg-slate-500"
                                >
                                  {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><XCircle className="w-3 h-3 mr-1" />Checkout</>}
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {!visit && (
                          <p className="text-xs text-slate-600">Mencari data kunjungan...</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
