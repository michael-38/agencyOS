import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from './supabase'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const { email, password } = credentials as { email: string; password: string }

        // Try admin first
        const { data: admin } = await supabaseAdmin
          .from('admins')
          .select('*')
          .eq('email', email)
          .single()

        if (admin && await bcrypt.compare(password, admin.password_hash)) {
          return { id: admin.id, email: admin.email, name: admin.name, role: 'admin' }
        }

        // Try client
        const { data: client } = await supabaseAdmin
          .from('clients')
          .select('*')
          .eq('email', email)
          .eq('status', 'active')
          .single()

        if (client && client.password_hash && await bcrypt.compare(password, client.password_hash)) {
          return { id: client.id, email: client.email, name: client.name, role: 'client' }
        }

        return null
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as Record<string, unknown>).role as string
        token.userId = user.id
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).role = token.role
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).userId = token.userId
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
})
