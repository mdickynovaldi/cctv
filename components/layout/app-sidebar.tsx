'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  ScanLine, Users, LayoutDashboard, Settings, Building2, UserCog,
  LogOut, Menu, ShieldCheck, ChevronRight, Eye
} from 'lucide-react'
import type { UserRole } from '@/lib/database.types'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { label: 'Scanner QR', href: '/receptionist/scanner', icon: <ScanLine className="w-4 h-4" />, roles: ['admin', 'receptionist'] },
  { label: 'Camera Vision', href: '/receptionist/vision', icon: <Eye className="w-4 h-4" />, roles: ['admin', 'receptionist'] },
  { label: 'Visitor Hari Ini', href: '/receptionist/visitors', icon: <Users className="w-4 h-4" />, roles: ['admin', 'receptionist'] },
  { label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, roles: ['admin'] },
  { label: 'Semua Kunjungan', href: '/admin/visits', icon: <Users className="w-4 h-4" />, roles: ['admin'] },
  { label: 'Kelola Host', href: '/admin/hosts', icon: <Building2 className="w-4 h-4" />, roles: ['admin'] },
  { label: 'Kelola User', href: '/admin/users', icon: <UserCog className="w-4 h-4" />, roles: ['admin'] },
  { label: 'Pengaturan', href: '/admin/settings', icon: <Settings className="w-4 h-4" />, roles: ['admin'] },
  { label: 'Visitor Saya', href: '/host/visitors', icon: <Users className="w-4 h-4" />, roles: ['host'] },
]

function SidebarContent({ role, currentPath }: { role: UserRole; currentPath: string }) {
  const filteredItems = navItems.filter((item) => item.roles.includes(role))

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">VMS</h1>
            <p className="text-xs text-slate-400 capitalize">{role}</p>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-800" />

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredItems.map((item) => {
          const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
                ${isActive
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'}`}>
              {item.icon}
              {item.label}
              {isActive && <ChevronRight className="w-4 h-4 ml-auto text-blue-400" />}
            </Link>
          )
        })}
      </nav>

      <Separator className="bg-slate-800" />

      {/* Logout */}
      <div className="p-4">
        <form action={signOut}>
          <Button variant="ghost" type="submit"
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10">
            <LogOut className="w-4 h-4 mr-3" />
            Keluar
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function AppSidebar({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl fixed inset-y-0 left-0 z-30">
        <SidebarContent role={role} currentPath={pathname} />
      </aside>

      {/* Mobile Header + Sheet */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 flex items-center px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-slate-900 border-slate-800">
            <SidebarContent role={role} currentPath={pathname} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2 ml-3">
          <ShieldCheck className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-white">VMS</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
