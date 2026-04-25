import { google } from 'googleapis'
import { encrypt, decrypt } from './encryption'
import { supabaseAdmin } from './supabase'
import type { Client } from '@/types'

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export function getGoogleAuthUrl(clientId: string): string {
  const oauth2Client = getOAuthClient()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.freebusy',
    ],
    state: Buffer.from(clientId).toString('base64'),
  })
}

export async function exchangeGoogleCode(code: string) {
  const oauth2Client = getOAuthClient()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

export async function getCalendarClient(client: Client) {
  if (!client.google_access_token_enc || !client.google_refresh_token_enc) {
    throw new Error('This client has not connected their Google Calendar. Please ask them to connect it from their dashboard.')
  }

  const oauth2Client = getOAuthClient()

  const accessToken = decrypt(client.google_access_token_enc)
  const refreshToken = decrypt(client.google_refresh_token_enc)

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: client.google_token_expiry
      ? new Date(client.google_token_expiry).getTime()
      : undefined,
  })

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await supabaseAdmin
        .from('clients')
        .update({
          google_access_token_enc: encrypt(tokens.access_token),
          google_token_expiry: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
        })
        .eq('id', client.id)
    }
  })

  return google.calendar({ version: 'v3', auth: oauth2Client })
}

function getCalendarId(client: Client): string {
  return client.google_calendar_id || 'primary'
}

export async function checkAvailability(
  client: Client,
  date: string,
  timeRangeStart = '09:00',
  timeRangeEnd = '17:00'
): Promise<Array<{ start: string; end: string }>> {
  const calendar = await getCalendarClient(client)
  const calendarId = getCalendarId(client)

  const timeZone = await getCalendarTimeZone(calendar, calendarId)

  const dayStart = `${date}T${timeRangeStart}:00`
  const dayEnd = `${date}T${timeRangeEnd}:00`

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: new Date(`${dayStart}`).toISOString(),
      timeMax: new Date(`${dayEnd}`).toISOString(),
      timeZone,
      items: [{ id: calendarId }],
    },
  })

  // Google returns the actual calendar email as the key, even if we passed 'primary'.
  // Get the first (and only) calendar entry from the response.
  const calendars = data.calendars || {}
  const calendarData = calendars[calendarId] || Object.values(calendars)[0]
  const busySlots = calendarData?.busy || []

  const busyWithBuffer = busySlots.map((slot) => ({
    start: new Date(slot.start!).getTime(),
    end: new Date(slot.end!).getTime() + 60 * 60 * 1000,
  }))

  const dayStartMs = new Date(`${dayStart}`).getTime()
  const dayEndMs = new Date(`${dayEnd}`).getTime()
  const slots: Array<{ start: string; end: string }> = []
  let current = dayStartMs
  const slotDuration = 60 * 60 * 1000

  while (current + slotDuration <= dayEndMs) {
    const slotEnd = current + slotDuration
    const isBlocked = busyWithBuffer.some(
      (busy) => current < busy.end && slotEnd > busy.start
    )
    if (!isBlocked) {
      slots.push({
        start: new Date(current).toISOString(),
        end: new Date(slotEnd).toISOString(),
      })
    }
    current += 30 * 60 * 1000
  }

  return slots.slice(0, 6)
}

async function getCalendarTimeZone(
  calendar: Awaited<ReturnType<typeof getCalendarClient>>,
  calendarId: string
): Promise<string> {
  try {
    const { data } = await calendar.calendars.get({ calendarId })
    return data.timeZone || 'America/New_York'
  } catch {
    return 'America/New_York'
  }
}

export async function createCalendarEvent(
  client: Client,
  params: {
    date: string
    startTime: string
    endTime?: string
    callerName: string
    callerPhone?: string
    reason?: string
  }
) {
  const calendar = await getCalendarClient(client)
  const calendarId = getCalendarId(client)
  const timeZone = await getCalendarTimeZone(calendar, calendarId)

  // Default to 1 hour if no end time provided
  const endTime = params.endTime || addHour(params.startTime)

  const { data } = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `Appointment: ${params.callerName}`,
      description: [
        params.callerPhone ? `Phone: ${params.callerPhone}` : null,
        `Reason: ${params.reason || 'N/A'}`,
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: `${params.date}T${params.startTime}:00`,
        timeZone,
      },
      end: {
        dateTime: `${params.date}T${endTime}:00`,
        timeZone,
      },
    },
  })
  return data
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function findEventByCallerAndDate(
  client: Client,
  callerName: string,
  date: string
) {
  const calendar = await getCalendarClient(client)
  const calendarId = getCalendarId(client)
  const { data } = await calendar.events.list({
    calendarId,
    timeMin: new Date(`${date}T00:00:00`).toISOString(),
    timeMax: new Date(`${date}T23:59:59`).toISOString(),
    q: callerName,
  })
  return data.items?.[0] || null
}

export async function updateCalendarEvent(
  client: Client,
  eventId: string,
  params: { newDate: string; newStartTime: string; newEndTime?: string }
) {
  const calendar = await getCalendarClient(client)
  const calendarId = getCalendarId(client)
  const timeZone = await getCalendarTimeZone(calendar, calendarId)

  const endTime = params.newEndTime || addHour(params.newStartTime)

  const { data } = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: {
      start: {
        dateTime: `${params.newDate}T${params.newStartTime}:00`,
        timeZone,
      },
      end: {
        dateTime: `${params.newDate}T${endTime}:00`,
        timeZone,
      },
    },
  })
  return data
}

export async function deleteCalendarEvent(client: Client, eventId: string) {
  const calendar = await getCalendarClient(client)
  const calendarId = getCalendarId(client)
  await calendar.events.delete({
    calendarId,
    eventId,
  })
}

export async function listCalendars(client: Client) {
  const calendar = await getCalendarClient(client)
  const { data } = await calendar.calendarList.list()
  return data.items || []
}
