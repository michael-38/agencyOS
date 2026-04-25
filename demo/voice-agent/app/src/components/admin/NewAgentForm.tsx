'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Client, VoiceProvider, ModelProvider, BackgroundSound } from '@/types'
import { MODEL_OPTIONS, getDefaultModel } from '@/lib/model-options'

type Props = {
  clients: Pick<Client, 'id' | 'name' | 'business_name'>[]
}

const DEFAULT_PROMPT = `You are a helpful scheduling assistant for [Business Name]. Your job is to answer inbound calls, qualify the caller's needs, and book appointments.

When a caller wants to schedule a service:
1. Ask for their name and best callback number
2. Ask about the nature of their request
3. Check available appointment slots using the check_availability tool
4. Book the appointment using the schedule_appointment tool
5. Confirm the appointment details

Be friendly, professional, and concise. Always confirm all appointment details before ending the call.`

type Section = 'basic' | 'voice' | 'model' | 'behavior' | 'telephony'

export function NewAgentForm({ clients }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openSections, setOpenSections] = useState<Set<Section>>(new Set(['basic']))

  // Basic
  const [clientId, setClientId] = useState('')
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT)

  // Voice & Speech
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('11labs')
  const [voiceId, setVoiceId] = useState('21m00Tcm4TlvDq8ikWAM')
  const [firstMessage, setFirstMessage] = useState('')
  const [language, setLanguage] = useState('en')

  // Model
  const [modelProvider, setModelProvider] = useState<ModelProvider>('openai')
  const [model, setModel] = useState('gpt-4o')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(250)

  // Behavior
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(1800)
  const [silenceTimeoutSeconds, setSilenceTimeoutSeconds] = useState(30)
  const [responseDelaySeconds, setResponseDelaySeconds] = useState(0.4)
  const [endCallPhrases, setEndCallPhrases] = useState('')
  const [backgroundSound, setBackgroundSound] = useState<BackgroundSound>('off')
  const [interruptionSensitivity, setInterruptionSensitivity] = useState(1.0)

  // Telephony
  const [voicemailDetectionEnabled, setVoicemailDetectionEnabled] = useState(false)
  const [forwardingPhoneNumber, setForwardingPhoneNumber] = useState('')

  function toggleSection(s: Section) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        name,
        system_prompt: systemPrompt,
        voice_provider: voiceProvider,
        voice_id: voiceId,
        first_message: firstMessage,
        language,
        model_provider: modelProvider,
        model,
        temperature,
        max_tokens: maxTokens,
        max_duration_seconds: maxDurationSeconds,
        silence_timeout_seconds: silenceTimeoutSeconds,
        response_delay_seconds: responseDelaySeconds,
        end_call_phrases: endCallPhrases ? endCallPhrases.split('\n').map((p) => p.trim()).filter(Boolean) : [],
        background_sound: backgroundSound,
        interruption_sensitivity: interruptionSensitivity,
        voicemail_detection_enabled: voicemailDetectionEnabled,
        forwarding_phone_number: forwardingPhoneNumber || undefined,
      }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to create agent')
      return
    }

    const agent = await res.json()
    router.push(`/admin/agents/${agent.id}`)
  }

  const sectionCls = 'border border-slate-200 rounded-xl bg-white overflow-hidden'
  const sectionHeaderCls = 'flex items-center justify-between w-full px-5 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors'
  const sectionBodyCls = 'px-5 pb-5 space-y-4'
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1'
  const hintCls = 'text-xs text-slate-400 mt-1'

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic */}
        <div className={sectionCls}>
          <button type="button" onClick={() => toggleSection('basic')} className={sectionHeaderCls}>
            <span>Basic Settings</span>
            <span className="text-slate-400">{openSections.has('basic') ? '−' : '+'}</span>
          </button>
          {openSections.has('basic') && (
            <div className={sectionBodyCls}>
              <div>
                <label className={labelCls}>Client</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} required className={inputCls}>
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.business_name} ({c.name})</option>
                  ))}
                </select>
                {clients.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No active clients. Create and activate a client first.</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Agent Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="e.g. Smith Roofing Scheduler" />
              </div>
              <div>
                <label className={labelCls}>System Prompt</label>
                <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} required rows={10} className={`${inputCls} font-mono resize-y`} />
                <p className={hintCls}>The LLM system prompt sent to Vapi. Customize it for the client&apos;s business.</p>
              </div>
            </div>
          )}
        </div>

        {/* Voice & Speech */}
        <div className={sectionCls}>
          <button type="button" onClick={() => toggleSection('voice')} className={sectionHeaderCls}>
            <span>Voice & Speech</span>
            <span className="text-slate-400">{openSections.has('voice') ? '−' : '+'}</span>
          </button>
          {openSections.has('voice') && (
            <div className={sectionBodyCls}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Voice Provider</label>
                  <select value={voiceProvider} onChange={(e) => setVoiceProvider(e.target.value as VoiceProvider)} className={inputCls}>
                    <option value="11labs">ElevenLabs</option>
                    <option value="azure">Azure</option>
                    <option value="deepgram">Deepgram</option>
                    <option value="lmnt">LMNT</option>
                    <option value="openai">OpenAI</option>
                    <option value="playht">PlayHT</option>
                    <option value="rime-ai">Rime AI</option>
                    <option value="vapi">Vapi</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Voice ID</label>
                  <input type="text" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className={inputCls} placeholder="21m00Tcm4TlvDq8ikWAM" />
                  <p className={hintCls}>The voice ID from your chosen provider.</p>
                </div>
              </div>
              <div>
                <label className={labelCls}>First Message (Greeting)</label>
                <input type="text" value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} className={inputCls} placeholder="e.g. Hi, thanks for calling! How can I help you today?" />
                <p className={hintCls}>What the agent says when it picks up. Leave blank to let the LLM decide.</p>
              </div>
              <div>
                <label className={labelCls}>Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="nl">Dutch</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="zh">Chinese</option>
                  <option value="hi">Hindi</option>
                  <option value="ar">Arabic</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Model */}
        <div className={sectionCls}>
          <button type="button" onClick={() => toggleSection('model')} className={sectionHeaderCls}>
            <span>Model</span>
            <span className="text-slate-400">{openSections.has('model') ? '−' : '+'}</span>
          </button>
          {openSections.has('model') && (
            <div className={sectionBodyCls}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Model Provider</label>
                  <select value={modelProvider} onChange={(e) => { const p = e.target.value as ModelProvider; setModelProvider(p); setModel(getDefaultModel(p)) }} className={inputCls}>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="together-ai">Together AI</option>
                    <option value="anyscale">Anyscale</option>
                    <option value="groq">Groq</option>
                    <option value="deepinfra">DeepInfra</option>
                    <option value="custom-llm">Custom LLM</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Model</label>
                  {MODEL_OPTIONS[modelProvider].length > 0 ? (
                    <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
                      {MODEL_OPTIONS[modelProvider].map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} placeholder="Enter custom model identifier" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Temperature</label>
                  <input type="number" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} min={0} max={2} step={0.1} className={inputCls} />
                  <p className={hintCls}>0 = deterministic, 2 = very creative. Default 0.7.</p>
                </div>
                <div>
                  <label className={labelCls}>Max Tokens</label>
                  <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} min={1} max={4096} className={inputCls} />
                  <p className={hintCls}>Max tokens per response. Default 250.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Behavior */}
        <div className={sectionCls}>
          <button type="button" onClick={() => toggleSection('behavior')} className={sectionHeaderCls}>
            <span>Behavior</span>
            <span className="text-slate-400">{openSections.has('behavior') ? '−' : '+'}</span>
          </button>
          {openSections.has('behavior') && (
            <div className={sectionBodyCls}>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Max Duration (sec)</label>
                  <input type="number" value={maxDurationSeconds} onChange={(e) => setMaxDurationSeconds(parseInt(e.target.value))} min={10} max={7200} className={inputCls} />
                  <p className={hintCls}>Max call length. Default 1800 (30 min).</p>
                </div>
                <div>
                  <label className={labelCls}>Silence Timeout (sec)</label>
                  <input type="number" value={silenceTimeoutSeconds} onChange={(e) => setSilenceTimeoutSeconds(parseInt(e.target.value))} min={5} max={300} className={inputCls} />
                  <p className={hintCls}>Hang up after this much silence. Default 30.</p>
                </div>
                <div>
                  <label className={labelCls}>Response Delay (sec)</label>
                  <input type="number" value={responseDelaySeconds} onChange={(e) => setResponseDelaySeconds(parseFloat(e.target.value))} min={0} max={5} step={0.1} className={inputCls} />
                  <p className={hintCls}>Pause before responding. Default 0.4.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Background Sound</label>
                  <select value={backgroundSound} onChange={(e) => setBackgroundSound(e.target.value as BackgroundSound)} className={inputCls}>
                    <option value="off">Off</option>
                    <option value="office">Office</option>
                    <option value="café">Caf&eacute;</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Interruption Sensitivity</label>
                  <input type="number" value={interruptionSensitivity} onChange={(e) => setInterruptionSensitivity(parseFloat(e.target.value))} min={0} max={1} step={0.1} className={inputCls} />
                  <p className={hintCls}>0 = never interrupted, 1 = very sensitive. Default 1.</p>
                </div>
              </div>
              <div>
                <label className={labelCls}>End Call Phrases</label>
                <textarea value={endCallPhrases} onChange={(e) => setEndCallPhrases(e.target.value)} rows={3} className={`${inputCls} font-mono resize-y`} placeholder={"goodbye\nthanks bye\nhave a nice day"} />
                <p className={hintCls}>One phrase per line. When the caller says one of these, the call ends.</p>
              </div>
            </div>
          )}
        </div>

        {/* Telephony */}
        <div className={sectionCls}>
          <button type="button" onClick={() => toggleSection('telephony')} className={sectionHeaderCls}>
            <span>Telephony</span>
            <span className="text-slate-400">{openSections.has('telephony') ? '−' : '+'}</span>
          </button>
          {openSections.has('telephony') && (
            <div className={sectionBodyCls}>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="voicemailDetection" checked={voicemailDetectionEnabled} onChange={(e) => setVoicemailDetectionEnabled(e.target.checked)} className="rounded" />
                <label htmlFor="voicemailDetection" className="text-sm text-slate-700">Enable Voicemail Detection</label>
              </div>
              <p className={hintCls}>When enabled, the agent detects voicemail greetings and can leave a message or hang up.</p>
              <div>
                <label className={labelCls}>Call Forwarding Number</label>
                <input type="text" value={forwardingPhoneNumber} onChange={(e) => setForwardingPhoneNumber(e.target.value)} className={inputCls} placeholder="+1234567890" />
                <p className={hintCls}>Forward calls to this number when the agent can&apos;t handle them.</p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/admin/agents')}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating & syncing to Vapi…' : 'Create Agent'}
          </button>
        </div>
      </form>
    </div>
  )
}
