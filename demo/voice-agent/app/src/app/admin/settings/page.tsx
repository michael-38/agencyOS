import { supabaseAdmin } from '@/lib/supabase'

export default async function SettingsPage() {
  const { data: subscriptions } = await supabaseAdmin
    .from('client_subscriptions')
    .select('*, clients(name, business_name), billing_tiers(name, monthly_price_cents, minute_limit)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Billing and subscription overview</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-medium text-slate-900">Client Subscriptions</h2>
        </div>

        {(subscriptions || []).length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">No subscriptions yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Tier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Minutes Used</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(subscriptions || []).map((sub: Record<string, unknown>) => {
                const client = sub.clients as { business_name?: string } | null
                const tier = sub.billing_tiers as { name?: string; monthly_price_cents?: number; minute_limit?: number } | null
                const usedPct = tier?.minute_limit ? Math.round((sub.minutes_used as number) / tier.minute_limit * 100) : 0
                return (
                  <tr key={sub.id as string}>
                    <td className="px-6 py-4 font-medium text-slate-900">{client?.business_name || '—'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {tier?.name}
                      {tier?.monthly_price_cents && (
                        <span className="text-slate-400 ml-1">${(tier.monthly_price_cents / 100).toFixed(0)}/mo</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">{sub.minutes_used as number} / {tier?.minute_limit} min</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(usedPct, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        sub.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {sub.status as string}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
