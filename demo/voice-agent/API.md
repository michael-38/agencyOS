# API Specification

All routes are Next.js API routes under `/api/`. Auth is via NextAuth.js session cookies. Role is checked server-side.

## Authentication

### POST /api/auth/[...nextauth]
Standard NextAuth.js routes. Supports credentials provider for both admin and client login.

---

## Clients

### GET /api/clients
**Auth:** Admin only
**Query params:** `?status=active` (optional filter)
**Response:**
```json
{
  "clients": [
    {
      "id": "uuid",
      "name": "John Doe",
      "business_name": "Doe Plumbing",
      "email": "john@doeplumbing.com",
      "status": "active",
      "google_connected": true,
      "google_calendar_id": "primary",
      "created_at": "2026-04-01T00:00:00Z"
    }
  ]
}
```

### POST /api/clients
**Auth:** Admin only
**Body:**
```json
{
  "name": "John Doe",
  "business_name": "Doe Plumbing",
  "email": "john@doeplumbing.com"
}
```
**Response:** 201 — Created client object
**Side effect:** Generates invite_token, sends invite email

### GET /api/clients/[clientId]
**Auth:** Admin or the client themselves
**Response:** Full client object (tokens excluded)

### PUT /api/clients/[clientId]
**Auth:** Admin only
**Body:** Partial client fields to update
**Response:** Updated client object

### DELETE /api/clients/[clientId]
**Auth:** Admin only
**Response:** 200 — Soft deletes (sets status = 'inactive')

### POST /api/clients/invite
**Auth:** Admin only
**Body:** `{ "clientId": "uuid" }`
**Response:** 200 — Resends invite email with new token

---

## Agents

### GET /api/agents
**Auth:** Admin (all agents) or Client (their agent only)
**Query params:** `?clientId=uuid` (optional, admin only)
**Response:**
```json
{
  "agents": [
    {
      "id": "uuid",
      "client_id": "uuid",
      "name": "Doe Plumbing Agent",
      "status": "active",
      "phone_number": "+15551234567",
      "vapi_assistant_id": "asst_xxx",
      "created_at": "2026-04-01T00:00:00Z"
    }
  ]
}
```

### POST /api/agents
**Auth:** Admin only
**Body:**
```json
{
  "client_id": "uuid",
  "name": "Doe Plumbing Agent",
  "system_prompt": "You are a helpful receptionist for Doe Plumbing...",
  "provision_phone_number": true,
  "phone_number_area_code": "555"
}
```
**Response:** 201 — Created agent object with vapi_assistant_id
**Side effects:**
1. Creates Vapi assistant via API
2. If `provision_phone_number`, provisions Vapi phone number and links to assistant

### GET /api/agents/[agentId]
**Auth:** Admin or owning client
**Response:** Full agent object including system_prompt

### PUT /api/agents/[agentId]
**Auth:** Admin only
**Body:** Partial agent fields (name, system_prompt, status)
**Response:** Updated agent object
**Side effect:** Updates Vapi assistant if prompt or status changed

### DELETE /api/agents/[agentId]
**Auth:** Admin only
**Response:** 200
**Side effects:** Deletes Vapi assistant and releases phone number

---

## Skills

### GET /api/agents/[agentId]/skills
**Auth:** Admin only
**Response:**
```json
{
  "skills": [
    {
      "id": "uuid",
      "name": "check_availability",
      "description": "Check available appointment slots",
      "type": "check_availability",
      "parameters_schema": { ... },
      "enabled": true
    }
  ]
}
```

### POST /api/agents/[agentId]/skills
**Auth:** Admin only
**Body:**
```json
{
  "name": "check_availability",
  "description": "Check the client's Google Calendar for available appointment slots",
  "type": "check_availability",
  "parameters_schema": {
    "type": "object",
    "properties": {
      "date": { "type": "string", "description": "Date to check (YYYY-MM-DD)" },
      "time_range_start": { "type": "string", "description": "Earliest time (HH:MM)" },
      "time_range_end": { "type": "string", "description": "Latest time (HH:MM)" }
    },
    "required": ["date"]
  }
}
```
**Response:** 201 — Created skill
**Side effect:** Updates Vapi assistant tool definitions

### PUT /api/agents/[agentId]/skills/[skillId]
**Auth:** Admin only
**Body:** Partial skill fields
**Response:** Updated skill
**Side effect:** Updates Vapi assistant tool definitions

### DELETE /api/agents/[agentId]/skills/[skillId]
**Auth:** Admin only
**Response:** 200
**Side effect:** Removes tool from Vapi assistant

---

## Google Calendar OAuth

### GET /api/auth/google/authorize
**Auth:** Authenticated client
**Query params:** `?clientId=uuid`
**Response:** Redirects to Google OAuth consent URL

