'use client'

import { useState, useEffect } from 'react'
import { getDashboardKPI, listVisits } from '@/lib/actions/visits'
import type { VisitWithHost } from '@/lib/database.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard, UserCheck, UserX, Users, LogOut,
  TrendingUp, Loader2, Lock
} from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  registered: { label: 'Terdaftar', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  arrived: { label: 'Hadir', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  departed: { label: 'Checkout', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  canceled: { label: 'Dibatalkan', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  no_show: { label: 'No Show', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<Record<string, number> | null>(null)
  const [recentVisits, setRecentVisits] = useState<VisitWithHost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const [kpiResult, visitsResult] = await Promise.all([
        getDashboardKPI(),
        listVisits({ date: new Date().toISOString().split('T')[0], limit: 10 }),
      ])
      if (kpiResult.data) setKpi(kpiResult.data)
      if (visitsResult.data) setRecentVisits(visitsResult.data.visits)
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-slate-600 animate-spin" />
      </div>
    )
  }

  const kpiCards = [
    { label: 'Total Terdaftar', value: kpi?.total || 0, icon: <Users className="w-5 h-5" />, color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/25' },
    { label: 'Sudah Hadir', value: kpi?.arrived || 0, icon: <UserCheck className="w-5 h-5" />, color: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-500/25' },
    { label: 'Checkout', value: kpi?.departed || 0, icon: <LogOut className="w-5 h-5" />, color: 'from-slate-400 to-slate-500', shadow: 'shadow-slate-500/25' },
    { label: 'No Show', value: kpi?.no_show || 0, icon: <UserX className="w-5 h-5" />, color: 'from-red-500 to-red-600', shadow: 'shadow-red-500/25' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <LayoutDashboard className="w-7 h-7 text-blue-400" />
          Dashboard
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Ringkasan kunjungan hari ini — {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <Card key={card.label} className="border-slate-800 bg-slate-900/50 backdrop-blur-xl overflow-hidden relative group hover:border-slate-700 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-lg ${card.shadow}`}>
                  {card.icon}
                </div>
                <TrendingUp className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-3xl font-bold text-white">{card.value}</p>
              <p className="text-xs text-slate-400 mt-1">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Visits */}
        <Card className="col-span-1 lg:col-span-2 border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-400">Kunjungan Terakhir</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentVisits.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Belum ada kunjungan hari ini</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="text-slate-400">Nama</TableHead>
                    <TableHead className="text-slate-400">Host</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentVisits.map((v) => {
                    const status = STATUS_MAP[v.status] || STATUS_MAP.registered
                    return (
                      <TableRow key={v.id} className="border-slate-800">
                        <TableCell className="text-white text-sm font-medium">{v.visitor_name}</TableCell>
                        <TableCell className="text-slate-400 text-sm">{v.host?.full_name || '-'}</TableCell>
                        <TableCell><Badge className={status.color}>{status.label}</Badge></TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {v.arrived_at ? new Date(v.arrived_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) :
                            new Date(v.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Occupancy Placeholder */}
        <Card className="border-slate-800 bg-slate-900/50 border-dashed">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Occupancy Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-3">
              <Users className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-500 text-sm font-medium">Coming Soon</p>
            <p className="text-slate-600 text-xs mt-1">YOLO Integration (Phase 2)</p>
            <Separator className="bg-slate-800 my-4" />
            <div className="text-xs text-slate-600 space-y-1">
              <p>Hook: <code className="text-slate-500">occupancy_events</code></p>
              <p>API: <code className="text-slate-500">ingestCameraEvent()</code></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
