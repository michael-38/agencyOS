# Technical Architecture

## System Overview

```
                                    ┌─────────────────────────────┐
                                    │        Vercel (Hosting)      │
                                    │  ┌───────────────────────┐  │
                                    │  │   Next.js App          │  │
                                    │  │  ┌─────────┐ ┌──────┐ │  │
 Admin / Client ──── Browser ──────►│  │  │ React UI│ │ API  │ │  │
                                    │  │  │ (Pages) │ │Routes│ │  │
                                    │  │  └─────────┘ └──┬───┘ │  │
                                    │  └─────────────────┼─────┘  │
                                    └────────────────────┼────────┘
                                                         │
                    ┌────────────────┬───────────────┬────┴──────────┬──────────────┐
                    ▼                ▼               ▼               ▼              ▼
              ┌──────────┐   ┌────────────┐  ┌────────────┐  ┌──────────┐  ┌─────────┐
              │ Supabase │   │  Vapi API  │  │  Google    │  │  Twilio  │  │ Stripe  │
              │ (DB+Auth)│   │ (Voice AI) │  │ Calendar   │  │  (SMS)   │  │(Billing)│
              └──────────┘   └─────┬──────┘  │  OAuth+API │  └──────────┘  └─────────┘
                                   │         └────────────┘
                                   │
                    Inbound Call ───┘
                    (Vapi answers, invokes tools via webhook)
```

## Request Flows

### Flow 1: Inbound Call → Appointment Booking

```
1. Caller dials agent's phone number
2. Vapi answers using the configured assistant (system prompt + tools)
3. Voice agent converses with caller, collects info
4. Agent invokes "check_availability" tool
   → Vapi sends POST to our webhook: /api/vapi/tool-call
   → Backend reads client's Google OAuth token from Supabase
   → Backend calls Google Calendar Freebusy API
   → Filters slots with 60-min buffer
   → Returns available slots to Vapi
5. Agent presents slots to caller, caller picks one
6. Agent invokes "schedule_appointment" tool
   → Vapi sends POST to our webhook: /api/vapi/tool-call
   → Backend creates Google Calendar event
   → Backend sends SMS confirmation via Twilio
   → Returns confirmation to Vapi
7. Agent confirms to caller, call ends
8. Vapi sends call-ended webhook: /api/vapi/call-ended
   → Backend creates CallLog record in Supabase
```

### Flow 2: Client Connects Google Calendar

```
1. Client logs into the app
2. Clicks "Connect Google Calendar"
3. Frontend redirects to: /api/auth/google/authorize?clientId=xxx
4. Backend generates Google OAuth URL with:
   - client_id (our Google Cloud app)
   - redirect_uri: /api/auth/google/callback
   - scope: calendar.readonly, calendar.events, calendar.freebusy
   - state: encrypted clientId
5. Client signs into Google, grants permissions
6. Google redirects to /api/auth/google/callback?code=xxx&state=xxx
7. Backend exchanges code for access_token + refresh_token
8. Tokens encrypted (AES-256) and stored in Supabase client record
9. Backend fetches calendar list, returns to frontend
10. Client selects which calendar the agent should use
11. Calendar ID saved to client record
```

### Flow 3: Admin Creates Agent

```
1. Admin fills out agent form (name, client, prompt)
2. Frontend POST /api/agents
3. Backend creates Agent record in Supabase
4. Backend calls Vapi API: POST /assistant
   - Sends: system prompt, model config, tool definitions
   - Receives: vapi_assistant_id
5. Backend saves vapi_assistant_id to Agent record
6. If phone number requested:
   - Backend calls Vapi API: POST /phone-number
   - Links phone number to the assistant
   - Saves phone number to Agent record
```

## Project Structure

