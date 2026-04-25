import { NextRequest, NextResponse } from 'next/server'
import { exchangeGoogleCode, listCalendars } from '@/lib/google-calendar'
import { encrypt } from '@/lib/encryption'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL('/client/calendar?error=google_denied', process.env.NEXTAUTH_URL!)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/client/calendar?error=missing_params', process.env.NEXTAUTH_URL!)
    )
  }

  let clientId: string
  try {
    clientId = Buffer.from(state, 'base64').toString('utf8')
  } catch {
    return NextResponse.redirect(
      new URL('/client/calendar?error=invalid_state', process.env.NEXTAUTH_URL!)
    )
  }

  try {
    const tokens = await exchangeGoogleCode(code)

    // Fetch the primary calendar ID using the fresh tokens
    const { google } = await import('googleapis')
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    oauth2Client.setCredentials(tokens)
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const { data: calList } = await calendar.calendarList.list()
    const primary = calList.items?.find((c) => c.primary)
    const calendarId = primary?.id || 'primary'

    await supabaseAdmin
      .from('clients')
      .update({
        google_access_token_enc: encrypt(tokens.access_token!),
        google_refresh_token_enc: encrypt(tokens.refresh_token!),
        google_token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        google_calendar_id: calendarId,
      })
      .eq('id', clientId)

    return NextResponse.redirect(
      new URL('/client/calendar?connected=true', process.env.NEXTAUTH_URL!)
    )
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(
      new URL('/client/calendar?error=exchange_failed', process.env.NEXTAUTH_URL!)
    )
  }
}
