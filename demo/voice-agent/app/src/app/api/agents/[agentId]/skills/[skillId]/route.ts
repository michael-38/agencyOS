import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { updateVapiAssistant, buildVapiToolsFromSkills } from '@/lib/vapi'
import type { Skill } from '@/types'

type Params = { params: Promise<{ agentId: string; skillId: string }> }

async function syncSkillsToVapi(agentId: string) {
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('vapi_assistant_id')
    .eq('id', agentId)
    .single()

  if (!agent?.vapi_assistant_id) return

  const { data: skills } = await supabaseAdmin
    .from('skills')
    .select('*')
    .eq('agent_id', agentId)

  const tools = buildVapiToolsFromSkills((skills || []) as Skill[])
  await updateVapiAssistant(agent.vapi_assistant_id, { model: { provider: 'openai', model: 'gpt-4o', tools } })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { skillId } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('skills')
    .select('*')
    .eq('id', skillId)
    .single()

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { agentId, skillId } = await params
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = ['name', 'description', 'type', 'parameters_schema', 'action_config', 'enabled']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }
  update.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('skills')
    .update(update)
    .eq('id', skillId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try { await syncSkillsToVapi(agentId) } catch (err) { console.error('Vapi sync failed:', err) }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { agentId, skillId } = await params
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin.from('skills').delete().eq('id', skillId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try { await syncSkillsToVapi(agentId) } catch (err) { console.error('Vapi sync failed:', err) }

  return NextResponse.json({ ok: true })
}
