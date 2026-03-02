'use client'

import { useState, useEffect } from 'react'
import { listVisits } from '@/lib/actions/visits'
import type { VisitWithHost } from '@/lib/database.types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, Loader2 } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  registered: { label: 'Terdaftar', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  arrived: { label: 'Hadir', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  departed: { label: 'Checkout', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  canceled: { label: 'Dibatalkan', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  no_show: { label: 'No Show', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
}

export default function HostVisitorsPage() {
  const [visits, setVisits] = useState<VisitWithHost[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function fetchVisits() {
      const result = await listVisits({ date: today })
      if (result.data) setVisits(result.data.visits)
      setLoading(false)
    }
    fetchVisits()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Users className="w-7 h-7 text-blue-400" />
          Visitor Saya
        </h1>
        <p className="text-slate-400 text-sm mt-1">Visitor yang ditujukan kepada Anda hari ini</p>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
            </div>
          ) : visits.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">Tidak ada visitor yang ditujukan kepada Anda hari ini</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Nama</TableHead>
                  <TableHead className="text-slate-400">HP</TableHead>
                  <TableHead className="text-slate-400">Tujuan</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Waktu Hadir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => {
                  const status = STATUS_MAP[v.status] || STATUS_MAP.registered
                  return (
                    <TableRow key={v.id} className="border-slate-800">
                      <TableCell className="text-white font-medium">{v.visitor_name}</TableCell>
                      <TableCell className="text-slate-400 text-sm">{v.visitor_phone}</TableCell>
                      <TableCell className="text-slate-400 text-sm">{v.purpose}</TableCell>
                      <TableCell><Badge className={status.color}>{status.label}</Badge></TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {v.arrived_at ? new Date(v.arrived_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
