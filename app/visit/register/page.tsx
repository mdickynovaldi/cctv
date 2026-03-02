'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createVisit } from '@/lib/actions/visits'
import { listHosts } from '@/lib/actions/visits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserPlus, Loader2, Building2, Camera, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'

const FaceCaptureStep = dynamic(() => import('@/components/face/face-capture-step'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
    </div>
  ),
})

type Step = 'form' | 'face'

export default function VisitRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [hosts, setHosts] = useState<{ id: string; full_name: string; department: string | null }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [createdVisit, setCreatedVisit] = useState<{ visit_id: string; qr_token: string; visitor_name: string } | null>(null)

  // Get today's date in WIB (UTC+7) timezone for the form default
  const todayWib = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0]

  useEffect(() => {
    async function fetchHosts() {
      const result = await listHosts()
      if (result.data) setHosts(result.data)
    }
    fetchHosts()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const data = {
      visitor_name: form.get('visitor_name') as string,
      visitor_email: form.get('visitor_email') as string,
      visitor_phone: form.get('visitor_phone') as string,
      purpose: form.get('purpose') as string,
      host_id: form.get('host_id') as string,
      planned_date: form.get('planned_date') as string,
      planned_time: form.get('planned_time') as string,
    }

    const result = await createVisit(data)
    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    setCreatedVisit({
      visit_id: result.data!.visit_id,
      qr_token: result.data!.qr_token,
      visitor_name: data.visitor_name,
    })
    setLoading(false)
    toast.success('Data berhasil disimpan! Sekarang ambil foto wajah.')
    setStep('face')
  }

  function handleFaceComplete() {
    toast.success('Registrasi selesai!')
    router.push(`/visit/${createdVisit!.qr_token}/qr`)
  }

  function handleFaceSkip() {
    router.push(`/visit/${createdVisit!.qr_token}/qr`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

      <Card className="w-full max-w-lg relative z-10 border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-emerald-950/50">
        <CardHeader className="text-center space-y-4">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${step === 'form' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border border-slate-700 text-slate-500'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold
                ${step === 'form' ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-slate-300'}`}>1</span>
              Data Diri
            </div>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${step === 'face' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border border-slate-700 text-slate-500'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold
                ${step === 'face' ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-slate-300'}`}>2</span>
              Foto Wajah
            </div>
          </div>

          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            {step === 'form' ? <UserPlus className="w-8 h-8 text-white" /> : <Camera className="w-8 h-8 text-white" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              {step === 'form' ? 'Registrasi Kunjungan' : 'Foto Wajah'}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              {step === 'form'
                ? 'Isi data di bawah untuk mendaftar kunjungan'
                : 'Ambil foto wajah dari beberapa sudut untuk pengenalan otomatis'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {/* STEP 1: Form */}
          {step === 'form' && (
            <>
              {error && (
                <Alert variant="destructive" className="mb-4 border-red-900/50 bg-red-950/50">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="visitor_name" className="text-slate-300">Nama Lengkap *</Label>
                  <Input id="visitor_name" name="visitor_name" placeholder="Nama lengkap Anda" required
                    className="bg-slate-800/50 border-slate-700 focus:border-emerald-500 text-white placeholder:text-slate-500" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="visitor_email" className="text-slate-300">Email</Label>
                    <Input id="visitor_email" name="visitor_email" type="email" placeholder="email@contoh.com"
                      className="bg-slate-800/50 border-slate-700 focus:border-emerald-500 text-white placeholder:text-slate-500" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visitor_phone" className="text-slate-300">No. HP *</Label>
                    <Input id="visitor_phone" name="visitor_phone" placeholder="08xxxxxxxxxx" required
                      className="bg-slate-800/50 border-slate-700 focus:border-emerald-500 text-white placeholder:text-slate-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="host_id" className="text-slate-300">Yang Dituju *</Label>
                  <Select name="host_id" required>
                    <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                      <SelectValue placeholder="Pilih host / PIC" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {hosts.map((host) => (
                        <SelectItem key={host.id} value={host.id} className="text-white hover:bg-slate-700">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            {host.full_name} {host.department && `(${host.department})`}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purpose" className="text-slate-300">Tujuan Kunjungan *</Label>
                  <Textarea id="purpose" name="purpose" placeholder="Contoh: Meeting proyek, Interview, Pengiriman dokumen..." required rows={3}
                    className="bg-slate-800/50 border-slate-700 focus:border-emerald-500 text-white placeholder:text-slate-500 resize-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="planned_date" className="text-slate-300">Tanggal Kunjungan *</Label>
                    <Input id="planned_date" name="planned_date" type="date" required
                      defaultValue={todayWib}
                      min={todayWib}
                      className="bg-slate-800/50 border-slate-700 focus:border-emerald-500 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planned_time" className="text-slate-300">Jam (opsional)</Label>
                    <Input id="planned_time" name="planned_time" type="time"
                      className="bg-slate-800/50 border-slate-700 focus:border-emerald-500 text-white" />
                  </div>
                </div>

                {/* Face registration notice */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-950/30 border border-blue-700/30">
                  <Camera className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-300">
                    Setelah mengisi form ini, Anda akan diminta untuk mengambil <strong>foto wajah</strong> dari beberapa sudut.
                    Ini memungkinkan sistem mengenali Anda secara otomatis.
                  </p>
                </div>

                <Button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-600/25 transition-all duration-300 mt-2">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mendaftarkan...</>
                  ) : (
                    <><UserPlus className="w-4 h-4 mr-2" />Lanjut ke Foto Wajah</>
                  )}
                </Button>
              </form>
            </>
          )}

          {/* STEP 2: Face Capture */}
          {step === 'face' && createdVisit && (
            <FaceCaptureStep
              visitId={createdVisit.visit_id}
              visitorName={createdVisit.visitor_name}
              onComplete={handleFaceComplete}
              onSkip={handleFaceSkip}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
