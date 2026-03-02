'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Building2, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function HostsPage() {
  const [hosts, setHosts] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editHost, setEditHost] = useState<Profile | null>(null)
  const supabase = createClient()

  async function fetchHosts() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('role', 'host').order('full_name')
    setHosts(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchHosts() }, [])

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const hostData = {
      full_name: form.get('full_name') as string,
      email: form.get('email') as string,
      phone: form.get('phone') as string || null,
      department: form.get('department') as string || null,
    }

    if (editHost) {
      const { error } = await supabase.from('profiles').update(hostData as never).eq('id', editHost.id)
      if (error) { toast.error('Gagal mengupdate host'); return }
      toast.success('Host berhasil diupdate')
    } else {
      toast.info('Untuk menambah host, buat akun user baru dengan role host melalui Supabase Dashboard')
    }
    setDialogOpen(false)
    setEditHost(null)
    fetchHosts()
  }

  async function handleDeactivate(hostId: string) {
    const { error } = await supabase.from('profiles').update({ is_active: false } as never).eq('id', hostId)
    if (error) { toast.error('Gagal menonaktifkan host'); return }
    toast.success('Host dinonaktifkan')
    fetchHosts()
  }

  async function handleActivate(hostId: string) {
    const { error } = await supabase.from('profiles').update({ is_active: true } as never).eq('id', hostId)
    if (error) { toast.error('Gagal mengaktifkan host'); return }
    toast.success('Host diaktifkan kembali')
    fetchHosts()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-400" />Kelola Host / PIC
          </h1>
          <p className="text-slate-400 text-sm mt-1">{hosts.length} host terdaftar</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditHost(null) }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="w-4 h-4 mr-2" />Tambah Host</Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle>{editHost ? 'Edit Host' : 'Tambah Host'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Nama Lengkap *</Label>
                <Input name="full_name" required defaultValue={editHost?.full_name}
                  className="bg-slate-800/50 border-slate-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Email *</Label>
                <Input name="email" type="email" required defaultValue={editHost?.email}
                  className="bg-slate-800/50 border-slate-700 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-slate-300">No. HP</Label>
                  <Input name="phone" defaultValue={editHost?.phone || ''}
                    className="bg-slate-800/50 border-slate-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Departemen</Label>
                  <Input name="department" defaultValue={editHost?.department || ''}
                    className="bg-slate-800/50 border-slate-700 text-white" />
                </div>
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500">Simpan</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Nama</TableHead>
                  <TableHead className="text-slate-400">Email</TableHead>
                  <TableHead className="text-slate-400">HP</TableHead>
                  <TableHead className="text-slate-400">Departemen</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hosts.map((h) => (
                  <TableRow key={h.id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell className="text-white font-medium">{h.full_name}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{h.email}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{h.phone || '-'}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{h.department || '-'}</TableCell>
                    <TableCell>
                      <Badge className={h.is_active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}>
                        {h.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon"
                          onClick={() => { setEditHost(h); setDialogOpen(true) }}
                          className="text-slate-400 hover:text-white">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {h.is_active ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-400">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-slate-900 border-slate-800">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">Nonaktifkan Host?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-400">
                                  Host tidak akan muncul di form registrasi visitor. Data kunjungan tetap tersimpan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-slate-700 text-slate-300">Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeactivate(h.id)}
                                  className="bg-red-600 hover:bg-red-500">Nonaktifkan</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleActivate(h.id)}
                            className="text-emerald-400 hover:text-emerald-300 text-xs">Aktifkan</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
