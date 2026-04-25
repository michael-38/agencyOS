-- Add password reset token fields to admins and clients tables

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS reset_token text,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS reset_token text,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_admins_reset_token ON admins (reset_token) WHERE reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_reset_token ON clients (reset_token) WHERE reset_token IS NOT NULL;
