import { NextRequest, NextResponse } from 'next/server'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Public routes - skip auth check
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/login' ||
    pathname === '/invite' ||
    pathname.startsWith('/invite') ||
    pathname === '/reset-password'
  ) {
    return NextResponse.next()
  }

  // Read NextAuth session token from cookie
  const sessionToken =
    req.cookies.get('authjs.session-token')?.value ||
    req.cookies.get('__Secure-authjs.session-token')?.value

  const isLoggedIn = !!sessionToken

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    if (pathname !== '/login') {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
