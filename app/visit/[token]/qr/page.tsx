'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getVisitByQR } from '@/lib/actions/visits'
import type { VisitWithHost } from '@/lib/database.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { QrCode, Download, CheckCircle, User, Building2, Calendar, Clock, Loader2 } from 'lucide-react'
import QRCode from 'qrcode'

export default function QRDisplayPage() {
  const params = useParams()
  const token = params.token as string
  const [visit, setVisit] = useState<VisitWithHost | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchVisit() {
      const result = await getVisitByQR(token)
      if (result.error) {
        setError(result.error.message)
        setLoading(false)
        return
      }
      setVisit(result.data)

      // Generate QR code
      const qr = await QRCode.toDataURL(token, {
        width: 300,
        margin: 2,
        color: { dark: '#ffffff', light: '#00000000' },
      })
      setQrDataUrl(qr)
      setLoading(false)
    }
    fetchVisit()
  }, [token])

  function handleDownload() {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.download = `qr-visit-${token.slice(0, 8)}.png`
    link.href = qrDataUrl
    link.click()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
        <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
      </div>
    )
  }

  if (error || !visit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 p-4">
        <Card className="w-full max-w-md border-red-900/50 bg-slate-900/80 backdrop-blur-xl">
          <CardContent className="pt-6 text-center">
            <p className="text-red-400 text-lg">{error || 'Kunjungan tidak ditemukan'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

      <Card className="w-full max-w-md relative z-10 border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <CheckCircle className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-white">Registrasi Berhasil!</CardTitle>
          <CardDescription className="text-slate-400">
            Tunjukkan QR code ini kepada resepsionis saat Anda tiba
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-56 h-56" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center">
                  <QrCode className="w-24 h-24 text-slate-600" />
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-slate-800" />

          {/* Visit Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Nama</span>
              <span className="text-sm text-white ml-auto font-medium">{visit.visitor_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Yang Dituju</span>
              <span className="text-sm text-white ml-auto font-medium">
                {visit.host?.full_name || '-'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Tanggal</span>
              <span className="text-sm text-white ml-auto font-medium">{visit.planned_date}</span>
            </div>
            {visit.planned_time && (
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">Jam</span>
                <span className="text-sm text-white ml-auto font-medium">{visit.planned_time}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <QrCode className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Status</span>
              <Badge className="ml-auto bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30">
                Terdaftar
              </Badge>
            </div>
          </div>

          <Button onClick={handleDownload}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-600/25">
            <Download className="w-4 h-4 mr-2" />
            Download QR Code
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
