'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { processScan, searchVisitors, manualMark } from '@/lib/actions/visits'
import type { VisitWithHost } from '@/lib/database.types'
import QrScanner from '@/components/scanner/qr-scanner'
import dynamic from 'next/dynamic'
import type { DetectedFace } from '@/components/face/face-recognition-camera'
import { getTodayFaceRecords, getFaceImageUrl } from '@/lib/actions/face-recognition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  ScanLine, Search, CheckCircle, XCircle, AlertTriangle,
  User, Phone, Building2, Clock, Loader2, Volume2, Eye,
  Cpu, RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import * as faceapi from 'face-api.js'

const FaceRecognitionCamera = dynamic(
  () => import('@/components/face/face-recognition-camera'),
  { ssr: false, loading: () => null }
)

type ScanResult = {
  type: 'success' | 'error' | 'warning'
  message: string
  visit?: VisitWithHost
}

type DetectedVisitor = {
  label: string
  confidence: number
  lastSeen: Date
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  registered: { label: 'Terdaftar', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  arrived:    { label: 'Hadir',     color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  departed:   { label: 'Checkout',  color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  canceled:   { label: 'Dibatalkan',color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  no_show:    { label: 'No Show',   color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
}

export default function ScannerPage() {
  // ── QR Scanner ─────────────────────────────────────────────────────────────
  const [scannerActive, setScannerActive] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [lastResults, setLastResults] = useState<ScanResult[]>([])
  const [manualOpen, setManualOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<VisitWithHost[]>([])
  const [searching, setSearching] = useState(false)
  const successAudioRef = useRef<HTMLAudioElement | null>(null)
  const errorAudioRef = useRef<HTMLAudioElement | null>(null)

  // ── Face Vision ─────────────────────────────────────────────────────────────
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [loadingStep, setLoadingStep] = useState('')
  const [namedDescriptors, setNamedDescriptors] = useState<{ name: string; descriptors: Float32Array[] }[]>([])
  const [detectedVisitors, setDetectedVisitors] = useState<Map<string, DetectedVisitor>>(new Map())
  const detectionCooldown = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    successAudioRef.current = new Audio('/sounds/success.mp3')
    errorAudioRef.current = new Audio('/sounds/error.mp3')
    // Auto-load face models on mount
    loadFaceModels()
  }, [])

  // ── QR Handlers ─────────────────────────────────────────────────────────────
  const playSound = (type: 'success' | 'error') => {
    try {
      const audio = type === 'success' ? successAudioRef.current : errorAudioRef.current
      if (audio) { audio.currentTime = 0; audio.play().catch(() => {}) }
    } catch {}
  }

  const handleScan = useCallback(async (token: string) => {
    if (processing) return
    setProcessing(true)
    setScannerActive(false)
    const result = await processScan(token)
    if (result.error) {
      playSound('error')
      setLastResults((prev) => [{ type: 'error', message: result.error!.message }, ...prev.slice(0, 2)])
      toast.error(result.error.message)
    } else {
      playSound('success')
      setLastResults((prev) => [
        { type: 'success', message: result.data!.action, visit: result.data!.visit },
        ...prev.slice(0, 2),
      ])
      toast.success(result.data!.action)
    }
    setTimeout(() => { setProcessing(false); setScannerActive(true) }, 2000)
  }, [processing])

  const handleManualSearch = async () => {
    if (searchQuery.length < 2) return
    setSearching(true)
    const result = await searchVisitors(searchQuery)
    if (result.data) setSearchResults(result.data)
    setSearching(false)
  }

  const handleManualAction = async (visitId: string, status: string) => {
    const action = status === 'registered' ? 'arrive' : 'depart'
    const result = await manualMark(visitId, action as 'arrive' | 'depart')
    if (result.error) {
      toast.error(result.error.message)
    } else {
      playSound('success')
      toast.success(action === 'arrive' ? 'Check-in berhasil' : 'Checkout berhasil')
      setManualOpen(false)
      if (searchQuery) handleManualSearch()
    }
  }

  // ── Face Vision Handlers ─────────────────────────────────────────────────────
  const loadFaceModels = async () => {
    setModelStatus('loading')
    try {
      const MODEL_URL = '/models'
      setLoadingStep('Memuat face detector...')
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      setLoadingStep('Memuat landmark model...')
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
      setLoadingStep('Memuat recognition model...')
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      setLoadingStep('Memuat data wajah tamu...')
      await loadDescriptors()
      setModelStatus('ready')
      setLoadingStep('')
    } catch (err) {
      console.error('Model load error:', err)
      setModelStatus('error')
      setLoadingStep('Gagal memuat model AI')
    }
  }

  const loadDescriptors = async () => {
    const result = await getTodayFaceRecords()
    if (!result.data || result.data.length === 0) { setNamedDescriptors([]); return }

    const grouped = new Map<string, string[]>()
    for (const record of result.data) {
      const arr = grouped.get(record.visitor_name) || []
      arr.push(record.image_path)
      grouped.set(record.visitor_name, arr)
    }

    const entries: { name: string; descriptors: Float32Array[] }[] = []
    for (const [name, paths] of grouped.entries()) {
      const descriptors: Float32Array[] = []
      // Load ALL images (not just 5) for better coverage
      console.log(`[Descriptors] Loading ${paths.length} images for ${name}`)
      for (const imgPath of paths) {
        const urlResult = await getFaceImageUrl(imgPath)
        if (!urlResult.data) continue
        try {
          const img = await faceapi.fetchImage(urlResult.data)
          const det = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
            .withFaceLandmarks(true)
            .withFaceDescriptor()
          if (det) descriptors.push(det.descriptor)
        } catch {}
      }
      console.log(`[Descriptors] ${name}: ${descriptors.length}/${paths.length} descriptors loaded`)
      if (descriptors.length > 0) entries.push({ name, descriptors })
    }
    setNamedDescriptors(entries)
  }

  const handleFaceDetected = useCallback((faces: DetectedFace[]) => {
    const now = Date.now()
    setDetectedVisitors((prev) => {
      const next = new Map(prev)
      faces.forEach((face) => {
        if (face.label === 'Unknown') return
        const lastUpdate = detectionCooldown.current.get(face.label) || 0
        if (now - lastUpdate < 2000) return
        detectionCooldown.current.set(face.label, now)
        next.set(face.label, {
          label: face.label,
          confidence: face.confidence,
          lastSeen: new Date(),
        })
      })
      return next
    })
  }, [])

  const detectedList = Array.from(detectedVisitors.values())
    .filter((v) => Date.now() - v.lastSeen.getTime() < 10000)
    .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ScanLine className="w-7 h-7 text-blue-400" />
            Pusat Pemindai
          </h1>
          <p className="text-slate-400 text-sm mt-1">QR Scanner &amp; Camera Vision aktif bersamaan secara real-time</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Model status badge */}
          <Badge className={
            modelStatus === 'ready'   ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
            modelStatus === 'loading' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
            modelStatus === 'error'   ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                        'bg-slate-500/20 text-slate-300 border-slate-500/30'
          }>
            <Cpu className="w-3 h-3 mr-1.5" />
            {modelStatus === 'ready'   ? `Face AI — ${namedDescriptors.length} wajah` :
             modelStatus === 'loading' ? 'Memuat AI...' :
             modelStatus === 'error'   ? 'AI Error' : 'AI Standby'}
          </Badge>

          {modelStatus === 'ready' && (
            <Button size="sm" variant="ghost" onClick={loadDescriptors}
              className="text-slate-400 hover:text-white h-7 text-xs">
              <RefreshCw className="w-3 h-3 mr-1" />Refresh Wajah
            </Button>
          )}
          {modelStatus === 'error' && (
            <Button size="sm" variant="ghost" onClick={loadFaceModels}
              className="text-red-400 hover:text-red-300 h-7 text-xs">
              Coba Lagi
            </Button>
          )}

          {/* Manual search */}
          <Dialog open={manualOpen} onOpenChange={setManualOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"
                className="border-slate-700 bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-700">
                <Search className="w-4 h-4 mr-2" />Cari Manual
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
              <DialogHeader><DialogTitle>Cari Visitor</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Cari nama atau nomor HP..." value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                    className="bg-slate-800/50 border-slate-700 text-white" />
                  <Button onClick={handleManualSearch} disabled={searching}
                    className="bg-blue-600 hover:bg-blue-500">
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((v) => {
                      const s = STATUS_MAP[v.status] || STATUS_MAP.registered
                      return (
                        <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                          <div>
                            <p className="text-sm font-medium text-white">{v.visitor_name}</p>
                            <p className="text-xs text-slate-400">{v.visitor_phone}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={s.color}>{s.label}</Badge>
                            {(v.status === 'registered' || v.status === 'arrived') && (
                              <Button size="sm" onClick={() => handleManualAction(v.id, v.status)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-xs h-7">
                                {v.status === 'registered' ? 'Check-in' : 'Checkout'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
                  <p className="text-sm text-slate-500 text-center py-4">Tidak ada hasil</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* AI loading notice */}
      {modelStatus === 'loading' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-950/20 border border-amber-700/30">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
          <p className="text-xs text-amber-300">{loadingStep}</p>
        </div>
      )}

      {/* ── MAIN 2-COLUMN LAYOUT: QR Left | Face Vision Right ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* ── LEFT: QR Scanner ── */}
        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-blue-400" />
                  QR Scanner
                </CardTitle>
                <Badge className={scannerActive && !processing
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}>
                  <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${scannerActive && !processing ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {processing ? 'Memproses...' : scannerActive ? 'Aktif' : 'Paused'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <QrScanner onScan={handleScan} isActive={scannerActive} />
              <p className="text-xs text-slate-600 text-center mt-2 flex items-center justify-center gap-1">
                <Volume2 className="w-3 h-3" />Pastikan volume aktif untuk feedback audio
              </p>
            </CardContent>
          </Card>

          {/* QR Scan Results — compact below the camera */}
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Hasil Scan QR Terakhir
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {lastResults.length === 0 ? (
                <div className="text-center py-6">
                  <ScanLine className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-600 text-xs">Belum ada scan — arahkan QR code ke kamera</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lastResults.map((result, i) => (
                    <Alert key={i} className={`py-2 px-3
                      ${result.type === 'success' ? 'border-emerald-500/30 bg-emerald-950/30'
                        : result.type === 'warning' ? 'border-amber-500/30 bg-amber-950/30'
                        : 'border-red-500/30 bg-red-950/30'}`}>
                      <div className="flex items-start gap-2">
                        {result.type === 'success'
                          ? <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          : result.type === 'warning'
                          ? <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                          : <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <AlertTitle className={`text-xs font-semibold
                            ${result.type === 'success' ? 'text-emerald-300'
                              : result.type === 'warning' ? 'text-amber-300' : 'text-red-300'}`}>
                            {result.message}
                          </AlertTitle>
                          {result.visit && (
                            <AlertDescription className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <User className="w-2.5 h-2.5" />{result.visit.visitor_name}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Phone className="w-2.5 h-2.5" />{result.visit.visitor_phone}
                              </span>
                              {result.visit.host && (
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                  <Building2 className="w-2.5 h-2.5" />{result.visit.host.full_name}
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Clock className="w-2.5 h-2.5" />{new Date().toLocaleTimeString('id-ID')}
                              </span>
                            </AlertDescription>
                          )}
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Face Vision ── */}
        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-400" />
                  Camera Vision
                </CardTitle>
                <Badge className={
                  modelStatus === 'ready' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : modelStatus === 'loading' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-slate-500/20 text-slate-400 border-slate-600/30'
                }>
                  {modelStatus === 'ready' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />}
                  {modelStatus === 'ready' ? 'LIVE' : modelStatus === 'loading' ? 'Memuat...' : 'Standby'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {modelStatus === 'idle' && (
                <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/50 flex flex-col items-center justify-center py-16 gap-3">
                  <Eye className="w-10 h-10 text-slate-600" />
                  <p className="text-slate-500 text-sm">Memuat model AI...</p>
                </div>
              )}
              {modelStatus === 'loading' && (
                <div className="rounded-xl border border-amber-700/30 bg-amber-950/10 flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                  <p className="text-amber-300 text-sm font-medium">Memuat AI Model...</p>
                  <p className="text-slate-500 text-xs">{loadingStep}</p>
                </div>
              )}
              {modelStatus === 'error' && (
                <div className="rounded-xl border border-red-700/30 bg-red-950/10 flex flex-col items-center justify-center py-16 gap-3">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                  <p className="text-red-300 text-sm">Gagal memuat model</p>
                  <Button size="sm" onClick={loadFaceModels} variant="outline"
                    className="border-red-700 text-red-300 hover:bg-red-950/30">
                    Coba Lagi
                  </Button>
                </div>
              )}
              {modelStatus === 'ready' && (
                <FaceRecognitionCamera
                  namedDescriptors={namedDescriptors}
                  onFaceDetected={handleFaceDetected}
                  isActive={true}
                />
              )}

              {modelStatus === 'ready' && namedDescriptors.length === 0 && (
                <p className="text-xs text-slate-600 text-center mt-2">
                  Belum ada wajah terdaftar hari ini. Tamu perlu mendaftar dulu melalui halaman Registrasi.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Detected faces panel */}
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
                Wajah Terdeteksi
                {detectedList.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold">
                    {detectedList.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {detectedList.length === 0 ? (
                <div className="text-center py-6">
                  <User className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-600 text-xs">
                    {modelStatus === 'ready'
                      ? 'Belum ada wajah teridentifikasi — posisikan wajah di kamera'
                      : 'Menunggu model AI siap...'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {detectedList.map((visitor) => {
                    const timeSince = Math.round((Date.now() - visitor.lastSeen.getTime()) / 1000)
                    const isRecent = timeSince < 3

                    return (
                      <div key={visitor.label}
                        className={`p-3 rounded-xl border transition-all ${isRecent
                          ? 'border-emerald-500/40 bg-emerald-950/20'
                          : 'border-slate-700 bg-slate-800/30'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isRecent ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                            <div>
                              <p className="text-sm font-semibold text-white leading-none">{visitor.label}</p>
                              <p className="text-xs text-emerald-400 mt-0.5">{visitor.confidence}% yakin</p>
                            </div>
                          </div>
                          <span className="text-xs text-slate-600 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />{timeSince}d lalu
                          </span>
                        </div>
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
