'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type Props = {
  clientId: string
  isConnected: boolean
  calendarId?: string | null
}

function CalendarConnectInner({ clientId, isConnected, calendarId }: Props) {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const connected = searchParams.get('connected')

  return (
    <div className="space-y-4">
      {connected && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          Google Calendar connected successfully!
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          {error === 'google_denied' && 'You denied access to Google Calendar.'}
          {error === 'exchange_failed' && 'Failed to connect Google Calendar. Please try again.'}
          {!['google_denied', 'exchange_failed'].includes(error) && 'An error occurred. Please try again.'}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isConnected ? 'bg-green-100' : 'bg-slate-100'}`}>
            {isConnected ? (
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>

          <div className="flex-1">
            <h2 className="font-medium text-slate-900">
              {isConnected ? 'Calendar Connected' : 'Connect Google Calendar'}
            </h2>
            {isConnected ? (
              <div>
                <p className="text-sm text-slate-500 mt-1">
                  Your Google Calendar is connected. Your agent can now check availability and book appointments.
                </p>
                {calendarId && (
                  <p className="text-xs text-slate-400 mt-2 font-mono">Calendar: {calendarId}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-1">
                Allow your voice agent to view your calendar and create appointments on your behalf.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <a
            href="/api/auth/google/authorize"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {isConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
          </a>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-medium text-slate-900 text-sm mb-2">What your agent can do</h3>
        <ul className="space-y-1.5 text-sm text-slate-600">
          {[
            'Check your calendar for available appointment slots',
            'Book new appointments with caller details',
            'Reschedule existing appointments',
            'Cancel appointments on request',
            'Send SMS confirmations to callers',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function CalendarConnect(props: Props) {
  return (
    <Suspense fallback={<div className="text-slate-400 text-sm">Loading…</div>}>
      <CalendarConnectInner {...props} />
    </Suspense>
  )
}
