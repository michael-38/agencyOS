-- Add password reset token fields to admins and clients tables

ALTER TABLE admins
  ADD COLUMN reset_token text,
  ADD COLUMN reset_token_expires_at timestamptz;

ALTER TABLE clients
  ADD COLUMN reset_token text,
  ADD COLUMN reset_token_expires_at timestamptz;

CREATE INDEX idx_admins_reset_token ON admins (reset_token) WHERE reset_token IS NOT NULL;
CREATE INDEX idx_clients_reset_token ON clients (reset_token) WHERE reset_token IS NOT NULL;
