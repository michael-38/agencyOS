---
name: provision-voice-agent
description: Provision an AI voice (phone) agent for a client using the voice-agent SaaS (Vapi + Supabase + Next.js). Configures the assistant prompt, phone number, and skills (check availability, schedule/reschedule/cancel appointments via Google Calendar, SMS confirmations via Twilio). Use when asked to "set up a voice agent", "add a phone assistant", or "configure Vapi for <client>".
argument-hint: [client-name]
---

Provision a voice agent for **$ARGUMENTS**.

## Orient first (read the docs)
`demo/voice-agent/`: `ARCHITECTURE.md` (system + data flow), `PRD.md` (features), `VAPI-INTEGRATION.md` (assistant + tool/webhook setup), `DATABASE.md` (schema), `API.md`, `IMPLEMENTATION-GUIDE.md` (step-by-step how-to).

## Steps
1. Run the manager app: `cd demo/voice-agent/app && npm run dev`.
2. Create the client + agent: name, status, and the assistant **system prompt** (business-specific instructions). This syncs to a Vapi assistant.
3. Attach skills (tools) — defined as JSON schema, executed via webhook to the backend: `check_availability`, `schedule_appointment`, `reschedule_appointment`, `cancel_appointment`.
4. Connect the client's **Google Calendar** (per-client OAuth; tokens stored server-side) and a **Twilio** number for SMS confirmations. Enforce booking rules (e.g. the appointment buffer) server-side, not just in the prompt.
5. Verify with a test call; confirm the call log (caller, timestamp, duration, transcript, outcome) lands in Supabase.

## Rules
- Keep the agent scoped to the client's real services and policies.
- Never hardcode secrets in the prompt; connection config belongs in the app env (`.claude/agentos/connections.md`).
- Call logs are the agent's memory — read them to tune the prompt.
