'use client'

import { useState, useEffect } from 'react'
import { listVisits, manualMark } from '@/lib/actions/visits'
import type { VisitWithHost } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Users, Search, MoreHorizontal, LogIn, LogOut, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  registered: { label: 'Terdaftar', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  arrived: { label: 'Hadir', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  departed: { label: 'Checkout', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  canceled: { label: 'Dibatalkan', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  no_show: { label: 'No Show', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
}

export default function VisitorsPage() {
  const [visits, setVisits] = useState<VisitWithHost[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Default to today in WIB (UTC+7)
  const todayWib = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(todayWib)

  async function fetchVisits() {
    setLoading(true)
    const result = await listVisits({
      date: selectedDate,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search || undefined,
    })
    if (result.data) {
      setVisits(result.data.visits)
      setTotal(result.data.total)
    }
    setLoading(false)
  }

  useEffect(() => { fetchVisits() }, [statusFilter, selectedDate])

  const handleAction = async (visitId: string, action: 'arrive' | 'depart') => {
    const result = await manualMark(visitId, action)
    if (result.error) {
      toast.error(result.error.message)
    } else {
      toast.success(action === 'arrive' ? 'Check-in berhasil' : 'Checkout berhasil')
      fetchVisits()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-400" />
            Visitor
          </h1>
          <p className="text-slate-400 text-sm mt-1">{selectedDate} — {total} visitor</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-800/50 border-slate-700 text-white w-40"
          />
          <Button variant="outline" size="sm" onClick={fetchVisits}
            className="border-slate-700 bg-slate-800/50 text-slate-300 hover:text-white">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="pt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="Cari nama atau HP..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchVisits()}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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

      {/* Table */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
            </div>
          ) : visits.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">Belum ada visitor hari ini</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Nama</TableHead>
                  <TableHead className="text-slate-400">HP</TableHead>
                  <TableHead className="text-slate-400">Yang Dituju</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Arrived</TableHead>
                  <TableHead className="text-slate-400">Departed</TableHead>
                  <TableHead className="text-slate-400 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => {
                  const status = STATUS_MAP[v.status] || STATUS_MAP.registered
                  return (
                    <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/40">
                      <TableCell className="text-white font-medium">{v.visitor_name}</TableCell>
                      <TableCell className="text-slate-400 text-sm">{v.visitor_phone}</TableCell>
                      <TableCell className="text-slate-400 text-sm">{v.host?.full_name || '-'}</TableCell>
                      <TableCell>
                        <Badge className={status.color}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {v.arrived_at ? new Date(v.arrived_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {v.departed_at ? new Date(v.departed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {(v.status === 'registered' || v.status === 'arrived') && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-slate-800 border-slate-700">
                              {v.status === 'registered' && (
                                <DropdownMenuItem onClick={() => handleAction(v.id, 'arrive')}
                                  className="text-emerald-300 hover:text-emerald-200 cursor-pointer">
                                  <LogIn className="w-4 h-4 mr-2" />Check-in
                                </DropdownMenuItem>
                              )}
                              {v.status === 'arrived' && (
                                <DropdownMenuItem onClick={() => handleAction(v.id, 'depart')}
                                  className="text-slate-300 hover:text-white cursor-pointer">
                                  <LogOut className="w-4 h-4 mr-2" />Checkout
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
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
