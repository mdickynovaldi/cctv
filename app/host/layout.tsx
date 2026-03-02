import { getCurrentUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import AppSidebar from '@/components/layout/app-sidebar'
import type { UserRole } from '@/lib/database.types'

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!['admin', 'host'].includes(user.role)) redirect('/')

  return <AppSidebar role={user.role as UserRole}>{children}</AppSidebar>
}
