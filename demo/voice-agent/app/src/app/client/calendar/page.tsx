import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { CalendarConnect } from '@/components/client/CalendarConnect'
import type { Client } from '@/types'

export default async function CalendarPage() {
  const session = await auth()
  const user = session?.user as { userId?: string }

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, google_calendar_id, google_access_token_enc')
    .eq('id', user.userId!)
    .single()

  const isConnected = !!(client?.google_access_token_enc)
  const calendarId = client?.google_calendar_id

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Google Calendar</h1>
        <p className="text-slate-500 text-sm mt-1">Connect your Google Calendar so your agent can check availability and book appointments.</p>
      </div>

      <CalendarConnect
        clientId={(client as Partial<Client>)?.id || ''}
        isConnected={isConnected}
        calendarId={calendarId}
      />
    </div>
  )
}
