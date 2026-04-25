import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import type { Agent } from '@/types'

export default async function AgentsPage() {
  const { data: agents } = await supabaseAdmin
    .from('agents')
    .select('*, clients(name, business_name)')
    .order('created_at', { ascending: false })

  type AgentWithClient = Agent & { clients?: { name: string; business_name: string } }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Agents</h1>
          <p className="text-slate-500 text-sm mt-1">{(agents || []).length} total agents</p>
        </div>
        <Link
          href="/admin/agents/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Agent
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {(agents || []).length === 0 ? (
          <div className="px-6 py-16 text-center text-slate-400 text-sm">
            No agents yet.{' '}
            <Link href="/admin/agents/new" className="text-blue-600 hover:underline">
              Create your first agent
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(agents as AgentWithClient[]).map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{agent.name}</td>
                  <td className="px-6 py-4 text-slate-600">{agent.clients?.business_name || '—'}</td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">{agent.phone_number || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/agents/${agent.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                      Configure →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
