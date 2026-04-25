import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { AgentConfigPanel } from '@/components/admin/AgentConfigPanel'
import type { Agent, Skill, CallLog } from '@/types'

type Props = { params: Promise<{ agentId: string }> }

export default async function AgentDetailPage({ params }: Props) {
  const { agentId } = await params

  const [{ data: agent }, { data: skills }, { data: logs }] = await Promise.all([
    supabaseAdmin
      .from('agents')
      .select('*, clients(name, business_name)')
      .eq('id', agentId)
      .single(),
    supabaseAdmin
      .from('skills')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at'),
    supabaseAdmin
      .from('call_logs')
      .select('*')
      .eq('agent_id', agentId)
      .order('started_at', { ascending: false })
      .limit(20),
  ])

  if (!agent) notFound()

  type AgentWithClient = Agent & { clients?: { name: string; business_name: string } }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">{(agent as AgentWithClient).name}</h1>
        <p className="text-slate-500 text-sm">{(agent as AgentWithClient).clients?.business_name}</p>
      </div>

      <AgentConfigPanel
        agent={agent as Agent}
        skills={(skills || []) as Skill[]}
        logs={(logs || []) as CallLog[]}
      />
    </div>
  )
}
