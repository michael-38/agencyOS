import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

type Params = { params: Promise<{ clientId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { clientId } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { role?: string; userId?: string }

  if (user.role === 'client' && user.userId !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (user.role !== 'admin' && user.role !== 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('id, name, business_name, email, status, google_calendar_id, created_at, updated_at')
    .eq('id', clientId)
    .single()

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { clientId } = await params
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = ['name', 'business_name', 'email', 'status', 'google_calendar_id']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }
  update.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update(update)
    .eq('id', clientId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { clientId } = await params
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const hard = new URL(req.url).searchParams.get('hard') === 'true'

  if (hard) {
    // Permanently delete the client record
    const { error } = await supabaseAdmin
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // Soft delete — set status to inactive
    const { error } = await supabaseAdmin
      .from('clients')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', clientId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
