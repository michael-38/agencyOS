import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@/components/SignOutButton'

const navItems = [
  { href: '/client/dashboard', label: 'Dashboard' },
  { href: '/client/calendar', label: 'Calendar' },
]

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user as { role?: string; name?: string | null; email?: string | null } | undefined

  if (!session || user?.role !== 'client') redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-slate-900 text-sm">VoiceAgent</span>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user?.name || user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8">{children}</main>
    </div>
  )
}
