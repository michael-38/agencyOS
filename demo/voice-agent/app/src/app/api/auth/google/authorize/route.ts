import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getGoogleAuthUrl } from '@/lib/google-calendar'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as { userId?: string; role?: string }
  if (user.role !== 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = getGoogleAuthUrl(user.userId!)
  return NextResponse.redirect(url)
}
