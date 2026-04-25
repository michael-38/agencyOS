'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Client, Agent } from '@/types'

type Props = {
  client: Client
  agent?: Partial<Agent> | null
}

export function ClientDetailForm({ client, agent }: Props) {
  const router = useRouter()
  const [name, setName] = useState(client.name)
  const [businessName, setBusinessName] = useState(client.business_name)
  const [email, setEmail] = useState(client.email)
  const [status, setStatus] = useState(client.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteMode, setDeleteMode] = useState<'none' | 'soft' | 'hard'>('none')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)

    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, business_name: businessName, email, status }),
    })

    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to save')
      return
    }
    setSuccess(true)
    router.refresh()
  }

  async function handleDelete(hard: boolean) {
    setDeleting(true)
    const url = hard
      ? `/api/clients/${client.id}?hard=true`
      : `/api/clients/${client.id}`
    const res = await fetch(url, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      router.push('/admin/clients')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to delete client')
      setDeleteMode('none')
    }
  }

  async function generateInvite() {
    setGeneratingInvite(true)
    const res = await fetch('/api/clients/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id }),
    })
    setGeneratingInvite(false)
    if (res.ok) {
      const data = await res.json()
      setInviteUrl(data.inviteUrl)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-medium text-slate-900 mb-4">Client Details</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Client['status'])}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="invited">Invited</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Saved successfully.</p>}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Agent */}
      {agent && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-medium text-slate-900 mb-3">Agent</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">{agent.name}</p>
              <p className="text-xs text-slate-500">{agent.phone_number || 'No phone number'} · {agent.status}</p>
            </div>
            <Link href={`/admin/agents/${agent.id}`} className="text-sm text-blue-600 hover:underline">
              Configure →
            </Link>
          </div>
        </div>
      )}

      {/* Calendar status */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-medium text-slate-900 mb-3">Google Calendar</h2>
        <p className="text-sm text-slate-600">
          {client.google_calendar_id
            ? `Connected — Calendar ID: ${client.google_calendar_id}`
            : 'Not connected. Client must connect via their dashboard.'}
        </p>
      </div>

      {/* Invite link */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-medium text-slate-900 mb-3">Invite Link</h2>
        <p className="text-sm text-slate-500 mb-3">Generate a one-time link for the client to set their password.</p>

        <button
          onClick={generateInvite}
          disabled={generatingInvite}
          className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {generatingInvite ? 'Generating…' : 'Generate Invite Link'}
        </button>

        {inviteUrl && (
          <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Share this link (expires in 7 days):</p>
            <code className="text-xs text-slate-800 break-all">{inviteUrl}</code>
          </div>
        )}
      </div>

      {/* Delete client */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="font-medium text-red-900 mb-2">Delete Client</h2>

        {deleteMode === 'none' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteMode('soft')}
                className="px-4 py-2 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
              >
                Deactivate
              </button>
              <button
                onClick={() => setDeleteMode('hard')}
                className="px-4 py-2 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete Permanently
              </button>
            </div>
            <p className="text-xs text-slate-400">Deactivate revokes access but keeps the record. Permanent delete removes all data.</p>
          </div>
        )}

        {deleteMode === 'soft' && (
          <div>
            <p className="text-sm text-slate-500 mb-4">This will deactivate the client and revoke their access. The record will be kept.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDelete(false)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deactivating…' : 'Confirm Deactivate'}
              </button>
              <button
                onClick={() => setDeleteMode('none')}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {deleteMode === 'hard' && (
          <div>
            <p className="text-sm text-red-600 font-medium mb-4">This will permanently delete this client and all associated data. This cannot be undone.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDelete(true)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Permanently Delete'}
              </button>
              <button
                onClick={() => setDeleteMode('none')}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
