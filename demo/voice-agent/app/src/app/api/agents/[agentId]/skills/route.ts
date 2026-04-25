import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { updateVapiAssistant, buildVapiAssistantPayload } from '@/lib/vapi'
import type { Skill } from '@/types'

type Params = { params: Promise<{ agentId: string }> }

async function syncSkillsToVapi(agentId: string) {
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('*, skills(*)')
    .eq('id', agentId)
    .single()

  if (!agent?.vapi_assistant_id) return

  const vapiPayload = buildVapiAssistantPayload(agent, (agent.skills || []) as Skill[])
  await updateVapiAssistant(agent.vapi_assistant_id, vapiPayload)
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { agentId } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('skills')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { agentId } = await params
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, description, type, parameters_schema, action_config, enabled } = body

  if (!name || !description || !type) {
    return NextResponse.json({ error: 'name, description, and type are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('skills')
    .insert({
      agent_id: agentId,
      name,
      description,
      type,
      parameters_schema: parameters_schema || {},
      action_config: action_config || {},
      enabled: enabled !== false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try { await syncSkillsToVapi(agentId) } catch (err) { console.error('Vapi sync failed:', err) }

  return NextResponse.json(data, { status: 201 })
}
