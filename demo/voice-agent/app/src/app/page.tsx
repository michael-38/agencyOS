import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await auth()
  const user = session?.user as { role?: string } | undefined

  if (!session) redirect('/login')
  if (user?.role === 'admin') redirect('/admin/dashboard')
  if (user?.role === 'client') redirect('/client/dashboard')
  redirect('/login')
}
