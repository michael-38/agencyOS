# Database Schema — Supabase (PostgreSQL)

## Tables

### admins

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| email | text | UNIQUE, NOT NULL | |
| password_hash | text | NOT NULL | Hashed via bcrypt |
| name | text | NOT NULL | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

### clients

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| admin_id | uuid | FK → admins.id, NOT NULL | |
| name | text | NOT NULL | Contact name |
| business_name | text | NOT NULL | |
| email | text | UNIQUE, NOT NULL | Login email |
| password_hash | text | NULL | Set when client accepts invite |
| status | text | NOT NULL, default 'invited' | 'invited', 'active', 'inactive' |
| google_access_token_enc | text | NULL | AES-256 encrypted |
| google_refresh_token_enc | text | NULL | AES-256 encrypted |
| google_token_expiry | timestamptz | NULL | When access token expires |
| google_calendar_id | text | NULL | Selected calendar ID |
| invite_token | text | NULL | For invite link, cleared on accept |
| invite_expires_at | timestamptz | NULL | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

### agents

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| client_id | uuid | FK → clients.id, NOT NULL | |
| name | text | NOT NULL | Display name for the agent |
| system_prompt | text | NOT NULL, default '' | The LLM system prompt |
| status | text | NOT NULL, default 'inactive' | 'active', 'inactive' |
| phone_number | text | NULL | E.164 format |
| vapi_assistant_id | text | NULL | Vapi assistant ID |
| vapi_phone_number_id | text | NULL | Vapi phone number resource ID |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

### skills

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| agent_id | uuid | FK → agents.id, NOT NULL | |
| name | text | NOT NULL | Skill name (used as tool name in Vapi) |
| description | text | NOT NULL | Shown to the LLM to decide when to use |
| type | text | NOT NULL | 'check_availability', 'schedule_appointment', 'reschedule_appointment', 'cancel_appointment', 'send_sms', 'custom' |
| parameters_schema | jsonb | NOT NULL, default '{}' | JSON Schema for tool parameters |
| action_config | jsonb | NOT NULL, default '{}' | For custom type: { url, method, headers, body_template } |
| enabled | boolean | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

### call_logs

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| agent_id | uuid | FK → agents.id, NOT NULL | |
| vapi_call_id | text | UNIQUE, NOT NULL | Vapi's call ID |
| caller_phone | text | NOT NULL | E.164 format |
| started_at | timestamptz | NOT NULL | |
| ended_at | timestamptz | NULL | |
| duration_seconds | integer | NULL | Computed from start/end |
| transcript | text | NULL | Full call transcript from Vapi |
| outcome | text | NOT NULL, default 'no_action' | 'appointment_booked', 'appointment_rescheduled', 'appointment_cancelled', 'info_collected', 'no_action' |
| appointment_event_id | text | NULL | Google Calendar event ID if created |
| caller_name | text | NULL | Collected during call |
| caller_reason | text | NULL | Reason for the call |
| metadata | jsonb | NULL | Any additional data from the call |
| created_at | timestamptz | NOT NULL, default now() | |

### billing_tiers

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| name | text | NOT NULL | e.g., 'Starter', 'Pro', 'Enterprise' |
| monthly_price_cents | integer | NOT NULL | Price in cents |
| minute_limit | integer | NOT NULL | Max call minutes per month |
| stripe_price_id | text | NOT NULL | Stripe Price object ID |
| created_at | timestamptz | NOT NULL, default now() | |

### client_subscriptions

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| client_id | uuid | FK → clients.id, UNIQUE, NOT NULL | One subscription per client |
| billing_tier_id | uuid | FK → billing_tiers.id, NOT NULL | |
| stripe_subscription_id | text | NOT NULL | |
| stripe_customer_id | text | NOT NULL | |
| status | text | NOT NULL | 'active', 'canceled', 'past_due' |
| current_period_start | timestamptz | NOT NULL | |
| current_period_end | timestamptz | NOT NULL | |
| minutes_used | integer | NOT NULL, default 0 | Reset each billing period |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_agents_client_id ON agents(client_id);
CREATE INDEX idx_skills_agent_id ON skills(agent_id);
CREATE INDEX idx_call_logs_agent_id ON call_logs(agent_id);
CREATE INDEX idx_call_logs_started_at ON call_logs(started_at);
CREATE INDEX idx_call_logs_agent_started ON call_logs(agent_id, started_at);
CREATE INDEX idx_clients_admin_id ON clients(admin_id);
CREATE INDEX idx_clients_invite_token ON clients(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX idx_client_subscriptions_client ON client_subscriptions(client_id);

-- Vapi lookups (used during webhook processing)
CREATE INDEX idx_agents_vapi_assistant ON agents(vapi_assistant_id);
CREATE INDEX idx_call_logs_vapi_call ON call_logs(vapi_call_id);
```

## Row-Level Security (Supabase RLS)

```sql
-- Clients can only read their own data
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_own_data" ON clients
  FOR SELECT USING (id = auth.uid());

-- Clients can only see call logs for their agent
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_call_logs" ON call_logs
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE client_id = auth.uid())
  );

-- Admin bypasses RLS via service role key
-- All admin API routes use SUPABASE_SERVICE_ROLE_KEY
```

## Migration SQL

```sql
-- 001_initial_schema.sql

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
  agent_id uuid NOT NULL REFERENCES agents(id),
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
```
