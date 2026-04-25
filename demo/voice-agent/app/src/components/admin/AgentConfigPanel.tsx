'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Agent, Skill, CallLog, VoiceProvider, ModelProvider, BackgroundSound } from '@/types'
import { MODEL_OPTIONS, getDefaultModel } from '@/lib/model-options'
import { TestCallPanel } from './TestCallPanel'

type Props = {
  agent: Agent
  skills: Skill[]
  logs: CallLog[]
}

type Tab = 'config' | 'skills' | 'phone' | 'test' | 'logs'

const outcomeColors: Record<string, string> = {
  appointment_booked: 'bg-green-100 text-green-700',
  appointment_rescheduled: 'bg-blue-100 text-blue-700',
  appointment_cancelled: 'bg-red-100 text-red-700',
  info_collected: 'bg-yellow-100 text-yellow-700',
  no_action: 'bg-slate-100 text-slate-600',
}

export function AgentConfigPanel({ agent, skills, logs }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('config')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Basic
  const [name, setName] = useState(agent.name)
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt)
  const [agentStatus, setAgentStatus] = useState(agent.status)

  // Voice & Speech
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>(agent.voice_provider || '11labs')
  const [voiceId, setVoiceId] = useState(agent.voice_id || '21m00Tcm4TlvDq8ikWAM')
  const [firstMessage, setFirstMessage] = useState(agent.first_message || '')
  const [language, setLanguage] = useState(agent.language || 'en')

  // Model
  const [modelProvider, setModelProvider] = useState<ModelProvider>(agent.model_provider || 'openai')
  const [model, setModel] = useState(agent.model || 'gpt-4o')
  const [temperature, setTemperature] = useState(agent.temperature ?? 0.7)
  const [maxTokens, setMaxTokens] = useState(agent.max_tokens ?? 250)

  // Behavior
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(agent.max_duration_seconds ?? 1800)
  const [silenceTimeoutSeconds, setSilenceTimeoutSeconds] = useState(agent.silence_timeout_seconds ?? 30)
  const [responseDelaySeconds, setResponseDelaySeconds] = useState(agent.response_delay_seconds ?? 0.4)
  const [endCallPhrases, setEndCallPhrases] = useState((agent.end_call_phrases || []).join('\n'))
  const [backgroundSound, setBackgroundSound] = useState<BackgroundSound>(agent.background_sound || 'off')
  const [interruptionSensitivity, setInterruptionSensitivity] = useState(agent.interruption_sensitivity ?? 1.0)

  // Telephony
  const [voicemailDetectionEnabled, setVoicemailDetectionEnabled] = useState(agent.voicemail_detection_enabled ?? false)
  const [forwardingPhoneNumber, setForwardingPhoneNumber] = useState(agent.forwarding_phone_number || '')

  // Phone provisioning
  const [areaCode, setAreaCode] = useState('')
  const [provisioning, setProvisioning] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  // Link existing number
  const [linkNumber, setLinkNumber] = useState('')
  const [linkVapiId, setLinkVapiId] = useState('')
  const [linking, setLinking] = useState(false)

  // Skill modal
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [skillDescription, setSkillDescription] = useState('')
  const [skillType, setSkillType] = useState('check_availability')
  const [skillSchema, setSkillSchema] = useState('{}')
  const [skillActionConfig, setSkillActionConfig] = useState('{}')
  const [skillEnabled, setSkillEnabled] = useState(true)
  const [skillSaving, setSkillSaving] = useState(false)
  const [skillError, setSkillError] = useState('')

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    const res = await fetch(`/api/agents/${agent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        system_prompt: systemPrompt,
        status: agentStatus,
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
        forwarding_phone_number: forwardingPhoneNumber || null,
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setSaveError(data.error || 'Failed to save')
      return
    }
    setSaveSuccess(true)
    router.refresh()
  }

  async function provisionPhone() {
    setProvisioning(true)
    setPhoneError('')
    const res = await fetch('/api/phone-numbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, areaCode: areaCode || undefined }),
    })
    setProvisioning(false)
    if (!res.ok) {
      const data = await res.json()
      setPhoneError(data.error || 'Failed to provision')
      return
    }
    router.refresh()
  }

  async function linkExistingNumber() {
    setLinking(true)
    setPhoneError('')
    const res = await fetch('/api/phone-numbers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, phoneNumber: linkNumber, vapiPhoneNumberId: linkVapiId }),
    })
    setLinking(false)
    if (!res.ok) {
      const data = await res.json()
      setPhoneError(data.error || 'Failed to link number')
      return
    }
    setLinkNumber('')
    setLinkVapiId('')
    router.refresh()
  }

  async function deleteSkill(skillId: string) {
    if (!confirm('Delete this skill?')) return
    await fetch(`/api/agents/${agent.id}/skills/${skillId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function saveSkill(e: React.FormEvent) {
    e.preventDefault()
    setSkillSaving(true)
    setSkillError('')

    let parsedSchema, parsedConfig
    try { parsedSchema = JSON.parse(skillSchema) } catch { setSkillError('Invalid parameters JSON'); setSkillSaving(false); return }
    try { parsedConfig = JSON.parse(skillActionConfig) } catch { setSkillError('Invalid action config JSON'); setSkillSaving(false); return }

    const res = await fetch(`/api/agents/${agent.id}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: skillName,
        description: skillDescription,
        type: skillType,
        parameters_schema: parsedSchema,
        action_config: parsedConfig,
        enabled: skillEnabled,
      }),
    })

    setSkillSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setSkillError(data.error || 'Failed to create skill')
      return
    }

    setShowSkillModal(false)
    setSkillName('')
    setSkillDescription('')
    setSkillType('check_availability')
    setSkillSchema('{}')
    setSkillActionConfig('{}')
    router.refresh()
  }

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-slate-500 hover:text-slate-800'
    }`

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1'
  const hintCls = 'text-xs text-slate-400 mt-1'
  const groupCls = 'border border-slate-100 rounded-lg p-4 space-y-4'
  const groupTitleCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3'

  return (
    <>
      <div className="border-b border-slate-200 mb-6 flex gap-1">
        {(['config', 'skills', 'phone', 'test', 'logs'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tabCls(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Config tab */}
      {tab === 'config' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl">
          <form onSubmit={saveConfig} className="space-y-6">
            {/* Basic */}
            <div>
              <h3 className={groupTitleCls}>Basic Settings</h3>
              <div className={groupCls}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Agent Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select value={agentStatus} onChange={(e) => setAgentStatus(e.target.value as Agent['status'])} className={inputCls}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>System Prompt</label>
                  <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={10} className={`${inputCls} font-mono resize-y`} />
                </div>
              </div>
            </div>

            {/* Voice & Speech */}
            <div>
              <h3 className={groupTitleCls}>Voice & Speech</h3>
              <div className={groupCls}>
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
                    <input type="text" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className={inputCls} />
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
            </div>

            {/* Model */}
            <div>
              <h3 className={groupTitleCls}>Model</h3>
              <div className={groupCls}>
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
            </div>

            {/* Behavior */}
            <div>
              <h3 className={groupTitleCls}>Behavior</h3>
              <div className={groupCls}>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Max Duration (sec)</label>
                    <input type="number" value={maxDurationSeconds} onChange={(e) => setMaxDurationSeconds(parseInt(e.target.value))} min={10} max={7200} className={inputCls} />
                    <p className={hintCls}>Default 1800 (30 min).</p>
                  </div>
                  <div>
                    <label className={labelCls}>Silence Timeout (sec)</label>
                    <input type="number" value={silenceTimeoutSeconds} onChange={(e) => setSilenceTimeoutSeconds(parseInt(e.target.value))} min={5} max={300} className={inputCls} />
                    <p className={hintCls}>Hang up after silence. Default 30.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Response Delay (sec)</label>
                    <input type="number" value={responseDelaySeconds} onChange={(e) => setResponseDelaySeconds(parseFloat(e.target.value))} min={0} max={5} step={0.1} className={inputCls} />
                    <p className={hintCls}>Pause before reply. Default 0.4.</p>
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
                    <p className={hintCls}>0 = never interrupted, 1 = sensitive.</p>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>End Call Phrases</label>
                  <textarea value={endCallPhrases} onChange={(e) => setEndCallPhrases(e.target.value)} rows={3} className={`${inputCls} font-mono resize-y`} placeholder={"goodbye\nthanks bye\nhave a nice day"} />
                  <p className={hintCls}>One phrase per line. Caller says one of these to end the call.</p>
                </div>
              </div>
            </div>

            {/* Telephony */}
            <div>
              <h3 className={groupTitleCls}>Telephony</h3>
              <div className={groupCls}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="voicemailDetection" checked={voicemailDetectionEnabled} onChange={(e) => setVoicemailDetectionEnabled(e.target.checked)} className="rounded" />
                  <label htmlFor="voicemailDetection" className="text-sm text-slate-700">Enable Voicemail Detection</label>
                </div>
                <p className={hintCls}>Detects voicemail greetings so the agent can leave a message or hang up.</p>
                <div>
                  <label className={labelCls}>Call Forwarding Number</label>
                  <input type="text" value={forwardingPhoneNumber} onChange={(e) => setForwardingPhoneNumber(e.target.value)} className={inputCls} placeholder="+1234567890" />
                  <p className={hintCls}>Forward calls to this number when the agent can&apos;t handle them.</p>
                </div>
              </div>
            </div>

            {agent.vapi_assistant_id && (
              <p className="text-xs text-slate-400">Vapi ID: {agent.vapi_assistant_id}</p>
            )}

            {saveError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>}
            {saveSuccess && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Saved and synced to Vapi.</p>}

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save & Sync to Vapi'}
            </button>
          </form>
        </div>
      )}

      {/* Skills tab */}
      {tab === 'skills' && (
        <div className="max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-slate-800">Skills ({skills.length})</h2>
            <button
              onClick={() => setShowSkillModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Skill
            </button>
          </div>

          <div className="space-y-3">
            {skills.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 px-6 py-10 text-center text-slate-400 text-sm">
                No skills yet. Add skills to enable the agent to take actions during calls.
              </div>
            )}
            {skills.map((skill) => (
              <div key={skill.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-slate-900">{skill.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${skill.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {skill.enabled ? 'enabled' : 'disabled'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{skill.type}</span>
                  </div>
                  <p className="text-xs text-slate-500">{skill.description}</p>
                </div>
                <button
                  onClick={() => deleteSkill(skill.id)}
                  className="text-xs text-red-500 hover:text-red-700 ml-4 shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phone tab */}
      {tab === 'phone' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md">
          <h2 className="font-medium text-slate-900 mb-4">Phone Number</h2>

          {agent.phone_number ? (
            <div className="mb-6">
              <p className="text-sm text-slate-600 mb-1">Current number:</p>
              <p className="text-xl font-mono font-semibold text-slate-900">{agent.phone_number}</p>
              <p className="text-xs text-slate-400 mt-1">Vapi ID: {agent.vapi_phone_number_id}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">No phone number provisioned.</p>
          )}

          <div className="border-t border-slate-100 pt-4 opacity-50">
            <p className="text-sm font-medium text-slate-700 mb-3">
              {agent.phone_number ? 'Provision New Number' : 'Provision a Number'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value)}
                placeholder="Area code (optional)"
                disabled
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                disabled
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                Provision
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">Auto-provisioning is currently disabled. Use &quot;Link Existing Number&quot; below.</p>
            {phoneError && <p className="text-sm text-red-600 mt-2">{phoneError}</p>}
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Link Existing Number</p>
            <p className="text-xs text-slate-500 mb-3">
              Already have a number in the Vapi dashboard? Enter its details to link it to this agent.
            </p>
            <div className="space-y-2">
              <input
                type="text"
                value={linkNumber}
                onChange={(e) => setLinkNumber(e.target.value)}
                placeholder="Phone number (e.g. +12722235916)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={linkVapiId}
                onChange={(e) => setLinkVapiId(e.target.value)}
                placeholder="Vapi Phone Number ID"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={linkExistingNumber}
                disabled={linking || !linkNumber || !linkVapiId}
                className="w-full px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors"
              >
                {linking ? 'Linking…' : 'Link Number'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test tab */}
      {tab === 'test' && (
        agent.vapi_assistant_id ? (
          <TestCallPanel vapiAssistantId={agent.vapi_assistant_id} />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md">
            <p className="text-sm text-slate-500">Save the agent first to create a Vapi assistant before testing.</p>
          </div>
        )
      )}

      {/* Logs tab */}
      {tab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-medium text-slate-900">Call Logs</h2>
          </div>
          {logs.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400 text-sm">No calls yet</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {logs.map((log) => (
                <div key={log.id} className="px-6 py-3 flex items-center gap-4 text-sm">
                  <div className="flex-1">
                    <span className="font-medium text-slate-800">{log.caller_phone}</span>
                    {log.caller_name && <span className="text-slate-400 ml-2">· {log.caller_name}</span>}
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
      )}

      {/* Add Skill Modal */}
      {showSkillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Add Skill</h2>
            <form onSubmit={saveSkill} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Skill Type</label>
                <select
                  value={skillType}
                  onChange={(e) => setSkillType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="check_availability">check_availability</option>
                  <option value="schedule_appointment">schedule_appointment</option>
                  <option value="reschedule_appointment">reschedule_appointment</option>
                  <option value="cancel_appointment">cancel_appointment</option>
                  <option value="send_sms">send_sms</option>
                  <option value="custom">custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tool Name (used by Vapi)</label>
                <input
                  type="text"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  required
                  placeholder="e.g. check_availability"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={skillDescription}
                  onChange={(e) => setSkillDescription(e.target.value)}
                  required
                  rows={2}
                  placeholder="Describe what this tool does so the LLM knows when to use it"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parameters Schema (JSON)</label>
                <textarea
                  value={skillSchema}
                  onChange={(e) => setSkillSchema(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {skillType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Action Config (JSON)</label>
                  <textarea
                    value={skillActionConfig}
                    onChange={(e) => setSkillActionConfig(e.target.value)}
                    rows={4}
                    placeholder='{"url": "https://...", "method": "POST"}'
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="skillEnabled"
                  checked={skillEnabled}
                  onChange={(e) => setSkillEnabled(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="skillEnabled" className="text-sm text-slate-700">Enabled</label>
              </div>

              {skillError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{skillError}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSkillModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={skillSaving} className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {skillSaving ? 'Saving…' : 'Add Skill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
