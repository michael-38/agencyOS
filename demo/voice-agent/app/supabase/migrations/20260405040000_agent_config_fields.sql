-- Add voice, behavior, model, and telephony configuration fields to agents

-- Voice & Speech
ALTER TABLE agents ADD COLUMN voice_provider text NOT NULL DEFAULT '11labs';
ALTER TABLE agents ADD COLUMN voice_id text NOT NULL DEFAULT '21m00Tcm4TlvDq8ikWAM';
ALTER TABLE agents ADD COLUMN first_message text NOT NULL DEFAULT '';
ALTER TABLE agents ADD COLUMN language text NOT NULL DEFAULT 'en';

-- Behavior
ALTER TABLE agents ADD COLUMN max_duration_seconds integer NOT NULL DEFAULT 1800;
ALTER TABLE agents ADD COLUMN silence_timeout_seconds integer NOT NULL DEFAULT 30;
ALTER TABLE agents ADD COLUMN response_delay_seconds numeric(4,2) NOT NULL DEFAULT 0.4;
ALTER TABLE agents ADD COLUMN end_call_phrases jsonb NOT NULL DEFAULT '[]';
ALTER TABLE agents ADD COLUMN background_sound text NOT NULL DEFAULT 'off';
ALTER TABLE agents ADD COLUMN interruption_sensitivity numeric(3,2) NOT NULL DEFAULT 1.0;

-- Model
ALTER TABLE agents ADD COLUMN model_provider text NOT NULL DEFAULT 'openai';
ALTER TABLE agents ADD COLUMN model text NOT NULL DEFAULT 'gpt-4o';
ALTER TABLE agents ADD COLUMN temperature numeric(3,2) NOT NULL DEFAULT 0.7;
ALTER TABLE agents ADD COLUMN max_tokens integer NOT NULL DEFAULT 250;

-- Telephony
ALTER TABLE agents ADD COLUMN voicemail_detection_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE agents ADD COLUMN forwarding_phone_number text;