```
demo/voice-agent/app/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout with auth provider
│   │   ├── page.tsx                  # Landing / login redirect
│   │   ├── login/
│   │   │   └── page.tsx              # Login page (admin + client)
│   │   ├── admin/
│   │   │   ├── layout.tsx            # Admin layout with sidebar nav
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx          # Admin dashboard — all agents overview
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx          # Client list
│   │   │   │   └── [clientId]/
│   │   │   │       └── page.tsx      # Client detail / edit
│   │   │   ├── agents/
│   │   │   │   ├── page.tsx          # Agent list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx      # Create agent form
│   │   │   │   └── [agentId]/
│   │   │   │       ├── page.tsx      # Agent config — tabbed view
│   │   │   │       └── skills/
│   │   │   │           ├── page.tsx  # Skills list for agent
│   │   │   │           └── [skillId]/
│   │   │   │               └── page.tsx  # Skill editor
│   │   │   └── settings/
│   │   │       └── page.tsx          # Admin settings (API keys, billing)
│   │   ├── client/
│   │   │   ├── layout.tsx            # Client layout
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx          # Client dashboard — their agent stats
│   │   │   └── calendar/
│   │   │       └── page.tsx          # Google Calendar connection page
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/
│   │       │   │   └── route.ts      # NextAuth.js config
│   │       │   └── google/
│   │       │       ├── authorize/
│   │       │       │   └── route.ts  # Start Google OAuth flow
│   │       │       └── callback/
│   │       │           └── route.ts  # Google OAuth callback
│   │       ├── clients/
│   │       │   ├── route.ts          # GET (list) / POST (create)
│   │       │   ├── [clientId]/
│   │       │   │   └── route.ts      # GET / PUT / DELETE
│   │       │   └── invite/
│   │       │       └── route.ts      # POST — send invite email
│   │       ├── agents/
│   │       │   ├── route.ts          # GET (list) / POST (create)
│   │       │   └── [agentId]/
│   │       │       ├── route.ts      # GET / PUT / DELETE
│   │       │       └── skills/
│   │       │           ├── route.ts  # GET (list) / POST (create)
│   │       │           └── [skillId]/
│   │       │               └── route.ts  # GET / PUT / DELETE
│   │       ├── phone-numbers/
│   │       │   └── route.ts          # GET (list) / POST (provision)
│   │       ├── vapi/
│   │       │   ├── tool-call/
│   │       │   │   └── route.ts      # POST — Vapi tool execution webhook
│   │       │   └── call-ended/
│   │       │       └── route.ts      # POST — Vapi call-ended webhook
│   │       ├── sms/
│   │       │   └── send/
│   │       │       └── route.ts      # POST — send SMS via Twilio
│   │       ├── billing/
│   │       │   ├── route.ts          # GET usage stats
│   │       │   └── webhook/
│   │       │       └── route.ts      # POST — Stripe webhook
│   │       └── call-logs/
│   │           └── route.ts          # GET (list with filters)
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client init
│   │   ├── vapi.ts                   # Vapi API client wrapper
│   │   ├── google-calendar.ts        # Google Calendar API helpers
│   │   ├── twilio.ts                 # Twilio SMS helper
│   │   ├── stripe.ts                 # Stripe billing helper
│   │   ├── encryption.ts             # AES-256 encrypt/decrypt for tokens
│   │   ├── auth.ts                   # NextAuth config + role helpers
│   │   └── buffer.ts                 # 60-min appointment buffer logic
│   ├── components/
│   │   ├── ui/                       # Shared UI components (buttons, inputs, cards, tables)
│   │   ├── admin/
│   │   │   ├── AgentForm.tsx
│   │   │   ├── AgentTabs.tsx
│   │   │   ├── SkillEditor.tsx
│   │   │   ├── ClientList.tsx
│   │   │   ├── DashboardStats.tsx
│   │   │   └── PromptEditor.tsx
│   │   └── client/
│   │       ├── CalendarConnect.tsx
│   │       ├── CallLogTable.tsx
│   │       └── ClientStats.tsx
│   └── types/
│       └── index.ts                  # TypeScript types for all entities
├── public/
├── .env.local                        # Environment variables (never committed)
├── next.config.js
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# NextAuth
NEXTAUTH_URL=
NEXTAUTH_SECRET=

# Google OAuth (for client calendar auth)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Vapi
VAPI_API_KEY=
VAPI_WEBHOOK_SECRET=

# Twilio (SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Stripe (Billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Encryption
TOKEN_ENCRYPTION_KEY=          # 32-byte hex key for AES-256
```

## Key Design Decisions

1. **Vapi webhook architecture** — Vapi calls our `/api/vapi/tool-call` endpoint when the agent needs to execute a skill. This keeps all business logic (calendar, SMS) server-side.

2. **Per-client OAuth tokens** — Each client's Google tokens are stored separately. The backend looks up the correct token based on which agent is handling the call → which client owns that agent.

3. **60-minute buffer** — When checking availability, the backend adds 60 minutes to each existing event's end time before calculating open slots. This is enforced server-side, not in the prompt.

4. **Caller verification for rescheduling** — The voice agent asks the caller for their name and appointment details. The backend searches Google Calendar events matching that name + approximate time to find the correct event.

5. **Supabase for auth + database** — Supabase provides both Postgres and auth primitives. NextAuth.js sits on top for session management and role-based access, while Supabase handles the database layer.
