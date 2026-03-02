'use client'

import { useEffect, useState, useTransition } from 'react'
import { UserCog, Plus, Pencil, Trash2, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import type { Profile, UserRole } from '@/lib/database.types'
import { listUsers, createUser, updateUser, toggleUserActive, deleteUser } from '@/lib/actions/users'
import type { CreateUserData, UpdateUserData } from '@/lib/validators/user'

// ========== ROLE CONFIG ==========
const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  receptionist: { label: 'Resepsionis', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  host: { label: 'Host / PIC', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
}

// ========== ADD USER DIALOG ==========
function AddUserDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [formData, setFormData] = useState<CreateUserData>({
    full_name: '',
    email: '',
    password: '',
    role: 'host',
    phone: '',
    department: '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createUser(formData)
      if (result.error) {
        toast.error(result.error.message)
      } else {
        toast.success(`User "${formData.full_name}" berhasil ditambahkan`)
        setFormData({ full_name: '', email: '', password: '', role: 'host', phone: '', department: '' })
        setOpen(false)
        onSuccess()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Tambah User
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Tambah User Baru</DialogTitle>
          <DialogDescription className="text-slate-400">
            Buat akun baru untuk admin, resepsionis, atau host/PIC.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Nama Lengkap *</Label>
            <Input
              required
              placeholder="Nama lengkap"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Email *</Label>
            <Input
              required
              type="email"
              placeholder="email@contoh.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Password *</Label>
            <Input
              required
              type="password"
              placeholder="Minimal 6 karakter"
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Role *</Label>
            <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v as UserRole })}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Pilih role" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="admin" className="text-white hover:bg-slate-700">Admin</SelectItem>
                <SelectItem value="receptionist" className="text-white hover:bg-slate-700">Resepsionis</SelectItem>
                <SelectItem value="host" className="text-white hover:bg-slate-700">Host / PIC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-300">Telepon</Label>
              <Input
                placeholder="08xxxxxxxxx"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Department</Label>
              <Input
                placeholder="Dept / Divisi"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              Batal
            </Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ========== EDIT USER DIALOG ==========
function EditUserDialog({ user, onSuccess }: { user: Profile; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [formData, setFormData] = useState<UpdateUserData>({
    full_name: user.full_name,
    role: user.role,
    phone: user.phone || '',
    department: user.department || '',
    is_active: user.is_active,
  })

  // Sync form data when user prop changes
  useEffect(() => {
    setFormData({
      full_name: user.full_name,
      role: user.role,
      phone: user.phone || '',
      department: user.department || '',
      is_active: user.is_active,
    })
  }, [user])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateUser(user.id, formData)
      if (result.error) {
        toast.error(result.error.message)
      } else {
        toast.success(`User "${formData.full_name}" berhasil diupdate`)
        setOpen(false)
        onSuccess()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Edit User</DialogTitle>
          <DialogDescription className="text-slate-400">
            Update informasi untuk {user.full_name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Nama Lengkap *</Label>
            <Input
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Role *</Label>
            <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v as UserRole })}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="admin" className="text-white hover:bg-slate-700">Admin</SelectItem>
                <SelectItem value="receptionist" className="text-white hover:bg-slate-700">Resepsionis</SelectItem>
                <SelectItem value="host" className="text-white hover:bg-slate-700">Host / PIC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-300">Telepon</Label>
              <Input
                placeholder="08xxxxxxxxx"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Department</Label>
              <Input
                placeholder="Dept / Divisi"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-3">
            <div>
              <Label className="text-slate-300">Status Aktif</Label>
              <p className="text-xs text-slate-500 mt-0.5">User nonaktif tidak bisa login</p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              Batal
            </Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ========== DELETE USER DIALOG ==========
function DeleteUserDialog({ user, onSuccess }: { user: Profile; onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteUser(user.id)
      if (result.error) {
        toast.error(result.error.message)
      } else {
        toast.success(`User "${user.full_name}" berhasil dihapus`)
        onSuccess()
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-slate-900 border-slate-800">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">Hapus User</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            Yakin ingin menghapus <span className="font-semibold text-white">{user.full_name}</span> ({user.email})?
            Akun dan semua data terkait akan dihapus permanen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menghapus...</> : 'Hapus User'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ========== MAIN PAGE ==========
export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  async function fetchUsers() {
    setLoading(true)
    const result = await listUsers()
    if (result.error) {
      toast.error(result.error.message)
    } else {
      setUsers(result.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  async function handleToggleActive(userId: string, isActive: boolean) {
    const result = await toggleUserActive(userId, isActive)
    if (result.error) {
      toast.error(result.error.message)
    } else {
      toast.success(isActive ? 'User diaktifkan' : 'User dinonaktifkan')
      fetchUsers()
    }
  }

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchSearch = search === '' ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(search.toLowerCase()))
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  // Stats
  const stats = {
    total: users.length,
    admin: users.filter((u) => u.role === 'admin').length,
    receptionist: users.filter((u) => u.role === 'receptionist').length,
    host: users.filter((u) => u.role === 'host').length,
    active: users.filter((u) => u.is_active).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <UserCog className="w-7 h-7 text-blue-400" />
            Kelola User
          </h1>
          <p className="text-slate-400 text-sm mt-1">Kelola akun admin, resepsionis, dan host/PIC</p>
        </div>
        <AddUserDialog onSuccess={fetchUsers} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Admin', value: stats.admin, color: 'text-red-400' },
          { label: 'Resepsionis', value: stats.receptionist, color: 'text-blue-400' },
          { label: 'Host / PIC', value: stats.host, color: 'text-emerald-400' },
          { label: 'Aktif', value: stats.active, color: 'text-yellow-400' },
        ].map((stat) => (
          <Card key={stat.label} className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Cari nama, email, atau department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-44 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Filter role" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all" className="text-white hover:bg-slate-700">Semua Role</SelectItem>
                <SelectItem value="admin" className="text-white hover:bg-slate-700">Admin</SelectItem>
                <SelectItem value="receptionist" className="text-white hover:bg-slate-700">Resepsionis</SelectItem>
                <SelectItem value="host" className="text-white hover:bg-slate-700">Host / PIC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <UserCog className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">
                {search || roleFilter !== 'all' ? 'Tidak ada user yang cocok dengan filter' : 'Belum ada user'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Nama</TableHead>
                    <TableHead className="text-slate-400">Email</TableHead>
                    <TableHead className="text-slate-400">Role</TableHead>
                    <TableHead className="text-slate-400">Department</TableHead>
                    <TableHead className="text-slate-400">Telepon</TableHead>
                    <TableHead className="text-slate-400 text-center">Status</TableHead>
                    <TableHead className="text-slate-400 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const roleConfig = ROLE_CONFIG[user.role]
                    return (
                      <TableRow key={user.id} className="border-slate-800/50 hover:bg-slate-800/30">
                        <TableCell className="font-medium text-white">
                          {user.full_name}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${roleConfig.color} text-xs`}>
                            {roleConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {user.department || <span className="text-slate-600">-</span>}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {user.phone || <span className="text-slate-600">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={user.is_active}
                            onCheckedChange={(checked) => handleToggleActive(user.id, checked)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <EditUserDialog user={user} onSuccess={fetchUsers} />
                            <DeleteUserDialog user={user} onSuccess={fetchUsers} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
