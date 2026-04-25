import Stripe from 'stripe'

const stripeEnabled = !!process.env.STRIPE_SECRET_KEY

export const stripe = stripeEnabled
  ? new Stripe(process.env.STRIPE_SECRET_KEY!)
  : (null as unknown as Stripe)

export async function createStripeCustomer(email: string, name: string) {
  if (!stripeEnabled) throw new Error('Stripe is not configured')
  return stripe.customers.create({ email, name })
}

export async function createSubscription(customerId: string, priceId: string) {
  if (!stripeEnabled) throw new Error('Stripe is not configured')
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
  })
}

export async function cancelSubscription(subscriptionId: string) {
  if (!stripeEnabled) throw new Error('Stripe is not configured')
  return stripe.subscriptions.cancel(subscriptionId)
}
