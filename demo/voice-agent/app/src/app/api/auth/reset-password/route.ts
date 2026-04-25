import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// POST — request a password reset (generates token)
export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

  // Check admins
  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('id')
    .eq('email', email)
    .single()

  if (admin) {
    await supabaseAdmin
      .from('admins')
      .update({ reset_token: token, reset_token_expires_at: expiresAt })
      .eq('id', admin.id)
  }

  // Check clients
  let found = !!admin
  if (!admin) {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('email', email)
      .eq('status', 'active')
      .single()

    if (client) {
      found = true
      await supabaseAdmin
        .from('clients')
        .update({ reset_token: token, reset_token_expires_at: expiresAt })
        .eq('id', client.id)
    }
  }

  if (found) {
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`
    try {
      await sendPasswordResetEmail(email, resetUrl)
    } catch (e) {
      console.error('[Password Reset] Email failed:', e)
    }
  }

  // Always return success to prevent email enumeration
  return NextResponse.json({ ok: true })
}

// PUT — complete the password reset
export async function PUT(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  }
  if (password.length < 5) {
    return NextResponse.json({ error: 'Password must be at least 5 characters' }, { status: 400 })
  }

  const hash = await bcrypt.hash(password, 12)

  // Try admins
  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('id, reset_token_expires_at')
    .eq('reset_token', token)
    .single()

  if (admin) {
    if (new Date(admin.reset_token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Reset link has expired' }, { status: 410 })
    }
    const { error } = await supabaseAdmin
      .from('admins')
      .update({
        password_hash: hash,
        reset_token: null,
        reset_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', admin.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Try clients
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, reset_token_expires_at')
    .eq('reset_token', token)
    .single()

  if (client) {
    if (new Date(client.reset_token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Reset link has expired' }, { status: 410 })
    }
    const { error } = await supabaseAdmin
      .from('clients')
      .update({
        password_hash: hash,
        reset_token: null,
        reset_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 404 })
}
