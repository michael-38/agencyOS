import twilio from 'twilio'

export async function sendSms(to: string, message: string) {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  return client.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body: message,
  })
}
