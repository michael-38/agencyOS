# Vapi Integration Guide

## Overview

Vapi is the voice AI platform that handles:
- Phone number provisioning (Twilio under the hood)
- Inbound call answering
- Voice-to-text and text-to-voice
- LLM conversation management
- Tool/function calling during calls (webhooks to our backend)
- Call transcripts and metadata

Our app creates and manages Vapi assistants programmatically via the Vapi API. During calls, Vapi invokes our webhook endpoints when the agent needs to execute skills (tools).

## Vapi API Usage

Base URL: `https://api.vapi.ai`
Auth: `Authorization: Bearer <VAPI_API_KEY>`

### Creating an Assistant (when admin creates an agent)

```typescript
// POST https://api.vapi.ai/assistant
const createVapiAssistant = async (agent: Agent, skills: Skill[]) => {
  const tools = skills.filter(s => s.enabled).map(skill => ({
    type: "function" as const,
    function: {
      name: skill.name,
      description: skill.description,
      parameters: skill.parameters_schema,
    },
    server: {
      url: `${process.env.NEXTAUTH_URL}/api/vapi/tool-call`,
      secret: process.env.VAPI_WEBHOOK_SECRET,
    },
  }));

  const response = await fetch("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: agent.name,
      model: {
        provider: "openai",
        model: "gpt-4o",
        systemMessage: agent.system_prompt,
      },
      voice: {
        provider: "11labs",
        voiceId: "21m00Tcm4TlvDq8ikWAM", // Default voice, configurable later
      },
      serverUrl: `${process.env.NEXTAUTH_URL}/api/vapi/call-ended`,
      tools,
    }),
  });

  return response.json(); // { id: "asst_xxx", ... }
};
```

### Provisioning a Phone Number

```typescript
// POST https://api.vapi.ai/phone-number
const provisionPhoneNumber = async (assistantId: string, areaCode?: string) => {
  const response = await fetch("https://api.vapi.ai/phone-number", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "twilio",
      assistantId,
      number: areaCode ? { areaCode } : undefined,
    }),
  });

  return response.json(); // { id: "pn_xxx", number: "+15551234567", ... }
};
```

### Updating an Assistant (when admin edits prompt or skills)

```typescript
// PATCH https://api.vapi.ai/assistant/{id}
const updateVapiAssistant = async (vapiAssistantId: string, updates: Partial<VapiAssistant>) => {
  const response = await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  return response.json();
};
```

### Deleting an Assistant

```typescript
// DELETE https://api.vapi.ai/assistant/{id}
const deleteVapiAssistant = async (vapiAssistantId: string) => {
  await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${process.env.VAPI_API_KEY}`,
    },
  });
};
```

## Webhook Handling

### Tool Call Webhook

When Vapi needs to execute a tool during a call, it sends a POST to our server URL.

**Endpoint:** `POST /api/vapi/tool-call`

```typescript
// src/app/api/vapi/tool-call/route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyVapiSignature } from "@/lib/vapi";
import { handleCheckAvailability } from "@/lib/skills/check-availability";
import { handleScheduleAppointment } from "@/lib/skills/schedule-appointment";
import { handleRescheduleAppointment } from "@/lib/skills/reschedule-appointment";
import { handleCancelAppointment } from "@/lib/skills/cancel-appointment";
import { handleSendSms } from "@/lib/skills/send-sms";
import { handleCustomWebhook } from "@/lib/skills/custom-webhook";

