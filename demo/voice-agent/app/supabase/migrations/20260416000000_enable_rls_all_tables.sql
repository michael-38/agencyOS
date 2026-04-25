-- Enable RLS on all tables that were previously unprotected.
-- The service role key bypasses RLS automatically, so all existing
-- supabaseAdmin calls continue to work. The anon key gets zero access.

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

-- No policies are added for these tables — RLS enabled with no policies
-- means deny-all for non-service-role callers, which is correct since
-- all access goes through the server-side supabaseAdmin client.
