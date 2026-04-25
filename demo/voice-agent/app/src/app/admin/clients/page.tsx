import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { NewClientForm } from '@/components/admin/NewClientForm'
import type { Client } from '@/types'

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  invited: 'bg-yellow-100 text-yellow-700',
  inactive: 'bg-slate-100 text-slate-500',
}

export default async function ClientsPage() {
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, business_name, email, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="text-slate-500 text-sm mt-1">{(clients || []).length} total clients</p>
        </div>
        <NewClientForm />
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {(clients || []).length === 0 ? (
          <div className="px-6 py-16 text-center text-slate-400 text-sm">No clients yet. Add your first client above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Created</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(clients as Client[]).map((client) => (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{client.name}</div>
                    <div className="text-slate-500 text-xs">{client.business_name}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{client.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[client.status] || statusColors.inactive}`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/clients/${client.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                      Edit →
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
