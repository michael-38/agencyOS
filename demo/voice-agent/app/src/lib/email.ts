import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

export async function sendInviteEmail(to: string, name: string, inviteUrl: string) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "You've been invited — set up your account",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1e293b; margin-bottom: 8px;">Welcome, ${name}!</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          Your account has been created. Click the button below to set your password and get started.
        </p>
        <a href="${inviteUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Activate Account
        </a>
        <p style="color: #94a3b8; font-size: 13px;">
          This link expires in 7 days. If you didn't expect this email, you can ignore it.
        </p>
      </div>
    `,
  })

  if (error) {
    console.error('[Email] Failed to send invite:', error)
    throw error
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Reset your password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1e293b; margin-bottom: 8px;">Password Reset</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          We received a request to reset your password. Click the button below to choose a new one.
        </p>
        <a href="${resetUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Reset Password
        </a>
        <p style="color: #94a3b8; font-size: 13px;">
          This link expires in 1 hour. If you didn't request this, you can ignore it.
        </p>
      </div>
    `,
  })

  if (error) {
    console.error('[Email] Failed to send password reset:', error)
    throw error
  }
}
