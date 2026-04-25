import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { ClientDetailForm } from '@/components/admin/ClientDetailForm'
import type { Client } from '@/types'

type Props = { params: Promise<{ clientId: string }> }

export default async function ClientDetailPage({ params }: Props) {
  const { clientId } = await params

  const [{ data: client }, { data: agent }] = await Promise.all([
    supabaseAdmin
      .from('clients')
      .select('id, name, business_name, email, status, google_calendar_id, invite_token, created_at, updated_at')
      .eq('id', clientId)
      .single(),
    supabaseAdmin
      .from('agents')
      .select('id, name, status, phone_number')
      .eq('client_id', clientId)
      .single(),
  ])

  if (!client) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">{(client as Client).name}</h1>
        <p className="text-slate-500 text-sm">{(client as Client).business_name}</p>
      </div>

      <ClientDetailForm client={client as Client} agent={agent} />
    </div>
  )
}
