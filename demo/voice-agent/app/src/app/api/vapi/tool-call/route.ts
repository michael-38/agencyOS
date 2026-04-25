import { NextRequest, NextResponse } from 'next/server'
import { verifyVapiSignature } from '@/lib/vapi'
import { supabaseAdmin } from '@/lib/supabase'
import { checkAvailability, createCalendarEvent, findEventByCallerAndDate, updateCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar'
import { sendSms } from '@/lib/twilio'
import type { Client, Skill } from '@/types'

export async function POST(req: NextRequest) {
  const body = await req.text()

  if (!verifyVapiSignature(body, req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = JSON.parse(body)
  const message = payload.message

  // Handle different Vapi message types — only process tool-calls
  if (message?.type && message.type !== 'tool-calls') {
    return NextResponse.json({ ok: true })
  }

  const { call, toolCallList } = message

  // Look up agent by Vapi assistant ID
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('*, clients(*)')
    .eq('vapi_assistant_id', call.assistantId)
    .single()

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const client = agent.clients as unknown as Client

  const results = await Promise.all(
    (toolCallList as Array<{ id: string; function: { name: string; arguments: Record<string, string> | string } }>).map(async (toolCall) => {
      const { name } = toolCall.function
      // Vapi may send arguments as a JSON string or parsed object
      const args: Record<string, string> = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments
      let result: string

      try {
        switch (name) {
          case 'check_availability': {
            const slots = await checkAvailability(
              client,
              args.date,
              args.time_range_start,
              args.time_range_end
            )
            result = slots.length > 0
              ? `Available slots on ${args.date}: ${slots.map(s => new Date(s.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })).join(', ')}`
              : 'No available slots found for that date.'
            break
          }

          case 'schedule_appointment': {
            await createCalendarEvent(client, {
              date: args.date,
              startTime: args.start_time,
              endTime: args.end_time,
              callerName: args.caller_name,
              callerPhone: args.caller_phone,
              reason: args.reason,
            })
            // Send SMS confirmation
            if (args.caller_phone) {
              try {
                const msg = `Hi ${args.caller_name}, your appointment is confirmed for ${args.date} at ${args.start_time}. Reply to this number to reschedule.`
                await sendSms(args.caller_phone, msg)
              } catch (smsErr) {
                console.error('SMS failed:', smsErr)
              }
            }
            result = `Appointment booked successfully for ${args.caller_name} on ${args.date} at ${args.start_time}.`
            break
          }

          case 'reschedule_appointment': {
            const existingEvent = await findEventByCallerAndDate(client, args.caller_name, args.original_date)
            if (!existingEvent) {
              result = `Could not find an appointment for ${args.caller_name} on ${args.original_date}.`
              break
            }
            await updateCalendarEvent(client, existingEvent.id!, {
              newDate: args.new_date,
              newStartTime: args.new_start_time,
              newEndTime: args.new_end_time,
            })
            result = `Appointment rescheduled to ${args.new_date} at ${args.new_start_time}.`
            break
          }

          case 'cancel_appointment': {
            const eventToCancel = await findEventByCallerAndDate(client, args.caller_name, args.appointment_date)
            if (!eventToCancel) {
              result = `Could not find an appointment for ${args.caller_name} on ${args.appointment_date}.`
              break
            }
            await deleteCalendarEvent(client, eventToCancel.id!)
            result = `Appointment on ${args.appointment_date} has been cancelled.`
            break
          }

          case 'send_sms': {
            await sendSms(args.phone_number, args.message)
            result = 'SMS sent successfully.'
            break
          }

          default: {
            // Custom skill — look up action_config and call webhook
            const { data: skill } = await supabaseAdmin
              .from('skills')
              .select('*')
              .eq('agent_id', agent.id)
              .eq('name', name)
              .single()

            if (!skill) {
              result = `Unknown skill: ${name}`
              break
            }

            const skillData = skill as Skill
            const config = skillData.action_config as { url?: string; method?: string; headers?: Record<string, string>; body_template?: string }

            if (!config.url) {
              result = 'Custom skill has no URL configured.'
              break
            }

            const bodyStr = config.body_template
              ? config.body_template.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => args[k] || '')
              : JSON.stringify(args)

            const webhookRes = await fetch(config.url, {
              method: config.method || 'POST',
              headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
              body: bodyStr,
            })
            result = await webhookRes.text()
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred'
        console.error(`Tool call "${name}" failed:`, err)
        result = `Error: ${message}`
      }

      return { toolCallId: toolCall.id, result }
    })
  )

  return NextResponse.json({ results })
}
