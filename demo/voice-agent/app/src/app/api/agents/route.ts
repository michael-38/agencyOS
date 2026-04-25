import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { createVapiAssistant } from '@/lib/vapi'
import { DEFAULT_SKILLS } from '@/lib/default-skills'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { role?: string; userId?: string }

  let query = supabaseAdmin
    .from('agents')
    .select('*, clients(name, business_name)')
    .order('created_at', { ascending: false })

  if (user.role === 'client') {
    query = query.eq('client_id', user.userId!)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { client_id, name, system_prompt } = body

  if (!client_id || !name) {
    return NextResponse.json({ error: 'client_id and name are required' }, { status: 400 })
  }

  const optionalFields = [
    'voice_provider', 'voice_id', 'first_message', 'language',
    'max_duration_seconds', 'silence_timeout_seconds', 'response_delay_seconds',
    'end_call_phrases', 'background_sound', 'interruption_sensitivity',
    'model_provider', 'model', 'temperature', 'max_tokens',
    'voicemail_detection_enabled', 'forwarding_phone_number',
  ] as const
  const insert: Record<string, unknown> = {
    client_id,
    name,
    system_prompt: system_prompt || '',
    status: 'inactive',
  }
  for (const key of optionalFields) {
    if (key in body) insert[key] = body[key]
  }

  const { data: agent, error } = await supabaseAdmin
    .from('agents')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert default calendar skills
  const skillRows = DEFAULT_SKILLS.map((skill) => ({
    agent_id: agent.id,
    name: skill.name,
    description: skill.description,
    type: skill.type,
    parameters_schema: skill.parameters_schema,
    action_config: skill.action_config,
    enabled: skill.enabled,
  }))
  const { data: skills } = await supabaseAdmin
    .from('skills')
    .insert(skillRows)
    .select()

  // Sync to Vapi with default skills included
  try {
    const vapiResult = await createVapiAssistant(agent, skills || [])
    await supabaseAdmin
      .from('agents')
      .update({ vapi_assistant_id: vapiResult.id })
      .eq('id', agent.id)
    agent.vapi_assistant_id = vapiResult.id
  } catch (err) {
    console.error('Vapi sync failed:', err)
    // Delete the agent if Vapi sync fails
    await supabaseAdmin.from('agents').delete().eq('id', agent.id)
    return NextResponse.json({ error: 'Failed to create Vapi assistant' }, { status: 500 })
  }

  return NextResponse.json(agent, { status: 201 })
}
