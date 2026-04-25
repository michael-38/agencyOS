import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { updateVapiAssistant, deleteVapiAssistant, releasePhoneNumber, buildVapiAssistantPayload } from '@/lib/vapi'

type Params = { params: Promise<{ agentId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { agentId } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('*, skills(*), clients(name, business_name)')
    .eq('id', agentId)
    .single()

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const user = session.user as { role?: string; userId?: string }
  if (user.role === 'client' && data.client_id !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { agentId } = await params
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = [
    'name', 'system_prompt', 'status',
    'voice_provider', 'voice_id', 'first_message', 'language',
    'max_duration_seconds', 'silence_timeout_seconds', 'response_delay_seconds',
    'end_call_phrases', 'background_sound', 'interruption_sensitivity',
    'model_provider', 'model', 'temperature', 'max_tokens',
    'voicemail_detection_enabled', 'forwarding_phone_number',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }
  update.updated_at = new Date().toISOString()

  const { data: agent, error } = await supabaseAdmin
    .from('agents')
    .update(update)
    .eq('id', agentId)
    .select('*, skills(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Rebuild full Vapi payload from the updated agent and sync
  if (agent.vapi_assistant_id) {
    try {
      const vapiPayload = buildVapiAssistantPayload(agent, agent.skills || [])
      await updateVapiAssistant(agent.vapi_assistant_id, vapiPayload)
    } catch (err) {
      console.error('Vapi sync failed:', err)
    }
  }

  return NextResponse.json(agent)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { agentId } = await params
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('vapi_assistant_id, vapi_phone_number_id')
    .eq('id', agentId)
    .single()

  if (agent) {
    if (agent.vapi_phone_number_id) {
      try { await releasePhoneNumber(agent.vapi_phone_number_id) } catch {}
    }
    if (agent.vapi_assistant_id) {
      try { await deleteVapiAssistant(agent.vapi_assistant_id) } catch {}
    }
  }

  const { error } = await supabaseAdmin.from('agents').delete().eq('id', agentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
