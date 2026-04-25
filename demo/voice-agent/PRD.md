# Product Requirements Document — Voice Agent Manager

## 1. Purpose

A web application that lets an admin configure AI voice agents for multiple clients. Each agent answers inbound calls on a dedicated phone number, qualifies leads, checks the client's Google Calendar for availability, and books appointments — solving the problem of clients losing business from missed calls.

## 2. Users

### Admin (Single User — the operator)
- Creates and manages all client accounts and agents
- Configures agent prompts, skills, and phone numbers
- Views all call logs, stats, and billing across clients
- Cannot be created via the app — seeded in the database

### Client (Multiple — one per business)
- Invited by admin, creates an account via invite link
- Connects their Google Calendar via OAuth
- Views their own call logs and appointment stats (read-only)
- Cannot edit agent configuration

## 3. Functional Requirements

### 3.1 Authentication & Authorization

| ID | Requirement |
|----|-------------|
| AUTH-1 | Admin logs in with email/password via NextAuth.js |
| AUTH-2 | Clients log in with email/password via NextAuth.js |
| AUTH-3 | Admin invite flow: admin enters client email → app sends invite link → client sets password |
| AUTH-4 | Role-based access: admin sees all resources; client sees only their own agent/call data |
| AUTH-5 | Session management with JWT tokens stored in HTTP-only cookies |

### 3.2 Client Management

| ID | Requirement |
|----|-------------|
| CLIENT-1 | Admin can create a client (name, business name, email) |
| CLIENT-2 | Admin can edit client details |
| CLIENT-3 | Admin can deactivate a client (soft delete — preserves data) |
| CLIENT-4 | Admin can view a list of all clients with status |

### 3.3 Agent Management

| ID | Requirement |
|----|-------------|
| AGENT-1 | Admin can create an agent assigned to a client |
| AGENT-2 | Admin can configure: name, system prompt, phone number, status (active/inactive) |
| AGENT-3 | Admin can edit the system prompt in a code-editor-style text area |
| AGENT-4 | Admin can enable/disable an agent without deleting it |
| AGENT-5 | Each agent is synced to a Vapi assistant via the Vapi API |
| AGENT-6 | When agent config changes, the corresponding Vapi assistant is updated via API |

### 3.4 Phone Number Management

| ID | Requirement |
|----|-------------|
| PHONE-1 | Admin can provision a phone number via Vapi API |
| PHONE-2 | Admin can assign a provisioned number to an agent |
| PHONE-3 | Admin can reassign or release a number |
| PHONE-4 | Phone number status displayed on agent config page |

### 3.5 Skills / Tools

| ID | Requirement |
|----|-------------|
| SKILL-1 | Admin can create skills (tools) for an agent |
| SKILL-2 | Each skill has: name, description, parameter schema (JSON), action configuration |
| SKILL-3 | Built-in skill types: check_availability, schedule_appointment, reschedule_appointment, cancel_appointment, send_sms_confirmation |
| SKILL-4 | Custom skill type: admin defines webhook URL, HTTP method, headers, body template |
| SKILL-5 | Skills are registered as Vapi assistant tools via the Vapi API |
| SKILL-6 | When Vapi invokes a tool during a call, it sends a webhook to our backend, which executes the skill logic |

### 3.6 Google Calendar Integration

| ID | Requirement |
|----|-------------|
| GCAL-1 | Client clicks "Connect Google Calendar" on their dashboard |
| GCAL-2 | App redirects to Google OAuth consent with scopes: `calendar.readonly`, `calendar.events`, `calendar.freebusy` |
| GCAL-3 | On callback, app exchanges auth code for access + refresh tokens |
| GCAL-4 | Tokens stored encrypted (AES-256) in Supabase, linked to client record |
| GCAL-5 | Client selects which calendar the agent uses (one calendar per agent) |
| GCAL-6 | App automatically refreshes expired access tokens using the refresh token |
| GCAL-7 | If refresh fails (revoked), client is prompted to re-authorize |
| GCAL-8 | Check availability: query Google Freebusy API, enforce 60-minute buffer between appointments |
| GCAL-9 | Book appointment: create Google Calendar event with caller name, phone, reason in description |
| GCAL-10 | Reschedule: find existing event by caller name + appointment details, update time |
| GCAL-11 | Cancel: find existing event, delete it |

### 3.7 Call Handling (Vapi Runtime)

| ID | Requirement |
|----|-------------|
| CALL-1 | Agent answers all inbound calls to its provisioned Vapi phone number |
| CALL-2 | Agent follows the system prompt configured by admin |
| CALL-3 | Agent can invoke skills (tools) during the call via Vapi function calling |
| CALL-4 | No compliance disclosure required at call start |
| CALL-5 | Callers can call back to reschedule/cancel by providing their name + appointment details |

### 3.8 SMS Confirmation

| ID | Requirement |
|----|-------------|
| SMS-1 | After booking an appointment, agent triggers SMS confirmation to the caller |
| SMS-2 | SMS sent via Twilio API |
| SMS-3 | SMS includes: appointment date/time, client business name, and a note about rescheduling |
| SMS-4 | SMS sent from the same Twilio number or a dedicated SMS number |

### 3.9 Call Logs & Stats

| ID | Requirement |
|----|-------------|
| LOG-1 | Every call is logged: caller phone, timestamp, duration, transcript, outcome |
| LOG-2 | Outcome categories: appointment_booked, appointment_rescheduled, appointment_cancelled, info_collected, no_action |
| LOG-3 | Admin can view all call logs, filtered by agent or client |
| LOG-4 | Client can view call logs for their own agent only |
| LOG-5 | Dashboard stats: calls today, past 7 days, past 30 days, appointments booked |

### 3.10 Billing

| ID | Requirement |
|----|-------------|
| BILL-1 | Monthly flat-rate subscription tiers managed via Stripe |
| BILL-2 | Each tier defines a call-minute limit per month |
| BILL-3 | Admin can view usage per client (minutes used vs. tier limit) |
| BILL-4 | Usage tracked by aggregating call durations from call logs |

### 3.11 White-Label

| ID | Requirement |
|----|-------------|
| WL-1 | Basic white-label: client dashboard does not show the admin's brand |
| WL-2 | No custom logos or custom domains in v1 |
| WL-3 | Client sees a neutral/generic UI when logged in |

## 4. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | OAuth tokens encrypted at rest (AES-256) |
| NFR-2 | All API routes authenticated and role-checked |
| NFR-3 | Vapi webhook endpoint validates request signatures |
| NFR-4 | Latency: skill execution (calendar check, booking) must complete within 5 seconds to avoid call timeout |
| NFR-5 | App deployed on Vercel, database on Supabase |
| NFR-6 | Environment variables for all API keys (Vapi, Google, Twilio, Stripe) — never hardcoded |

## 5. Out of Scope (v1)

- Client self-editing of agent configuration
- Custom logos or custom domains
- Email confirmations (only SMS)
- Multi-calendar per agent
- Call recording playback in the UI
- Real-time call monitoring
- Mobile app
