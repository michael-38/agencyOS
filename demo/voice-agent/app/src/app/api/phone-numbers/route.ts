import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { provisionPhoneNumber, linkPhoneNumber } from '@/lib/vapi'

export async function GET() {
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, name, phone_number, vapi_phone_number_id, clients(business_name)')
    .not('phone_number', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { agentId, areaCode } = body

  if (!agentId) return NextResponse.json({ error: 'agentId is required' }, { status: 400 })

  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('vapi_assistant_id')
    .eq('id', agentId)
    .single()

  if (!agent?.vapi_assistant_id) {
    return NextResponse.json({ error: 'Agent has no Vapi assistant' }, { status: 400 })
  }

  try {
    const result = await provisionPhoneNumber(agent.vapi_assistant_id, areaCode)
    const phoneNumber = result.number || result.sipUri || null

    await supabaseAdmin
      .from('agents')
      .update({
        phone_number: phoneNumber,
        vapi_phone_number_id: result.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId)

    return NextResponse.json({
      phoneNumber,
      phoneNumberId: result.id,
      status: result.status,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { agentId, phoneNumber, vapiPhoneNumberId } = body

  if (!agentId || !phoneNumber || !vapiPhoneNumberId) {
    return NextResponse.json(
      { error: 'agentId, phoneNumber, and vapiPhoneNumberId are required' },
      { status: 400 },
    )
  }

  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('vapi_assistant_id')
    .eq('id', agentId)
    .single()

  if (!agent?.vapi_assistant_id) {
    return NextResponse.json({ error: 'Agent has no Vapi assistant' }, { status: 400 })
  }

  try {
    await linkPhoneNumber(vapiPhoneNumberId, agent.vapi_assistant_id)

    await supabaseAdmin
      .from('agents')
      .update({
        phone_number: phoneNumber,
        vapi_phone_number_id: vapiPhoneNumberId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId)

    return NextResponse.json({ phoneNumber, phoneNumberId: vapiPhoneNumberId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
