import crypto from 'crypto'
import type { Agent, Skill } from '@/types'

const VAPI_BASE = 'https://api.vapi.ai'

function vapiHeaders() {
  return {
    Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export function verifyVapiSignature(body: string, headers: Headers): boolean {
  const signature = headers.get('x-vapi-signature')
  if (!signature || !process.env.VAPI_WEBHOOK_SECRET) return false
  const expected = crypto
    .createHmac('sha256', process.env.VAPI_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export function buildVapiAssistantPayload(agent: Agent, skills: Skill[]) {
  const tools = buildVapiToolsFromSkills(skills)

  const payload: Record<string, unknown> = {
    name: agent.name,
    model: {
      provider: agent.model_provider || 'openai',
      model: agent.model || 'gpt-4o',
      messages: [{ role: 'system', content: agent.system_prompt }],
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.max_tokens ?? 250,
      tools,
    },
    voice: {
      provider: agent.voice_provider || '11labs',
      voiceId: agent.voice_id || '21m00Tcm4TlvDq8ikWAM',
    },
    serverUrl: `${process.env.NEXTAUTH_URL}/api/vapi/call-ended`,
    maxDurationSeconds: agent.max_duration_seconds ?? 1800,
    silenceTimeoutSeconds: agent.silence_timeout_seconds ?? 30,
    responseDelaySeconds: agent.response_delay_seconds ?? 0.4,
    backgroundSound: agent.background_sound || 'off',
    backchannelingEnabled: false,
  }

  if (agent.first_message) {
    payload.firstMessage = agent.first_message
  }
  if (agent.language && agent.language !== 'en') {
    payload.transcriber = { provider: 'deepgram', language: agent.language }
  }
  if (agent.end_call_phrases && agent.end_call_phrases.length > 0) {
    payload.endCallPhrases = agent.end_call_phrases
  }
  if (agent.interruption_sensitivity != null && agent.interruption_sensitivity !== 1) {
    payload.interruptionsEnabled = true
  }
  if (agent.voicemail_detection_enabled) {
    payload.voicemailDetection = { enabled: true }
  }
  if (agent.forwarding_phone_number) {
    payload.forwardingPhoneNumber = agent.forwarding_phone_number
  }

  return payload
}

export async function createVapiAssistant(agent: Agent, skills: Skill[]) {
  const payload = buildVapiAssistantPayload(agent, skills)

  const res = await fetch(`${VAPI_BASE}/assistant`, {
    method: 'POST',
    headers: vapiHeaders(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error(`Vapi createAssistant failed: ${await res.text()}`)
  return res.json()
}

export async function updateVapiAssistant(vapiAssistantId: string, updates: object) {
  const res = await fetch(`${VAPI_BASE}/assistant/${vapiAssistantId}`, {
    method: 'PATCH',
    headers: vapiHeaders(),
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`Vapi updateAssistant failed: ${await res.text()}`)
  return res.json()
}

export async function deleteVapiAssistant(vapiAssistantId: string) {
  await fetch(`${VAPI_BASE}/assistant/${vapiAssistantId}`, {
    method: 'DELETE',
    headers: vapiHeaders(),
  })
}

export async function provisionPhoneNumber(assistantId: string, areaCode?: string) {
  const body: Record<string, unknown> = {
    provider: 'twilio',
    assistantId,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  }
  if (areaCode) {
    body.numberDesiredAreaCode = areaCode
  }

  const res = await fetch(`${VAPI_BASE}/phone-number`, {
    method: 'POST',
    headers: vapiHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Vapi provisionPhoneNumber failed: ${await res.text()}`)
  return res.json()
}

export async function linkPhoneNumber(phoneNumberId: string, assistantId: string) {
  const res = await fetch(`${VAPI_BASE}/phone-number/${phoneNumberId}`, {
    method: 'PATCH',
    headers: vapiHeaders(),
    body: JSON.stringify({ assistantId }),
  })
  if (!res.ok) throw new Error(`Vapi linkPhoneNumber failed: ${await res.text()}`)
  return res.json()
}

export async function releasePhoneNumber(phoneNumberId: string) {
  await fetch(`${VAPI_BASE}/phone-number/${phoneNumberId}`, {
    method: 'DELETE',
    headers: vapiHeaders(),
  })
}

export function buildVapiToolsFromSkills(skills: Skill[]) {
  return skills
    .filter((s) => s.enabled)
    .map((skill) => ({
      type: 'function' as const,
      function: {
        name: skill.name,
        description: skill.description,
        parameters: skill.parameters_schema,
      },
      server: {
        url: `${process.env.NEXTAUTH_URL}/api/vapi/tool-call`,
        secret: process.env.VAPI_WEBHOOK_SECRET,
      },
    }))
}
