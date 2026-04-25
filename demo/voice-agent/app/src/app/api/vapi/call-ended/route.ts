import { NextRequest, NextResponse } from 'next/server'
import { verifyVapiSignature } from '@/lib/vapi'
import { supabaseAdmin } from '@/lib/supabase'
import type { CallOutcome } from '@/types'

function analyzeCallOutcome(transcript: string, summary: string): CallOutcome {
  const text = `${transcript} ${summary}`.toLowerCase()
  if (text.includes('appointment booked') || text.includes('scheduled your appointment')) return 'appointment_booked'
  if (text.includes('rescheduled') || text.includes('reschedule')) return 'appointment_rescheduled'
  if (text.includes('cancelled') || text.includes('canceled')) return 'appointment_cancelled'
  if (text.includes('name') || text.includes('phone') || text.includes('information')) return 'info_collected'
  return 'no_action'
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  if (!verifyVapiSignature(body, req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = JSON.parse(body)
  const messageType = payload.message?.type

  // Vapi sends all server events to serverUrl. Only process end-of-call reports;
  // acknowledge everything else with 200 so Vapi doesn't treat them as errors.
  if (messageType !== 'end-of-call-report') {
    return NextResponse.json({ ok: true })
  }

  const { call, startedAt, endedAt, transcript, summary, customer } = payload.message

  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('id, client_id')
    .eq('vapi_assistant_id', call.assistantId)
    .single()

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const durationSeconds = endedAt && startedAt
    ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
    : null

  const outcome = analyzeCallOutcome(transcript || '', summary || '')

  await supabaseAdmin.from('call_logs').insert({
    agent_id: agent.id,
    vapi_call_id: call.id,
    caller_phone: customer?.number || 'unknown',
    started_at: startedAt,
    ended_at: endedAt || null,
    duration_seconds: durationSeconds,
    transcript: transcript || null,
    outcome,
    metadata: { summary },
  })

  // Update billing minutes
  if (durationSeconds && durationSeconds > 0) {
    const durationMinutes = Math.ceil(durationSeconds / 60)
    await supabaseAdmin.rpc('increment_minutes_used', {
      p_client_id: agent.client_id,
      p_minutes: durationMinutes,
    })
  }

  return NextResponse.json({ ok: true })
}
