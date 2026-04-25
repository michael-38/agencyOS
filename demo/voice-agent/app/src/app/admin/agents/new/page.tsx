import { supabaseAdmin } from '@/lib/supabase'
import { NewAgentForm } from '@/components/admin/NewAgentForm'
import type { Client } from '@/types'

export default async function NewAgentPage() {
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, business_name')
    .eq('status', 'active')
    .order('business_name')

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">New Agent</h1>
        <p className="text-slate-500 text-sm mt-1">Create an AI voice agent and sync it to Vapi</p>
      </div>

      <NewAgentForm clients={(clients || []) as Pick<Client, 'id' | 'name' | 'business_name'>[]} />
    </div>
  )
}
