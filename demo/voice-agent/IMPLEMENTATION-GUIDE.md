# Implementation Guide — Build Order

This document defines the order in which to build the app, with dependencies and acceptance criteria for each phase.

## Prerequisites

1. Create a new Next.js project in `demo/voice-agent/app/` with TypeScript, Tailwind CSS, App Router
2. Set up accounts and get API keys:
   - **Supabase** — Create project, get URL + anon key + service role key
   - **Vapi** — Create account, get API key
   - **Google Cloud Console** — Create project, enable Calendar API, create OAuth 2.0 credentials
   - **Twilio** — Create account (or use Vapi's Twilio), get Account SID + Auth Token + phone number
   - **Stripe** — Create account, get secret key + publishable key, set up webhook endpoint
3. Create `.env.local` with all environment variables (see ARCHITECTURE.md)

## Phase 1: Foundation

### 1.1 Database Setup
- Run migration SQL in Supabase (see DATABASE.md)
- Create indexes
- Enable RLS policies
- Seed admin user

**Acceptance:** Can connect to Supabase from Next.js, query admins table.

### 1.2 Authentication
- Install and configure NextAuth.js with credentials provider
- Support two user types: admin (from admins table) and client (from clients table)
- Add role field to JWT/session
- Create login page at `/login`
- Create middleware to protect `/admin/*` and `/client/*` routes

**Acceptance:** Admin can log in and is redirected to `/admin/dashboard`. Client can log in and is redirected to `/client/dashboard`. Unauthorized access redirects to `/login`.

### 1.3 Shared UI Components
- Set up Tailwind + a component library (shadcn/ui recommended)
- Create layout components for admin and client with sidebar navigation
- Build reusable components: DataTable, StatsCard, TabsContainer, FormField

**Acceptance:** Admin and client layouts render with navigation. Switching between pages works.

## Phase 2: Client & Agent Management (Admin)

### 2.1 Client CRUD
- API routes: GET/POST `/api/clients`, GET/PUT/DELETE `/api/clients/[clientId]`
- Admin pages: client list (`/admin/clients`), client detail (`/admin/clients/[clientId]`)
- Invite flow: POST `/api/clients/invite` generates token, sends email (use Resend or similar)

**Acceptance:** Admin can create a client, view client list, edit client details. Invite email is sent with a link.

### 2.2 Client Onboarding
- Accept-invite page: client clicks invite link, sets password
- Client login works after accepting invite

**Acceptance:** Client receives invite email, clicks link, sets password, can log in.

### 2.3 Agent CRUD
- API routes: GET/POST `/api/agents`, GET/PUT/DELETE `/api/agents/[agentId]`
- Admin pages: agent list, create agent form, agent detail with tabs
- **General tab:** name, client assignment, phone number display, status toggle
- **Prompt tab:** system prompt text editor (use a code editor component like Monaco or CodeMirror)

**Acceptance:** Admin can create an agent for a client, edit its name and prompt, toggle status.

## Phase 3: Vapi Integration

### 3.1 Vapi Client Library
- Create `src/lib/vapi.ts` with functions: createAssistant, updateAssistant, deleteAssistant, provisionPhoneNumber, releasePhoneNumber
- Add webhook signature verification

**Acceptance:** Unit tests pass for Vapi API wrapper functions.

### 3.2 Agent ↔ Vapi Sync
- When agent is created → create Vapi assistant + provision phone number
- When agent prompt/skills change → update Vapi assistant
- When agent is deleted → delete Vapi assistant + release number
- Store vapi_assistant_id and vapi_phone_number_id on agent record

**Acceptance:** Creating an agent in the UI provisions a real Vapi assistant and phone number. The phone number appears in the agent detail page.

### 3.3 Webhook Endpoints
- `POST /api/vapi/tool-call` — receives tool call requests, dispatches to skill handlers
- `POST /api/vapi/call-ended` — receives call summaries, creates call log records
- Both endpoints verify Vapi webhook signatures

**Acceptance:** Vapi webhooks reach the endpoints. A test call to the provisioned number triggers the tool-call webhook.

## Phase 4: Google Calendar Integration

### 4.1 OAuth Flow
- API routes: GET `/api/auth/google/authorize`, GET `/api/auth/google/callback`
- Create `src/lib/google-calendar.ts` with: getAuthUrl, exchangeCode, refreshToken, encrypt/decrypt helpers
- Client page: `/client/calendar` with "Connect Google Calendar" button
- After connecting, fetch and display calendar list, let client select one

**Acceptance:** Client clicks connect, completes Google OAuth, returns to app. Calendar list is displayed. Selected calendar ID is saved.

### 4.2 Availability Checking
- Create `src/lib/skills/check-availability.ts`
- Calls Google Calendar Freebusy API for the selected calendar
- Applies 60-minute buffer: for each busy block, extend end time by 60 minutes before computing free slots
- Returns available slots within business hours (configurable per agent, default 9am-5pm)

**Acceptance:** Calling the function with a date returns correct available slots with 60-min buffers enforced.

### 4.3 Appointment Booking
- Create `src/lib/skills/schedule-appointment.ts`
- Creates a Google Calendar event with:
  - Summary: "Appointment - {caller_name}"
  - Description: "Phone: {caller_phone}\nReason: {reason}\nBooked by voice agent"
  - Start/end time from the selected slot
- After booking, sends SMS via Twilio (see Phase 5)

**Acceptance:** Booking creates a real Google Calendar event. Event appears on the client's calendar.

### 4.4 Reschedule & Cancel
- Create `src/lib/skills/reschedule-appointment.ts`
  - Searches calendar events by caller name + original date
  - If found, updates event to new date/time
- Create `src/lib/skills/cancel-appointment.ts`
  - Searches calendar events by caller name + date
  - If found, deletes the event

**Acceptance:** Can reschedule and cancel events created by the booking skill.

### 4.5 Token Refresh
- Create `src/lib/encryption.ts` for AES-256 encrypt/decrypt
- Before any Google API call, check if access token is expired
- If expired, use refresh token to get a new access token
- If refresh fails, mark client as needing re-authorization

**Acceptance:** Tokens auto-refresh. Expired refresh tokens show a re-auth prompt on the client dashboard.

## Phase 5: SMS Confirmation

### 5.1 Twilio SMS
- Create `src/lib/twilio.ts` with sendSms function
- Create `src/lib/skills/send-sms.ts` skill handler
- SMS template: "Your appointment with {business_name} is confirmed for {date} at {time}. To reschedule, call {agent_phone_number}."

**Acceptance:** After booking an appointment, caller receives an SMS confirmation.

## Phase 6: Skills / Tools Builder

### 6.1 Built-in Skills
- When an agent is created, auto-create the 5 built-in skills (check_availability, schedule_appointment, reschedule_appointment, cancel_appointment, send_sms_confirmation)
- Admin can enable/disable each skill
- Skills tab on agent detail page shows all skills with toggle switches

**Acceptance:** New agents come with 5 built-in skills enabled. Admin can toggle them on/off.

### 6.2 Custom Skills
- Skills editor page for creating custom skills
- Form fields: name, description, parameter schema (JSON editor), action config (URL, method, headers, body template)
- Custom skills are registered as Vapi tools
- When invoked, the backend makes an HTTP request to the configured URL

**Acceptance:** Admin can create a custom skill with a webhook URL. During a call, Vapi invokes the skill and the webhook receives the request.

## Phase 7: Call Logs & Dashboard

### 7.1 Call Log Storage
- `POST /api/vapi/call-ended` handler creates call_log records (built in Phase 3.3)
- API route: GET `/api/call-logs` with filters (agent, client, date range, outcome, pagination)

### 7.2 Admin Dashboard
- `/admin/dashboard` shows: agent cards with status, calls today/7d/30d, appointments booked
- API route: GET `/api/stats`

### 7.3 Client Dashboard
- `/client/dashboard` shows: their agent's stats, recent call logs
- Call log table with: date, caller phone, duration, outcome, transcript (expandable)

### 7.4 Agent Call Log Tab
- Call log tab on agent detail page (admin view)
- Same table as client dashboard but accessible from agent config

**Acceptance:** Dashboard shows real stats from call_logs table. Call logs are filterable and paginated.

## Phase 8: Billing

### 8.1 Stripe Setup
- Create billing tiers as Stripe Products + Prices
- Create `src/lib/stripe.ts` with: createCustomer, createSubscription, getSubscription
- Seed billing_tiers table with Stripe price IDs

### 8.2 Subscription Management
- Admin can assign a billing tier to a client
- Creates Stripe customer + subscription
- Tracks minutes_used per billing period

### 8.3 Usage Tracking
- Call-ended webhook increments minutes_used on client_subscription
- Admin billing page shows usage per client
- Stripe webhook (`POST /api/billing/webhook`) handles: invoice.paid (reset minutes), subscription updates

**Acceptance:** Client has a subscription. Minutes are tracked. Usage resets each billing period.

## Phase 9: White-Label & Polish

### 9.1 White-Label Basics
- Client-facing pages show no admin branding
- Neutral UI: generic app name, no operator logo
- Clean, professional design

### 9.2 Error Handling
- Google token expiry → re-auth prompt
- Vapi API failures → rollback local changes, show error toast
- Stripe webhook failures → retry logic
- Call skill failures → return graceful error message to Vapi (agent says "I'm having trouble, let me connect you with someone")

### 9.3 Testing
- Test the full flow end-to-end:
  1. Admin creates client → client receives invite
  2. Client accepts invite → connects Google Calendar
  3. Admin creates agent with prompt and skills → Vapi assistant created
  4. Call the agent's phone number → agent answers, checks availability, books appointment
  5. Calendar event appears → SMS confirmation received
  6. Call back → reschedule appointment
  7. Check dashboard → call logs and stats are correct

## Dependency Graph

```
Phase 1 (Foundation)
  ├── 1.1 Database
  ├── 1.2 Auth (depends on 1.1)
  └── 1.3 UI Components

Phase 2 (Client & Agent CRUD) — depends on Phase 1
  ├── 2.1 Client CRUD
  ├── 2.2 Client Onboarding (depends on 2.1)
  └── 2.3 Agent CRUD (depends on 2.1)

Phase 3 (Vapi) — depends on 2.3
  ├── 3.1 Vapi Client
  ├── 3.2 Agent-Vapi Sync (depends on 3.1)
  └── 3.3 Webhooks (depends on 3.1)

Phase 4 (Google Calendar) — depends on 1.1
  ├── 4.1 OAuth Flow
  ├── 4.2 Availability (depends on 4.1)
  ├── 4.3 Booking (depends on 4.2)
  ├── 4.4 Reschedule/Cancel (depends on 4.3)
  └── 4.5 Token Refresh (depends on 4.1)

Phase 5 (SMS) — depends on 4.3

Phase 6 (Skills Builder) — depends on 3.2 + 4.2
  ├── 6.1 Built-in Skills
  └── 6.2 Custom Skills

Phase 7 (Logs & Dashboard) — depends on 3.3
  ├── 7.1 Call Log Storage
  ├── 7.2 Admin Dashboard
  ├── 7.3 Client Dashboard
  └── 7.4 Agent Call Log Tab

Phase 8 (Billing) — depends on 7.1

Phase 9 (Polish) — depends on all above
```

Note: Phases 4 and 3 can be built in parallel since they only converge at Phase 6.
