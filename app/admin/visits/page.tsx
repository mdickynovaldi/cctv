'use client'

import { useState, useEffect } from 'react'
import { listVisits } from '@/lib/actions/visits'
import type { VisitWithHost } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, Search, Download, Loader2 } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  registered: { label: 'Terdaftar', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  arrived: { label: 'Hadir', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  departed: { label: 'Checkout', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  canceled: { label: 'Dibatalkan', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  no_show: { label: 'No Show', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
}

export default function AdminVisitsPage() {
  const [visits, setVisits] = useState<VisitWithHost[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0])
  const [page, setPage] = useState(1)
  const limit = 20

  async function fetchVisits() {
    setLoading(true)
    const result = await listVisits({
      date: dateFrom,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search || undefined,
      page,
      limit,
    })
    if (result.data) {
      setVisits(result.data.visits)
      setTotal(result.data.total)
    }
    setLoading(false)
  }

  useEffect(() => { fetchVisits() }, [statusFilter, page, dateFrom])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-400" />
            Semua Kunjungan
          </h1>
          <p className="text-slate-400 text-sm mt-1">{total} kunjungan ditemukan</p>
        </div>
        <Button variant="outline" disabled
          className="border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed">
          <Download className="w-4 h-4 mr-2" />Export CSV (Phase 2)
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="pt-4">
          <div className="flex gap-3 flex-wrap">
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="w-44 bg-slate-800/50 border-slate-700 text-white" />
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="Cari nama atau HP..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchVisits()}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-40 bg-slate-800/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all" className="text-white">Semua Status</SelectItem>
                <SelectItem value="registered" className="text-white">Terdaftar</SelectItem>
                <SelectItem value="arrived" className="text-white">Hadir</SelectItem>
                <SelectItem value="departed" className="text-white">Checkout</SelectItem>
                <SelectItem value="canceled" className="text-white">Dibatalkan</SelectItem>
                <SelectItem value="no_show" className="text-white">No Show</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchVisits} className="bg-blue-600 hover:bg-blue-500">
              <Search className="w-4 h-4 mr-2" />Cari
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
            </div>
          ) : visits.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">Tidak ada kunjungan</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Nama</TableHead>
                  <TableHead className="text-slate-400">HP</TableHead>
                  <TableHead className="text-slate-400">Tujuan</TableHead>
                  <TableHead className="text-slate-400">Host</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Tanggal</TableHead>
                  <TableHead className="text-slate-400">Arrived</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => {
                  const status = STATUS_MAP[v.status] || STATUS_MAP.registered
                  return (
                    <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/40">
                      <TableCell className="text-white font-medium">{v.visitor_name}</TableCell>
                      <TableCell className="text-slate-400 text-sm">{v.visitor_phone}</TableCell>
                      <TableCell className="text-slate-400 text-sm max-w-[150px] truncate">{v.purpose}</TableCell>
                      <TableCell className="text-slate-400 text-sm">{v.host?.full_name || '-'}</TableCell>
                      <TableCell><Badge className={status.color}>{status.label}</Badge></TableCell>
                      <TableCell className="text-slate-400 text-sm">{v.planned_date}</TableCell>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="border-slate-700 bg-slate-800/50 text-slate-300">
            Sebelumnya
          </Button>
          <span className="text-sm text-slate-400 flex items-center px-3">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="border-slate-700 bg-slate-800/50 text-slate-300">
            Selanjutnya
          </Button>
        </div>
      )}
    </div>
  )
}
