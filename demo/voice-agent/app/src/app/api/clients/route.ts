import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendInviteEmail } from '@/lib/email'
import crypto from 'crypto'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireAdmin(session: any) {
  return session?.user?.role === 'admin'
}

export async function GET() {
  const session = await auth()
  if (!requireAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id, name, business_name, email, status, google_calendar_id, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!requireAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, business_name, email } = body

  if (!name || !business_name || !email) {
    return NextResponse.json({ error: 'name, business_name, and email are required' }, { status: 400 })
  }

  const user = session!.user as { userId?: string }

  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('id')
    .eq('id', user.userId)
    .single()

  if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })

  // Generate invite token at creation time
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      name, business_name, email, admin_id: admin.id, status: 'invited',
      invite_token: token, invite_expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send invite email
  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite?token=${token}`
  try {
    await sendInviteEmail(email, name, inviteUrl)
  } catch (e) {
    console.error('[Client Create] Invite email failed, client still created:', e)
  }

  return NextResponse.json(data, { status: 201 })
}
