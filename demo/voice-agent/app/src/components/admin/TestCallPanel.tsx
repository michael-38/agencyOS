'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type Vapi from '@vapi-ai/web'

type Transcript = { role: 'assistant' | 'user'; text: string }

export function TestCallPanel({ vapiAssistantId }: { vapiAssistantId: string }) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'ending'>('idle')
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [error, setError] = useState('')
  const vapiRef = useRef<Vapi | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcripts])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      vapiRef.current?.stop()
      vapiRef.current?.removeAllListeners()
      vapiRef.current = null
    }
  }, [])

  const startCall = useCallback(async () => {
    if (!publicKey) {
      setError('NEXT_PUBLIC_VAPI_PUBLIC_KEY is not configured')
      return
    }
    setError('')
    setStatus('connecting')
    setTranscripts([])

    // Clean up any previous instance
    if (vapiRef.current) {
      vapiRef.current.stop()
      vapiRef.current.removeAllListeners()
      vapiRef.current = null
    }

    try {
      const { default: Vapi } = await import('@vapi-ai/web')
      const vapi = new Vapi(publicKey)
      vapiRef.current = vapi

      vapi.on('call-start', () => {
        setStatus('active')
      })

      vapi.on('call-end', () => {
        setStatus('idle')
        setVolumeLevel(0)
      })

      vapi.on('speech-start', () => {
        // assistant started speaking
      })

      vapi.on('speech-end', () => {
        // assistant stopped speaking
      })

      vapi.on('volume-level', (level: unknown) => {
        setVolumeLevel(level as number)
      })

      vapi.on('message', (message: unknown) => {
        const msg = message as { type?: string; role?: string; transcript?: string; transcriptType?: string }
        if (msg.type === 'transcript' && msg.transcriptType === 'final' && msg.transcript) {
          setTranscripts((prev) => [
            ...prev,
            { role: msg.role as 'assistant' | 'user', text: msg.transcript! },
          ])
        }
      })

      vapi.on('error', (err: unknown) => {
        const e = err as { message?: string }
        setError(e?.message || 'Call error')
        setStatus('idle')
      })

      await vapi.start(vapiAssistantId)
    } catch (err) {
      const e = err as Error
      setError(e.message)
      setStatus('idle')
    }
  }, [publicKey, vapiAssistantId])

  const endCall = useCallback(() => {
    setStatus('ending')
    vapiRef.current?.stop()
  }, [])

  if (!publicKey) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md">
        <h2 className="font-medium text-slate-900 mb-3">Test Call</h2>
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Add <code className="font-mono text-xs">NEXT_PUBLIC_VAPI_PUBLIC_KEY</code> to your .env.local to enable browser test calls. Get it from your Vapi dashboard under Account &gt; API Keys.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg w-full">
      <h2 className="font-medium text-slate-900 mb-4">Test Call</h2>
      <p className="text-sm text-slate-500 mb-4">
        Start a live voice conversation with this agent from your browser. Make sure your microphone is enabled.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* Call controls */}
      <div className="flex items-center gap-3 mb-4">
        {status === 'idle' ? (
          <button
            onClick={startCall}
            className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
            Start Test Call
          </button>
        ) : (
          <button
            onClick={endCall}
            disabled={status !== 'active'}
            className="px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3.707 2.293a1 1 0 00-1.414 1.414l6.921 6.922c.05.062.105.118.168.167l6.91 6.911a1 1 0 001.415-1.414l-.675-.675A18.312 18.312 0 005.971 4.886L3.707 2.293z" />
            </svg>
            End Call
          </button>
        )}

        {status === 'connecting' && (
          <span className="text-sm text-slate-500 animate-pulse">Connecting...</span>
        )}
        {status === 'active' && (
          <span className="text-sm text-green-600 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        )}
        {status === 'ending' && (
          <span className="text-sm text-slate-500">Ending...</span>
        )}
      </div>

      {/* Volume indicator */}
      {status === 'active' && (
        <div className="mb-4">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-100"
              style={{ width: `${Math.min(volumeLevel * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="border border-slate-200 rounded-lg p-3 min-h-[80px] max-h-80 overflow-y-auto space-y-2"
      >
        {transcripts.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            {status === 'idle' ? 'Transcript will appear here during a call.' : 'Waiting for conversation...'}
          </p>
        ) : (
          transcripts.map((t, i) => (
            <div key={i} className={`text-sm ${t.role === 'assistant' ? 'text-blue-700' : 'text-slate-700'}`}>
              <span className="font-medium">{t.role === 'assistant' ? 'Agent' : 'You'}:</span>{' '}
              {t.text}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
