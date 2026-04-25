# Voice Agent Web App — Planning Doc

## Overview

A web application for configuring and managing AI voice agents across multiple clients. Each client gets a dedicated voice agent with its own phone number. When a potential customer calls and the client misses the call, the voice agent answers, collects necessary information from the caller, checks the client's Google Calendar for availability, and schedules an appointment.

**Problem:** Clients miss inbound calls from potential customers and lose business.
**Solution:** AI voice agents that answer missed calls, qualify leads, and book appointments automatically.

---

## Core Features

### 1. Multi-Agent Management
- Create, configure, and manage multiple voice agents from a single dashboard
- Each agent is assigned to a specific client
- Each agent has its own dedicated phone number
- Enable/disable agents without deleting configuration
- White-label branding (basic — no custom logos or domains yet)

### 2. Agent Configuration
- **Custom system prompt** — Define personality, tone, business context, and conversation flow per agent
- **Business details** — Client name, business type, services offered, operating hours
- **Call handling rules** — Greeting message, fallback behavior, transfer rules, voicemail settings

### 3. Skills / Tools Builder
- Create custom skills (tools) for each agent to use during calls
- Built-in skill types:
  - **Check calendar availability** — Query the client's Google Calendar for open slots (enforces 60-minute buffer between appointments)
  - **Schedule appointment** — Create a calendar event with caller details
  - **Edit/reschedule appointment** — Modify existing events (callers call back and verify by providing their name + existing appointment details)
  - **Collect information** — Structured data capture (name, phone, email, reason for visit)
  - **Send SMS confirmation** — Text the caller a booking confirmation (no email collected on calls)
- Custom skill creation:
  - Define skill name, description, and parameters
  - Configure API endpoints or webhook URLs the skill calls
  - Set input/output schemas

### 4. Google Calendar Integration (Per-Client OAuth)
- Each client authorizes access to their own Google Calendar
- OAuth 2.0 flow initiated from the web app
- Store refresh tokens securely per client
- Capabilities:
  - **Read availability** — Check free/busy status across selected calendars
  - **Create events** — Book appointments with caller details in the event description
  - **Edit events** — Reschedule or update appointment details
  - **Select calendars** — Client chooses which calendar(s) the agent uses

### 5. Phone Number Management
- Provision phone numbers via Vapi (handles Twilio under the hood)
- Assign/reassign numbers to agents
- Agent answers all calls to its provisioned number
- Display number status (active, inactive)
- Support for local and toll-free numbers

### 6. Billing
- Monthly recurring flat-rate tiers
- Each tier limits the number of call minutes per month
- Usage tracking dashboard for admin

---

## User Roles

| Role | Description | Access |
|------|-------------|--------|
| **Admin (You)** | Manages all clients and agents | Full access — create/edit/delete agents, edit prompts and skills, manage billing, view all call logs |
| **Client** | Authorizes calendar, views stats | Connect Google Calendar, view call logs and appointment stats for their agent (read-only, cannot edit agent config) |

Clients need accounts from day one so they can authorize their own Google Calendar via OAuth.

---

## Key Screens / Pages

### Dashboard
- Overview of all agents with status indicators (active/inactive, calls today/past 7 days/past 30 days)
- Quick stats: total calls handled, appointments booked

### Agent Configuration Page
- **General tab** — Agent name, assigned client, phone number, status toggle
- **Prompt tab** — Full system prompt editor with preview/test mode
- **Skills tab** — List of enabled skills, skill builder interface
- **Calendar tab** — Google Calendar connection status, authorized calendars, re-auth button
- **Call log tab** — History of calls handled by this agent with transcripts and outcomes

### Skills Editor
- Visual builder for creating/editing agent skills
- Define: skill name, description, parameters (name, type, required/optional)
- Configure: action type (Google Calendar, webhook, API call)
- Test: dry-run a skill with sample inputs

### Google Calendar Authorization Flow
- Per-client OAuth consent screen
- Step 1: Admin initiates "Connect Google Calendar" for a specific agent/client
- Step 2: Client (or admin on their behalf) completes Google OAuth consent
- Step 3: App stores refresh token, displays connected calendars
- Step 4: Admin selects which calendars the agent can read/write

### Settings
- Telephony provider configuration (API keys)
- Voice AI provider configuration
- Default agent prompt templates
- Billing / usage overview

---

## Technical Considerations

