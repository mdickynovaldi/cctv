import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Public routes - no auth needed
  if (
    path.startsWith('/visit') ||
    path === '/' ||
    path.startsWith('/api/camera-event')
  ) {
    return supabaseResponse
  }

  // Login page: if user is authenticated, redirect to their dashboard
  if (path.startsWith('/login')) {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profile?.role
      if (role) {
        const url = request.nextUrl.clone()
        switch (role) {
          case 'admin':
            url.pathname = '/admin/dashboard'
            break
          case 'receptionist':
            url.pathname = '/receptionist/scanner'
            break
          default:
            url.pathname = '/host/visitors'
        }
        return NextResponse.redirect(url)
      }
    }
    // Not authenticated or no profile role - show login page
    return supabaseResponse
  }

  // Not authenticated - redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // If no profile found, allow access (the layout will handle auth)
  if (!role) {
    return supabaseResponse
  }

  // Role-based access control
  if (path.startsWith('/admin') && role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = role === 'receptionist' ? '/receptionist/scanner' : '/host/visitors'
    return NextResponse.redirect(url)
  }

  if (path.startsWith('/receptionist') && !['admin', 'receptionist'].includes(role)) {
    const url = request.nextUrl.clone()
    url.pathname = role === 'host' ? '/host/visitors' : '/login'
    return NextResponse.redirect(url)
  }

  if (path.startsWith('/host') && !['admin', 'host'].includes(role)) {
    const url = request.nextUrl.clone()
    url.pathname = role === 'receptionist' ? '/receptionist/scanner' : '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