### GET /api/auth/google/callback
**Auth:** None (OAuth callback)
**Query params:** `?code=xxx&state=xxx`
**Response:** Redirects to /client/calendar with success/error status
**Side effects:**
1. Exchanges code for tokens
2. Encrypts and stores tokens on client record
3. Fetches calendar list

### GET /api/clients/[clientId]/calendars
**Auth:** Admin or owning client
**Response:**
```json
{
  "calendars": [
    { "id": "primary", "summary": "John's Calendar", "primary": true },
    { "id": "xxx@group.calendar.google.com", "summary": "Business Hours" }
  ],
  "selected_calendar_id": "primary"
}
```

### PUT /api/clients/[clientId]/calendars
**Auth:** Admin or owning client
**Body:** `{ "calendar_id": "primary" }`
**Response:** 200

---

## Vapi Webhooks

### POST /api/vapi/tool-call
**Auth:** Vapi webhook signature verification
**Body (from Vapi):**
```json
{
  "message": {
    "type": "tool-calls",
    "call": { "id": "call_xxx", "assistantId": "asst_xxx" },
    "toolCallList": [
      {
        "id": "tc_xxx",
        "function": {
          "name": "check_availability",
          "arguments": { "date": "2026-04-10" }
        }
      }
    ]
  }
}
```
**Response:**
```json
{
  "results": [
    {
      "toolCallId": "tc_xxx",
      "result": {
        "available_slots": [
          { "start": "2026-04-10T09:00:00", "end": "2026-04-10T10:00:00" },
          { "start": "2026-04-10T11:00:00", "end": "2026-04-10T12:00:00" }
        ]
      }
    }
  ]
}
```

**Tool execution logic by type:**
- `check_availability` → Google Calendar Freebusy API + 60-min buffer filter
- `schedule_appointment` → Google Calendar Events insert + Twilio SMS
- `reschedule_appointment` → Search events by caller name, update event time
- `cancel_appointment` → Search events by caller name, delete event
- `send_sms` → Twilio SMS API
- `custom` → HTTP request to configured webhook URL

### POST /api/vapi/call-ended
**Auth:** Vapi webhook signature verification
**Body (from Vapi):**
```json
{
  "message": {
    "type": "end-of-call-report",
    "call": { "id": "call_xxx", "assistantId": "asst_xxx" },
    "startedAt": "2026-04-10T14:00:00Z",
    "endedAt": "2026-04-10T14:05:30Z",
    "transcript": "...",
    "summary": "...",
    "customer": { "number": "+15559876543" }
  }
}
```
**Side effects:**
1. Creates call_log record
2. Updates client_subscription.minutes_used

---

## Call Logs

### GET /api/call-logs
**Auth:** Admin (all) or Client (their agent's logs only)
**Query params:**
- `?agentId=uuid` — filter by agent
- `?clientId=uuid` — filter by client (admin only)
- `?from=2026-04-01&to=2026-04-30` — date range
- `?outcome=appointment_booked` — filter by outcome
- `?page=1&limit=50` — pagination
**Response:**
```json
{
  "call_logs": [ ... ],
  "total": 150,
  "page": 1,
  "limit": 50
}
```

---

## Phone Numbers

### GET /api/phone-numbers
**Auth:** Admin only
**Response:**
```json
{
  "phone_numbers": [
    {
      "number": "+15551234567",
      "vapi_id": "pn_xxx",
      "assigned_agent_id": "uuid",
      "status": "active"
    }
  ]
}
```

### POST /api/phone-numbers
**Auth:** Admin only
**Body:** `{ "area_code": "555" }`
**Response:** 201 — Provisioned phone number
**Side effect:** Provisions number via Vapi API

---

## Billing

### GET /api/billing
**Auth:** Admin only
**Response:**
```json
{
  "clients": [
    {
      "client_id": "uuid",
      "business_name": "Doe Plumbing",
      "tier": "Pro",
      "minutes_used": 120,
      "minute_limit": 500,
      "status": "active",
      "current_period_end": "2026-05-01T00:00:00Z"
    }
  ]
}
```

### POST /api/billing/webhook
**Auth:** Stripe webhook signature verification
**Handles events:**
- `invoice.paid` — reset minutes_used, update period dates
- `customer.subscription.updated` — update status, tier
- `customer.subscription.deleted` — mark inactive

---

## Dashboard Stats

### GET /api/stats
**Auth:** Admin (all agents) or Client (their agent)
**Query params:** `?agentId=uuid` (optional)
**Response:**
```json
{
  "calls_today": 5,
  "calls_7d": 28,
  "calls_30d": 112,
  "appointments_booked_today": 3,
  "appointments_booked_7d": 18,
  "appointments_booked_30d": 74
}
```
