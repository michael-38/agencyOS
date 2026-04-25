export interface Admin {
  id: string
  email: string
  name: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  admin_id: string
  name: string
  business_name: string
  email: string
  status: 'invited' | 'active' | 'inactive'
  google_access_token_enc?: string
  google_refresh_token_enc?: string
  google_token_expiry?: string
  google_calendar_id?: string
  invite_token?: string
  invite_expires_at?: string
  created_at: string
  updated_at: string
}

export type VoiceProvider = '11labs' | 'azure' | 'deepgram' | 'lmnt' | 'openai' | 'playht' | 'rime-ai' | 'vapi'
export type ModelProvider = 'openai' | 'anthropic' | 'together-ai' | 'anyscale' | 'groq' | 'deepinfra' | 'custom-llm'
export type BackgroundSound = 'off' | 'office' | 'café'

export interface Agent {
  id: string
  client_id: string
  name: string
  system_prompt: string
  status: 'active' | 'inactive'
  phone_number?: string
  vapi_assistant_id?: string
  vapi_phone_number_id?: string
  // Voice & Speech
  voice_provider: VoiceProvider
  voice_id: string
  first_message: string
  language: string
  // Behavior
  max_duration_seconds: number
  silence_timeout_seconds: number
  response_delay_seconds: number
  end_call_phrases: string[]
  background_sound: BackgroundSound
  interruption_sensitivity: number
  // Model
  model_provider: ModelProvider
  model: string
  temperature: number
  max_tokens: number
  // Telephony
  voicemail_detection_enabled: boolean
  forwarding_phone_number?: string
  created_at: string
  updated_at: string
}

export type SkillType =
  | 'check_availability'
  | 'schedule_appointment'
  | 'reschedule_appointment'
  | 'cancel_appointment'
  | 'send_sms'
  | 'custom'

export interface Skill {
  id: string
  agent_id: string
  name: string
  description: string
  type: SkillType
  parameters_schema: Record<string, unknown>
  action_config: Record<string, unknown>
  enabled: boolean
  created_at: string
  updated_at: string
}

export type CallOutcome =
  | 'appointment_booked'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'info_collected'
  | 'no_action'

export interface CallLog {
  id: string
  agent_id: string
  vapi_call_id: string
  caller_phone: string
  started_at: string
  ended_at?: string
  duration_seconds?: number
  transcript?: string
  outcome: CallOutcome
  appointment_event_id?: string
  caller_name?: string
  caller_reason?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface BillingTier {
  id: string
  name: string
  monthly_price_cents: number
  minute_limit: number
  stripe_price_id: string
  created_at: string
}

export interface ClientSubscription {
  id: string
  client_id: string
  billing_tier_id: string
  stripe_subscription_id: string
  stripe_customer_id: string
  status: 'active' | 'canceled' | 'past_due'
  current_period_start: string
  current_period_end: string
  minutes_used: number
  created_at: string
  updated_at: string
}
