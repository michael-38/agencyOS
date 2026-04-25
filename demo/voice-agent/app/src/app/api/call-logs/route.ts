import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { role?: string; userId?: string }
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agentId')
  const clientId = searchParams.get('clientId')
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = supabaseAdmin
    .from('call_logs')
    .select('*, agents(name, client_id, clients(business_name))')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (agentId) {
    query = query.eq('agent_id', agentId)
  } else if (user.role === 'client') {
    // Client can only see their own agent's logs
    const { data: agents } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('client_id', user.userId!)

    const agentIds = (agents || []).map((a: { id: string }) => a.id)
    if (agentIds.length === 0) return NextResponse.json([])
    query = query.in('agent_id', agentIds)
  } else if (clientId && user.role === 'admin') {
    const { data: agents } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('client_id', clientId)

    const agentIds = (agents || []).map((a: { id: string }) => a.id)
    if (agentIds.length === 0) return NextResponse.json([])
    query = query.in('agent_id', agentIds)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
