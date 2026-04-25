import { createClient } from '@supabase/supabase-js'

// All database access goes through the service role client (server-side only).
// The anon client has been removed — RLS is enabled on all tables, so the
// anon key has no access. SUPABASE_SERVICE_ROLE_KEY bypasses RLS automatically.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
