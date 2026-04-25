import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendInviteEmail } from '@/lib/email'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('clients')
    .select('id, invite_expires_at')
    .eq('invite_token', token)
    .single()

  if (!data) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 410 })
  }

  return NextResponse.json({ clientId: data.id })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { clientId, password } = body

  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

  // If password is provided, this is invite acceptance (no auth required)
  if (password) {
    const hash = await bcrypt.hash(password, 12)
    const { error } = await supabaseAdmin
      .from('clients')
      .update({
        password_hash: hash,
        status: 'active',
        invite_token: null,
        invite_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Otherwise, generate invite token (admin only)
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('clients')
    .update({
      invite_token: token,
      invite_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite?token=${token}`

  // Fetch client info to send email
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('name, email')
    .eq('id', clientId)
    .single()

  if (client) {
    try {
      await sendInviteEmail(client.email, client.name, inviteUrl)
    } catch (e) {
      console.error('[Invite] Email failed, link still generated:', e)
    }
  }

  return NextResponse.json({ inviteUrl, token })
}
