import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { CallLog } from '@/types'

const outcomeColors: Record<string, string> = {
  appointment_booked: 'bg-green-100 text-green-700',
  appointment_rescheduled: 'bg-blue-100 text-blue-700',
  appointment_cancelled: 'bg-red-100 text-red-700',
  info_collected: 'bg-yellow-100 text-yellow-700',
  no_action: 'bg-slate-100 text-slate-600',
}

export default async function ClientDashboard() {
  const session = await auth()
  const user = session?.user as { userId?: string; name?: string | null }

  // Get client's agents
  const { data: agents } = await supabaseAdmin
    .from('agents')
    .select('id, name, status, phone_number')
    .eq('client_id', user.userId!)

  const agentIds = (agents || []).map((a) => a.id)

  const now = new Date()
  const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [callsToday, callsWeek, callsMonth, bookedMonth, recentLogs] = agentIds.length > 0
    ? await Promise.all([
        supabaseAdmin.from('call_logs').select('id', { count: 'exact', head: true }).in('agent_id', agentIds).gte('started_at', todayStart),
        supabaseAdmin.from('call_logs').select('id', { count: 'exact', head: true }).in('agent_id', agentIds).gte('started_at', weekAgo),
        supabaseAdmin.from('call_logs').select('id', { count: 'exact', head: true }).in('agent_id', agentIds).gte('started_at', monthAgo),
        supabaseAdmin.from('call_logs').select('id', { count: 'exact', head: true }).in('agent_id', agentIds).eq('outcome', 'appointment_booked').gte('started_at', monthAgo),
        supabaseAdmin.from('call_logs').select('*').in('agent_id', agentIds).order('started_at', { ascending: false }).limit(15),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { data: [] }]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Your voice agent activity</p>
      </div>

      {/* Agent cards */}
      {(agents || []).length > 0 && (
        <div className="flex gap-4 mb-8">
          {(agents || []).map((agent) => (
            <div key={agent.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-slate-900">{agent.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {agent.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">{agent.phone_number || 'No phone number'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Calls Today', value: (callsToday as { count: number }).count },
          { label: 'Calls This Week', value: (callsWeek as { count: number }).count },
          { label: 'Calls This Month', value: (callsMonth as { count: number }).count },
          { label: 'Booked This Month', value: (bookedMonth as { count: number }).count },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="text-3xl font-semibold text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent calls */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-medium text-slate-900">Recent Calls</h2>
        </div>

        {((recentLogs as { data: CallLog[] }).data || []).length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">No calls yet</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {((recentLogs as { data: CallLog[] }).data || []).map((log) => (
              <div key={log.id} className="px-6 py-3 flex items-center gap-4 text-sm">
                <div className="flex-1">
                  <span className="font-medium text-slate-800">{log.caller_phone}</span>
                  {log.caller_name && <span className="text-slate-400 ml-2">· {log.caller_name}</span>}
                  {log.caller_reason && <span className="text-slate-400 ml-2">· {log.caller_reason}</span>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${outcomeColors[log.outcome] || outcomeColors.no_action}`}>
                  {log.outcome.replace(/_/g, ' ')}
                </span>
                {log.duration_seconds && (
                  <span className="text-slate-400 text-xs">{log.duration_seconds}s</span>
                )}
                <span className="text-slate-400 shrink-0 text-xs">
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
