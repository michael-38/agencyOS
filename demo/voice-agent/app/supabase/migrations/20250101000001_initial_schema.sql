-- Voice Agent Manager — Initial Schema
-- Run this in your Supabase SQL editor or via the Supabase CLI

CREATE TABLE admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admins(id),
  name text NOT NULL,
  business_name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text,
  status text NOT NULL DEFAULT 'invited',
  google_access_token_enc text,
  google_refresh_token_enc text,
  google_token_expiry timestamptz,
  google_calendar_id text,
  invite_token text,
  invite_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  name text NOT NULL,
  system_prompt text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'inactive',
  phone_number text,
  vapi_assistant_id text,
  vapi_phone_number_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  type text NOT NULL,
  parameters_schema jsonb NOT NULL DEFAULT '{}',
  action_config jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id),
  vapi_call_id text UNIQUE NOT NULL,
  caller_phone text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds integer,
  transcript text,
  outcome text NOT NULL DEFAULT 'no_action',
  appointment_event_id text,
  caller_name text,
  caller_reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  monthly_price_cents integer NOT NULL,
  minute_limit integer NOT NULL,
  stripe_price_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE client_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid UNIQUE NOT NULL REFERENCES clients(id),
  billing_tier_id uuid NOT NULL REFERENCES billing_tiers(id),
  stripe_subscription_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  status text NOT NULL,
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  minutes_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agents_client_id ON agents(client_id);
CREATE INDEX idx_skills_agent_id ON skills(agent_id);
CREATE INDEX idx_call_logs_agent_id ON call_logs(agent_id);
CREATE INDEX idx_call_logs_started_at ON call_logs(started_at);
CREATE INDEX idx_call_logs_agent_started ON call_logs(agent_id, started_at);
CREATE INDEX idx_clients_admin_id ON clients(admin_id);
CREATE INDEX idx_clients_invite_token ON clients(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX idx_client_subscriptions_client ON client_subscriptions(client_id);
CREATE INDEX idx_agents_vapi_assistant ON agents(vapi_assistant_id);
CREATE INDEX idx_call_logs_vapi_call ON call_logs(vapi_call_id);

-- Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_own_data" ON clients
  FOR SELECT USING (id = auth.uid());

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_call_logs" ON call_logs
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE client_id = auth.uid())
  );

-- Function to increment minutes used for billing
CREATE OR REPLACE FUNCTION increment_minutes_used(p_client_id uuid, p_minutes integer)
RETURNS void AS $$
BEGIN
  UPDATE client_subscriptions
  SET minutes_used = minutes_used + p_minutes,
      updated_at = now()
  WHERE client_id = p_client_id
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed default billing tiers (update stripe_price_id with real Stripe Price IDs)
INSERT INTO billing_tiers (name, monthly_price_cents, minute_limit, stripe_price_id) VALUES
  ('Starter', 9900, 120, 'price_starter_placeholder'),
  ('Pro', 29900, 500, 'price_pro_placeholder'),
  ('Enterprise', 99900, 2000, 'price_enterprise_placeholder');