export async function POST(req: NextRequest) {
  // 1. Verify webhook signature
  const body = await req.text();
  if (!verifyVapiSignature(body, req.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const { call, toolCallList } = payload.message;

  // 2. Look up agent by Vapi assistant ID
  const agent = await getAgentByVapiId(call.assistantId);
  const client = await getClientById(agent.client_id);

  // 3. Execute each tool call
  const results = await Promise.all(
    toolCallList.map(async (toolCall) => {
      const { name, arguments: args } = toolCall.function;
      let result;

      switch (name) {
        case "check_availability":
          result = await handleCheckAvailability(client, args);
          break;
        case "schedule_appointment":
          result = await handleScheduleAppointment(client, agent, args);
          break;
        case "reschedule_appointment":
          result = await handleRescheduleAppointment(client, args);
          break;
        case "cancel_appointment":
          result = await handleCancelAppointment(client, args);
          break;
        case "send_sms":
          result = await handleSendSms(args);
          break;
        default:
          // Custom skill — look up action_config and execute webhook
          const skill = await getSkillByName(agent.id, name);
          result = await handleCustomWebhook(skill, args);
      }

      return { toolCallId: toolCall.id, result };
    })
  );

  return NextResponse.json({ results });
}
```

### Call Ended Webhook

When a call finishes, Vapi sends a summary.

**Endpoint:** `POST /api/vapi/call-ended`

```typescript
// src/app/api/vapi/call-ended/route.ts

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!verifyVapiSignature(body, req.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const { call, startedAt, endedAt, transcript, summary, customer } = payload.message;

  // 1. Look up agent
  const agent = await getAgentByVapiId(call.assistantId);

  // 2. Calculate duration
  const durationSeconds = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
  );

  // 3. Determine outcome from transcript/summary analysis
  const outcome = analyzeCallOutcome(transcript, summary);

  // 4. Create call log
  await createCallLog({
    agent_id: agent.id,
    vapi_call_id: call.id,
    caller_phone: customer.number,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    transcript,
    outcome,
  });

  // 5. Update billing usage
  const durationMinutes = Math.ceil(durationSeconds / 60);
  await incrementMinutesUsed(agent.client_id, durationMinutes);

  return NextResponse.json({ ok: true });
}
```

## Webhook Signature Verification

```typescript
// src/lib/vapi.ts

import crypto from "crypto";

export function verifyVapiSignature(body: string, headers: Headers): boolean {
  const signature = headers.get("x-vapi-signature");
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", process.env.VAPI_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

## Built-in Skill Definitions

These are the default tool schemas registered with Vapi for each agent.

### check_availability
```json
{
  "name": "check_availability",
  "description": "Check available appointment slots on the client's calendar for a given date. Returns a list of available time windows.",
  "parameters": {
    "type": "object",
    "properties": {
      "date": {
        "type": "string",
        "description": "The date to check availability for, in YYYY-MM-DD format"
      },
      "time_range_start": {
        "type": "string",
        "description": "Earliest acceptable time in HH:MM 24h format. Defaults to business hours start."
      },
      "time_range_end": {
        "type": "string",
        "description": "Latest acceptable time in HH:MM 24h format. Defaults to business hours end."
      }
    },
    "required": ["date"]
  }
}
```

### schedule_appointment
```json
{
  "name": "schedule_appointment",
  "description": "Book an appointment on the client's calendar. Also sends an SMS confirmation to the caller.",
  "parameters": {
    "type": "object",
    "properties": {
      "date": { "type": "string", "description": "Appointment date in YYYY-MM-DD format" },
      "start_time": { "type": "string", "description": "Start time in HH:MM 24h format" },
      "end_time": { "type": "string", "description": "End time in HH:MM 24h format" },
      "caller_name": { "type": "string", "description": "Full name of the caller" },
      "caller_phone": { "type": "string", "description": "Caller's phone number" },
      "reason": { "type": "string", "description": "Reason for the appointment" }
    },
    "required": ["date", "start_time", "end_time", "caller_name", "caller_phone"]
  }
}
```

### reschedule_appointment
```json
{
  "name": "reschedule_appointment",
  "description": "Reschedule an existing appointment. The caller must provide their name and details of the existing appointment to verify identity.",
  "parameters": {
    "type": "object",
    "properties": {
      "caller_name": { "type": "string", "description": "Full name of the caller (for verification)" },
      "original_date": { "type": "string", "description": "Original appointment date in YYYY-MM-DD" },
      "new_date": { "type": "string", "description": "New appointment date in YYYY-MM-DD" },
      "new_start_time": { "type": "string", "description": "New start time in HH:MM 24h format" },
      "new_end_time": { "type": "string", "description": "New end time in HH:MM 24h format" }
    },
    "required": ["caller_name", "original_date", "new_date", "new_start_time", "new_end_time"]
  }
}
```

### cancel_appointment
```json
{
  "name": "cancel_appointment",
  "description": "Cancel an existing appointment. The caller must provide their name and details of the existing appointment to verify identity.",
  "parameters": {
    "type": "object",
    "properties": {
      "caller_name": { "type": "string", "description": "Full name of the caller (for verification)" },
      "appointment_date": { "type": "string", "description": "Date of the appointment to cancel in YYYY-MM-DD" }
    },
    "required": ["caller_name", "appointment_date"]
  }
}
```

### send_sms_confirmation
```json
{
  "name": "send_sms_confirmation",
  "description": "Send an SMS confirmation message to the caller with their appointment details.",
  "parameters": {
    "type": "object",
    "properties": {
      "phone_number": { "type": "string", "description": "Phone number to send SMS to" },
      "message": { "type": "string", "description": "The confirmation message text" }
    },
    "required": ["phone_number", "message"]
  }
}
```

## Sync Strategy

The app is the source of truth for agent configuration. Vapi is kept in sync:

| Event | Action |
|-------|--------|
| Admin creates agent | POST Vapi assistant + POST phone number |
| Admin edits prompt | PATCH Vapi assistant (model.systemMessage) |
| Admin adds/edits/removes skill | PATCH Vapi assistant (tools array) |
| Admin enables/disables agent | PATCH Vapi assistant or release phone number |
| Admin deletes agent | DELETE Vapi assistant + release phone number |

If a Vapi API call fails, the local change is rolled back and the error is shown to the admin.
