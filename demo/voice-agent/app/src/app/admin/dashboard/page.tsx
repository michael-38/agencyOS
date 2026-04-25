import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import type { CallLog } from '@/types'

async function getStats() {
  const now = new Date()
  const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [clients, agents, callsToday, callsWeek, callsMonth, recentLogs] = await Promise.all([
    supabaseAdmin.from('clients').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('agents').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('call_logs').select('id', { count: 'exact', head: true }).gte('started_at', todayStart),
    supabaseAdmin.from('call_logs').select('id', { count: 'exact', head: true }).gte('started_at', weekAgo),
    supabaseAdmin.from('call_logs').select('id', { count: 'exact', head: true }).gte('started_at', monthAgo),
    supabaseAdmin.from('call_logs').select('*, agents(name, clients(business_name))').order('started_at', { ascending: false }).limit(10),
  ])

  return {
    clientCount: clients.count || 0,
    agentCount: agents.count || 0,
    callsToday: callsToday.count || 0,
    callsWeek: callsWeek.count || 0,
    callsMonth: callsMonth.count || 0,
    recentLogs: (recentLogs.data || []) as (CallLog & { agents?: { name: string; clients?: { business_name: string } } })[],
  }
}

const outcomeColors: Record<string, string> = {
  appointment_booked: 'bg-green-100 text-green-700',
  appointment_rescheduled: 'bg-blue-100 text-blue-700',
  appointment_cancelled: 'bg-red-100 text-red-700',
  info_collected: 'bg-yellow-100 text-yellow-700',
  no_action: 'bg-slate-100 text-slate-600',
}

export default async function AdminDashboard() {
  const stats = await getStats()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Overview of all agents and activity</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-5">
        {[
          { label: 'Total Clients', value: stats.clientCount },
          { label: 'Total Agents', value: stats.agentCount },
          { label: 'Calls Today', value: stats.callsToday },
          { label: 'Calls This Week', value: stats.callsWeek },
          { label: 'Calls This Month', value: stats.callsMonth },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="text-3xl font-semibold text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent calls */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-medium text-slate-900">Recent Calls</h2>
          <Link href="/admin/agents" className="text-sm text-blue-600 hover:underline">View agents →</Link>
        </div>

        {stats.recentLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">No calls yet</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {stats.recentLogs.map((log) => (
              <div key={log.id} className="px-6 py-3 flex items-center gap-4 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-800">{log.caller_phone}</span>
                  {log.agents?.clients?.business_name && (
                    <span className="text-slate-400 ml-2">· {log.agents.clients.business_name}</span>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${outcomeColors[log.outcome] || outcomeColors.no_action}`}>
                  {log.outcome.replace(/_/g, ' ')}
                </span>
                <span className="text-slate-400 shrink-0">
                  {new Date(log.started_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