### Architecture
```
[Inbound Call] → [Telephony Provider (Twilio)] → [Voice AI Engine] → [Agent Backend]
                                                                         ↓
                                                              [Skills Execution Layer]
                                                                    ↓          ↓
                                                          [Google Calendar]  [Webhooks/APIs]
```

### Voice AI + Telephony: Vapi
- **Vapi** — Purpose-built voice agent platform with built-in Twilio integration
- Handles telephony, phone number provisioning, and voice AI in one platform
- Supports custom function/tool calling (for Google Calendar skills)
- No need to manage Twilio separately
- API for programmatic agent creation and configuration

### Google Calendar OAuth 2.0
- Register app in Google Cloud Console
- Scopes needed: `calendar.readonly`, `calendar.events`, `calendar.freebusy`
- Store per-client refresh tokens encrypted in database
- Handle token refresh automatically
- Must handle: consent revocation, token expiry, re-authorization flow

### Data Model (Sketch)

```
Admin
  ├── id, email, password_hash

Client
  ├── id, name, business_name, admin_id
  ├── google_oauth_token (encrypted)
  ├── google_calendar_ids[]

Agent
  ├── id, client_id, name, status
  ├── phone_number
  ├── system_prompt (text)
  ├── voice_provider_agent_id

Skill
  ├── id, agent_id, name, description
  ├── type (calendar_check, calendar_book, webhook, custom)
  ├── parameters_schema (JSON)
  ├── action_config (JSON — endpoint, method, headers, body template)

CallLog
  ├── id, agent_id, caller_phone, timestamp
  ├── duration, transcript, outcome
  ├── appointment_created (boolean), event_id
```

### Tech Stack
- **Frontend:** Next.js (React) — dashboard, agent config, skills editor
- **Backend:** Next.js API routes
- **Database:** Supabase (Postgres + auth + realtime)
- **Auth:** NextAuth.js (admin + client login)
- **OAuth:** Google APIs Node.js client library (per-client calendar auth)
- **Voice AI + Telephony:** Vapi (phone numbers, calls, and AI agent runtime)
- **SMS:** Twilio SMS (already in the stack via Vapi — simplifies integration)
- **Hosting:** Vercel (natural fit for Next.js, edge functions, easy deploys)
- **Billing:** Stripe (subscription tiers with metered usage for call minutes)

---

## Google Calendar Integration — Detailed Flow

### Authorization
1. Admin creates the agent and invites the client (e.g., sends a link to the app)
2. Client creates an account / logs into the app
3. Client clicks "Connect Google Calendar" on their dashboard
4. App redirects client to Google OAuth consent screen (with client-specific state parameter)
5. Client signs in with their own Google account and grants calendar permissions
6. Google redirects back to the app with an auth code
7. App exchanges auth code for access + refresh tokens
8. Tokens stored encrypted, linked to the client's record
9. Client selects which calendar(s) the agent should use

### Checking Availability
1. During a call, agent invokes "check availability" skill
2. Backend calls Google Calendar Freebusy API with selected calendar IDs
3. Filters out slots that don't have a 60-minute buffer from adjacent events
4. Returns available time slots to the voice agent
5. Agent presents options to the caller

### Booking an Appointment
1. Caller selects a time slot
2. Agent invokes "schedule appointment" skill with: date/time, caller name, phone, reason
3. Backend calls Google Calendar Events API to create event
4. Event includes: caller info in description, client as organizer
5. Agent confirms booking to the caller

---

## Decisions Made

| Decision | Answer |
|----------|--------|
| Voice AI provider | Vapi (includes Twilio, function calling, phone provisioning) |
| Client self-service | Clients can log in to view stats and connect calendar; only admin can edit agents |
| Call routing | Agent answers all calls to its Vapi-provisioned number |
| Confirmations | SMS text confirmation to caller (no email collected on calls) |
| Multi-calendar | No — one calendar per agent |
| Cancellation/rescheduling | Yes — callers can call back to modify appointments |
| Billing model | Monthly flat-rate tiers with call-minute limits |
| Hosting | Vercel |
| Branding | White-label for clients |
| Compliance | No disclosure required at start of calls |
| White-label scope | No logo or custom domain yet — basic white-label only |
| Caller rescheduling verification | Caller confirms identity using their name + existing appointment details |
| Appointment buffer | 60 minutes between each appointment |
| SMS provider | Twilio (already in the stack via Vapi — one fewer vendor) |

## All Open Questions Resolved

No remaining open questions.
